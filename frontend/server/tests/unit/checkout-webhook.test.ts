import { describe, it, expect } from 'vitest'
import { StartCheckoutUseCase } from '../../src/application/use-cases/start-checkout.js'
import { HandleBillingWebhookUseCase } from '../../src/application/use-cases/handle-billing-webhook.js'
import { ProcessPaymentUseCase } from '../../src/application/use-cases/process-payment.js'
import { GenerateInvoiceUseCase } from '../../src/application/use-cases/generate-invoice.js'
import { VerifyProStateUseCase } from '../../src/application/use-cases/verify-pro-state.js'
import { InMemorySubscriptionRepository } from '../../src/infrastructure/billing/in-memory-subscription-repository.js'
import { InMemoryInvoiceRepository, InMemoryReceiptRepository } from '../../src/infrastructure/billing/in-memory-invoice-repository.js'
import { InMemoryPaymentRepository } from '../../src/infrastructure/billing/in-memory-payment-repository.js'
import { SimulatedPaymentGateway } from '../../src/infrastructure/billing/simulated-payment-gateway.js'
import { LogEventPublisher } from '../../src/infrastructure/billing/log-event-publisher.js'
import { signPayload } from '../../src/domain/billing/services/webhook-signature.js'
import { FakeClock, silentLogger, noopMetrics, sequentialIds } from '../helpers.js'

const SECRET = 'test-secret'

function makeCheckoutSut() {
  const subscriptions = new InMemorySubscriptionRepository()
  const invoices = new InMemoryInvoiceRepository()
  const receipts = new InMemoryReceiptRepository()
  const payments = new InMemoryPaymentRepository()
  const gateway = new SimulatedPaymentGateway({ delayMs: 0 })
  const clock = new FakeClock()
  const events = new LogEventPublisher(silentLogger)

  const processPayment = new ProcessPaymentUseCase({
    repository: payments,
    gateway,
    clock,
    idGenerator: sequentialIds('pay'),
    logger: silentLogger,
    metrics: noopMetrics,
    maxAttempts: 3,
    retryDelayMs: 0,
  })
  const generateInvoice = new GenerateInvoiceUseCase(invoices, receipts, clock, sequentialIds('inv'), 0)
  const checkout = new StartCheckoutUseCase(
    subscriptions,
    processPayment,
    generateInvoice,
    events,
    clock,
    sequentialIds('sub'),
    silentLogger,
  )
  const verify = new VerifyProStateUseCase(subscriptions, clock)
  const webhook = new HandleBillingWebhookUseCase(subscriptions, events, clock, silentLogger)

  return { subscriptions, invoices, payments, gateway, clock, checkout, verify, webhook }
}

describe('MECL-041+042+044 · flujo integral de checkout automatizado', () => {
  it('checkout → pago → suscripción activa → factura emitida automáticamente', async () => {
    const sut = makeCheckoutSut()

    const result = await sut.checkout.execute({ userId: 'u1', plan: 'pro', customerEmail: 'u1@vyon.app' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.subscription.status).toBe('active')
    expect(result.value.state.isPro).toBe(true)
    expect(result.value.state.state).toBe('PRO_ACTIVE')
    expect(result.value.invoiceId).not.toBeNull()

    // Factura y pago quedaron registrados
    const invoices = await sut.invoices.listByUser('u1')
    expect(invoices).toHaveLength(1)
    expect(invoices[0]?.totalCents).toBe(1200)
    expect(invoices[0]?.customerEmail).toBe('u1@vyon.app')
    expect((await sut.payments.listByUser('u1'))[0]?.status).toBe('succeeded')

    // Verificación posterior confirma estado Pro
    const state = await sut.verify.execute('u1')
    expect(state.ok && state.value.isPro).toBe(true)
  })

  it('checkout duplicado con suscripción activa → conflicto (cero dobles cobros)', async () => {
    const sut = makeCheckoutSut()
    const first = await sut.checkout.execute({ userId: 'u1', plan: 'pro' })
    expect(first.ok).toBe(true)

    const second = await sut.checkout.execute({ userId: 'u1', plan: 'pro' })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error.code).toBe('CONFLICT')
    expect(sut.gateway.listCharges()).toHaveLength(1)
    expect((await sut.invoices.listByUser('u1'))).toHaveLength(1)
  })

  it('plan free no requiere checkout', async () => {
    const sut = makeCheckoutSut()
    const result = await sut.checkout.execute({ userId: 'u1', plan: 'free' as never })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('MECL-041 · webhook de pasarela con firma HMAC', () => {
  function signed(payload: unknown): { payload: string; signature: string } {
    const raw = JSON.stringify(payload)
    return { payload: raw, signature: signPayload(raw, SECRET) }
  }

  it('rechaza firmas inválidas o ausentes', async () => {
    const sut = makeCheckoutSut()
    await sut.checkout.execute({ userId: 'u1', plan: 'pro' })

    const raw = JSON.stringify({ type: 'payment.failed', userId: 'u1', at: '2026-11-11T12:00:00.000Z' })
    const bad = await sut.webhook.execute({ payload: raw, signature: 'v1=deadbeef', secret: SECRET })
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.error.status).toBe(401)

    const none = await sut.webhook.execute({ payload: raw, signature: undefined, secret: SECRET })
    expect(none.ok).toBe(false)
  })

  it('payment.failed mueve la suscripción a past_due (paywall la bloquea)', async () => {
    const sut = makeCheckoutSut()
    await sut.checkout.execute({ userId: 'u1', plan: 'pro' })

    const { payload, signature } = signed({ type: 'payment.failed', userId: 'u1', at: '2026-11-11T12:00:00.000Z' })
    const result = await sut.webhook.execute({ payload, signature, secret: SECRET })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.subscription?.status).toBe('past_due')

    const state = await sut.verify.execute('u1')
    expect(state.ok && state.value.isPro).toBe(false)
    expect(state.ok && state.value.state).toBe('PRO_PAST_DUE')
  })

  it('payment.succeeded reactiva y extiende el periodo', async () => {
    const sut = makeCheckoutSut()
    await sut.checkout.execute({ userId: 'u1', plan: 'pro' })
    const before = (await sut.subscriptions.findByUserId('u1'))?.currentPeriodEnd

    const { payload, signature } = signed({ type: 'payment.succeeded', userId: 'u1', at: '2026-12-11T12:00:00.000Z' })
    sut.clock.advance(1000)
    const result = await sut.webhook.execute({ payload, signature, secret: SECRET })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.subscription?.status).toBe('active')
    const currentPeriodEnd = result.value.subscription?.currentPeriodEnd
    const extended = Boolean(
      currentPeriodEnd && before && new Date(currentPeriodEnd).getTime() > new Date(before).getTime(),
    )
    expect(extended).toBe(true)
  })

  it('subscription.canceled termina el acceso', async () => {
    const sut = makeCheckoutSut()
    await sut.checkout.execute({ userId: 'u1', plan: 'pro' })

    const { payload, signature } = signed({ type: 'subscription.canceled', userId: 'u1', at: '2026-11-11T12:00:00.000Z' })
    const result = await sut.webhook.execute({ payload, signature, secret: SECRET })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.subscription?.status).toBe('canceled')

    const state = await sut.verify.execute('u1')
    expect(state.ok && state.value.state).toBe('PRO_TERMINATED')
  })

  it('eventos de usuario desconocido se aceptan sin efecto', async () => {
    const sut = makeCheckoutSut()
    const { payload, signature } = signed({ type: 'payment.failed', userId: 'fantasma', at: 'x' })
    const result = await sut.webhook.execute({ payload, signature, secret: SECRET })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.subscription).toBeNull()
  })
})
