export type PaymentStatus = 'pending' | 'succeeded' | 'failed'

export type PaymentAttempt = {
  readonly attempt: number
  readonly attemptedAt: string
  readonly outcome: 'succeeded' | 'retryable_failure' | 'definitive_failure'
  readonly providerRef: string | null
  readonly code: string | null
  readonly latencyMs: number
}

export type Payment = {
  readonly id: string
  readonly idempotencyKey: string
  readonly userId: string
  readonly amountCents: number
  readonly currency: string
  readonly status: PaymentStatus
  readonly providerRef: string | null
  readonly failureCode: string | null
  readonly attempts: readonly PaymentAttempt[]
  readonly createdAt: string
  readonly updatedAt: string
}

export type PaymentMethod = 'card' | 'transfer' | 'wallet'

export function newPayment(init: {
  id: string
  idempotencyKey: string
  userId: string
  amountCents: number
  currency: string
  now: string
}): Payment {
  return {
    id: init.id,
    idempotencyKey: init.idempotencyKey,
    userId: init.userId,
    amountCents: init.amountCents,
    currency: init.currency,
    status: 'pending',
    providerRef: null,
    failureCode: null,
    attempts: [],
    createdAt: init.now,
    updatedAt: init.now,
  }
}
