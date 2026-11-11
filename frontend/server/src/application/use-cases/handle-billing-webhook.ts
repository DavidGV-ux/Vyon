import type { Subscription } from '../../domain/billing/entities.js'
import type { BillingEventPublisherPort, SubscriptionRepositoryPort } from '../../domain/billing/ports.js'
import { verifyProState } from '../../domain/billing/services/pro-state.js'
import { verifySignature } from '../../domain/billing/services/webhook-signature.js'
import type { Clock, Logger } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError, UnauthorizedError, ValidationError } from '../../domain/shared/errors.js'

export type BillingWebhookEvent =
  | { readonly type: 'payment.succeeded'; readonly userId: string; readonly at: string }
  | { readonly type: 'payment.failed'; readonly userId: string; readonly at: string }
  | { readonly type: 'subscription.canceled'; readonly userId: string; readonly at: string }

export type HandleBillingWebhookInput = {
  readonly payload: string
  readonly signature: string | undefined
  readonly secret: string
}

/**
 * Webhook de pasarela: mantiene los estados de suscripción sincronizados
 * de forma automática (dunning → past_due, pagos → active, etc.).
 */
export class HandleBillingWebhookUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly events: BillingEventPublisherPort,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async execute(input: HandleBillingWebhookInput): Promise<Result<{ handled: true; subscription: Subscription | null }, AppError>> {
    if (!verifySignature(input.payload, input.signature, input.secret)) {
      return err(new UnauthorizedError('Firma de webhook inválida.'))
    }

    let event: BillingWebhookEvent
    try {
      event = JSON.parse(input.payload) as BillingWebhookEvent
    } catch {
      return err(new ValidationError('Payload JSON inválido.'))
    }

    if (!['payment.succeeded', 'payment.failed', 'subscription.canceled'].includes(event.type)) {
      return err(new ValidationError(`Evento desconocido: ${String(event.type)}`))
    }

    const now = this.clock.now()
    const existing = await this.subscriptions.findByUserId(event.userId)

    if (!existing) {
      this.logger.warn('webhook for unknown user', { userId: event.userId, type: event.type })
      return ok({ handled: true, subscription: null })
    }

    let updated: Subscription
    switch (event.type) {
      case 'payment.succeeded': {
        const currentEnd = new Date(existing.currentPeriodEnd).getTime()
        const base = Math.max(currentEnd, now.getTime())
        updated = {
          ...existing,
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: now.toISOString(),
        }
        break
      }
      case 'payment.failed':
        updated = { ...existing, status: 'past_due', updatedAt: now.toISOString() }
        break
      case 'subscription.canceled':
        updated = { ...existing, status: 'canceled', cancelAtPeriodEnd: false, updatedAt: now.toISOString() }
        break
    }

    await this.subscriptions.save(updated)
    await this.events.publish({
      type: 'subscription.updated',
      userId: event.userId,
      at: now.toISOString(),
      data: { status: updated.status, trigger: event.type, state: verifyProState(updated, now).state },
    })

    this.logger.info('billing webhook processed', { userId: event.userId, type: event.type, status: updated.status })
    return ok({ handled: true, subscription: updated })
  }
}
