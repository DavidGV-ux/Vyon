import type { PlanId, Subscription } from '../../domain/billing/entities.js'
import { PLANS } from '../../domain/billing/entities.js'
import type { BillingEventPublisherPort, SubscriptionRepositoryPort } from '../../domain/billing/ports.js'
import { verifyProState } from '../../domain/billing/services/pro-state.js'
import type { GenerateInvoiceUseCase } from './generate-invoice.js'
import type { ProcessPaymentUseCase } from './process-payment.js'
import type { Clock, IdGenerator, Logger } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError, ValidationError } from '../../domain/shared/errors.js'

export type StartCheckoutInput = {
  readonly userId: string
  readonly plan: PlanId
  readonly customerEmail?: string
  readonly idempotencyKey?: string
}

export type StartCheckoutOutput = {
  readonly subscription: Subscription
  readonly paymentId: string
  readonly invoiceId: string | null
  readonly state: ReturnType<typeof verifyProState>
}

const MONTH_DAYS = 30

/**
 * Paywall automatizado (MECL-041): checkout → pago idempotente →
 * suscripción activa → factura emitida automáticamente (MECL-042).
 */
export class StartCheckoutUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly generateInvoice: GenerateInvoiceUseCase,
    private readonly events: BillingEventPublisherPort,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async execute(input: StartCheckoutInput): Promise<Result<StartCheckoutOutput, AppError>> {
    if (input.plan === 'free') {
      return err(new ValidationError('El plan free no requiere checkout.'))
    }

    const existing = await this.subscriptions.findByUserId(input.userId)
    const now = this.clock.now()

    if (existing && existing.plan === input.plan && existing.status === 'active') {
      const state = verifyProState(existing, now)
      if (state.isPro) {
        return err(
          new AppError({
            code: 'CONFLICT',
            message: 'El usuario ya cuenta con una suscripción activa en este plan.',
            details: { state: state.state },
          }),
        )
      }
    }

    const plan = PLANS[input.plan]
    const idempotencyKey =
      input.idempotencyKey ?? `checkout:${input.userId}:${input.plan}:${now.toISOString().slice(0, 10)}`

    const paymentResult = await this.processPayment.execute({
      idempotencyKey,
      userId: input.userId,
      amountCents: plan.priceUsdMonthly * 100,
      currency: 'USD',
      method: 'card',
    })
    if (!paymentResult.ok) return paymentResult

    const periodStart = now.toISOString()
    const periodEnd = new Date(now.getTime() + MONTH_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const subscription: Subscription = {
      id: existing?.id ?? this.idGenerator.next(),
      userId: input.userId,
      plan: input.plan,
      status: 'active',
      startedAt: existing?.startedAt ?? periodStart,
      trialEndsAt: null,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      updatedAt: periodStart,
    }
    await this.subscriptions.save(subscription)

    const invoiceResult = await this.generateInvoice.execute({
      userId: input.userId,
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      lines: [
        {
          description: `Suscripción Vyon ${plan.name} · mensualidad`,
          quantity: 1,
          unitPriceCents: plan.priceUsdMonthly * 100,
        },
      ],
      currency: 'USD',
      customerEmail: input.customerEmail ?? null,
      payment: {
        paymentId: paymentResult.value.payment.id,
        paidAt: paymentResult.value.payment.updatedAt,
        method: 'card',
      },
    })
    if (!invoiceResult.ok) return invoiceResult

    await this.events.publish({
      type: 'subscription.updated',
      userId: input.userId,
      at: periodStart,
      data: { plan: input.plan, status: 'active', invoiceId: invoiceResult.value.invoice.id },
    })

    this.logger.info('checkout completed', {
      userId: input.userId,
      plan: input.plan,
      invoice: invoiceResult.value.invoice.number,
    })

    return ok({
      subscription,
      paymentId: paymentResult.value.payment.id,
      invoiceId: invoiceResult.value.invoice.id,
      state: verifyProState(subscription, now),
    })
  }
}
