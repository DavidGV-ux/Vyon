import { describe, it, expect } from 'vitest'
import { ProcessPaymentUseCase } from '../../src/application/use-cases/process-payment.js'
import { ReconcilePaymentsUseCase } from '../../src/application/use-cases/reconcile-payments.js'
import { InMemoryPaymentRepository } from '../../src/infrastructure/billing/in-memory-payment-repository.js'
import { SimulatedPaymentGateway } from '../../src/infrastructure/billing/simulated-payment-gateway.js'
import type { ChargeRequest, ChargeResult, PaymentGatewayPort } from '../../src/domain/payments/ports.js'
import { FakeClock, silentLogger, noopMetrics, sequentialIds } from '../helpers.js'

function makeSut(gateway: PaymentGatewayPort) {
  const repository = new InMemoryPaymentRepository()
  const clock = new FakeClock()
  const useCase = new ProcessPaymentUseCase({
    repository,
    gateway,
    clock,
    idGenerator: sequentialIds('pay'),
    logger: silentLogger,
    metrics: noopMetrics,
    maxAttempts: 3,
    retryDelayMs: 0,
  })
  return { useCase, repository, clock }
}

const BASE = {
  idempotencyKey: 'key-abcdef-001',
  userId: 'u1',
  amountCents: 1200,
}

describe('MECL-044 · pagos idempotentes con cero pérdida', () => {
  it('procesa un pago exitoso y registra el intento antes de cobrar', async () => {
    const gateway = new SimulatedPaymentGateway({ delayMs: 0 })
    const { useCase, repository } = makeSut(gateway)

    const result = await useCase.execute(BASE)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.payment.status).toBe('succeeded')
    expect(result.value.payment.providerRef).toMatch(/^sim_/)
    expect(result.value.payment.attempts).toHaveLength(1)
    expect(result.value.payment.attempts[0]?.outcome).toBe('succeeded')
    expect(gateway.listCharges()).toHaveLength(1)
    expect((await repository.listAll()).length).toBe(1)
  })

  it('replay con la misma idempotencyKey NO cobra dos veces', async () => {
    const gateway = new SimulatedPaymentGateway({ delayMs: 0 })
    const { useCase, repository } = makeSut(gateway)

    const first = await useCase.execute(BASE)
    const second = await useCase.execute(BASE)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(second.value.replayed).toBe(true)
    expect(second.value.payment.id).toBe(first.value.payment.id)
    expect(gateway.listCharges()).toHaveLength(1) // cero dobles cobros
    expect((await repository.listAll()).length).toBe(1)
  })

  it('fallos reintentables hacen backoff hasta exito sin perder la transacción', async () => {
    const gateway = new SimulatedPaymentGateway({ delayMs: 0, failFirstN: 2 })
    const { useCase, repository } = makeSut(gateway)

    const result = await useCase.execute({ ...BASE, idempotencyKey: 'key-retry-0001' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.payment.status).toBe('succeeded')
    expect(result.value.payment.attempts).toHaveLength(3)
    expect(result.value.payment.attempts.map(a => a.outcome)).toEqual([
      'retryable_failure',
      'retryable_failure',
      'succeeded',
    ])
    expect(gateway.listCharges()).toHaveLength(1)
    expect((await repository.findByIdempotencyKey('key-retry-0001'))?.status).toBe('succeeded')
  })

  it('rechazo definitivo marca el pago como failed sin reintentos infinitos', async () => {
    class DeclinedGateway implements PaymentGatewayPort {
      readonly name = 'declined'
      calls = 0
      async charge(_req: ChargeRequest): Promise<ChargeResult> {
        this.calls += 1
        return { status: 'failed', code: 'CARD_DECLINED', retryable: false }
      }
    }
    const gateway = new DeclinedGateway()
    const { useCase } = makeSut(gateway)

    const result = await useCase.execute({ ...BASE, idempotencyKey: 'key-declined-01' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PAYMENT_DECLINED')
    expect(gateway.calls).toBe(1)
  })

  it('agotar reintentos deja estado failed con intentos registrados (auditable)', async () => {
    const gateway = new SimulatedPaymentGateway({ delayMs: 0, failFirstN: 99 })
    const { useCase, repository } = makeSut(gateway)

    const result = await useCase.execute({ ...BASE, idempotencyKey: 'key-exhaust-01' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PAYMENT_FAILED')

    const stored = await repository.findByIdempotencyKey('key-exhaust-01')
    expect(stored?.status).toBe('failed')
    expect(stored?.attempts).toHaveLength(3)
    expect(gateway.listCharges()).toHaveLength(0) // nunca se cobró
  })

  it('valida llave de idempotencia y monto', async () => {
    const gateway = new SimulatedPaymentGateway({ delayMs: 0 })
    const { useCase } = makeSut(gateway)

    const shortKey = await useCase.execute({ ...BASE, idempotencyKey: 'short' })
    expect(shortKey.ok).toBe(false)

    const badAmount = await useCase.execute({ ...BASE, idempotencyKey: 'key-bad-amount', amountCents: -5 })
    expect(badAmount.ok).toBe(false)
    expect(gateway.listCharges()).toHaveLength(0)
  })

  it('conciliación local ↔ pasarela queda balanceada (cero pérdida)', async () => {
    const gateway = new SimulatedPaymentGateway({ delayMs: 0 })
    const { useCase, repository, clock } = makeSut(gateway)

    await useCase.execute({ ...BASE, idempotencyKey: 'key-rec-00001' })
    await useCase.execute({ ...BASE, idempotencyKey: 'key-rec-00002' })
    await useCase.execute({ ...BASE, idempotencyKey: 'key-rec-00003' })
    // replay de una ya cobrada
    await useCase.execute({ ...BASE, idempotencyKey: 'key-rec-00001' })

    const reconcile = new ReconcilePaymentsUseCase(
      repository,
      gateway,
      clock,
      silentLogger,
      noopMetrics,
    )
    const report = await reconcile.execute()
    expect(report.ok).toBe(true)
    if (!report.ok) return

    expect(report.value.balanced).toBe(true)
    expect(report.value.missingLocal).toHaveLength(0)
    expect(report.value.missingGateway).toHaveLength(0)
    expect(report.value.gatewayChargesTotal).toBe(3)
    expect(report.value.paymentsSucceeded).toBe(3)
    expect(report.value.paymentsTotal).toBe(3)
  })
})
