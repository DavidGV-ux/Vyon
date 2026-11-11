import type { Payment } from '../../domain/payments/entities.js'
import type { PaymentRepositoryPort } from '../../domain/payments/ports.js'

export class InMemoryPaymentRepository implements PaymentRepositoryPort {
  private readonly byId = new Map<string, Payment>()
  private readonly byKey = new Map<string, string>()

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const id = this.byKey.get(key)
    if (!id) return null
    return this.byId.get(id) ?? null
  }

  async findById(id: string): Promise<Payment | null> {
    return this.byId.get(id) ?? null
  }

  async save(payment: Payment): Promise<void> {
    this.byId.set(payment.id, payment)
    this.byKey.set(payment.idempotencyKey, payment.id)
  }

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Payment[]> {
    const items = [...this.byId.values()]
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return items.slice(offset, offset + limit)
  }

  async listAll(limit = 10_000): Promise<Payment[]> {
    return [...this.byId.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
  }
}
