import type { Subscription } from '../../domain/billing/entities.js'
import type { SubscriptionRepositoryPort } from '../../domain/billing/ports.js'

export class InMemorySubscriptionRepository implements SubscriptionRepositoryPort {
  private readonly byId = new Map<string, Subscription>()
  private readonly byUser = new Map<string, string>()

  async findByUserId(userId: string): Promise<Subscription | null> {
    const id = this.byUser.get(userId)
    if (!id) return null
    return this.byId.get(id) ?? null
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.byId.get(id) ?? null
  }

  async save(subscription: Subscription): Promise<void> {
    this.byId.set(subscription.id, subscription)
    this.byUser.set(subscription.userId, subscription.id)
  }
}
