import type { Subscription } from './entities.js'

export interface SubscriptionRepositoryPort {
  findByUserId(userId: string): Promise<Subscription | null>
  findById(id: string): Promise<Subscription | null>
  save(subscription: Subscription): Promise<void>
}

export type BillingEventType =
  | 'subscription.updated'
  | 'subscription.trial_started'
  | 'paywall.denied'
  | 'invoice.issued'

export type BillingEvent = {
  readonly type: BillingEventType
  readonly userId: string
  readonly at: string
  readonly data: Record<string, unknown>
}

export interface BillingEventPublisherPort {
  publish(event: BillingEvent): Promise<void>
}
