import type { Payment } from './entities.js'

export type ChargeRequest = {
  readonly idempotencyKey: string
  readonly amountCents: number
  readonly currency: string
  readonly userId: string
  readonly method: string
}

export type ChargeSuccess = { readonly status: 'succeeded'; readonly providerRef: string }
export type ChargeFailure = {
  readonly status: 'failed'
  readonly code: string
  readonly retryable: boolean
}
export type ChargeResult = ChargeSuccess | ChargeFailure

/** Pasarela de pagos simulada (adaptable a Stripe/Plaid vía adapter). */
export interface PaymentGatewayPort {
  readonly name: string
  charge(request: ChargeRequest): Promise<ChargeResult>
}

export type GatewayChargeRecord = {
  readonly idempotencyKey: string
  readonly providerRef: string
  readonly amountCents: number
  readonly currency: string
}

/** Gateway que además expone su ledger para conciliación (cero pérdida). */
export interface ReconcilablePaymentGatewayPort extends PaymentGatewayPort {
  listCharges(): GatewayChargeRecord[]
}

export interface PaymentRepositoryPort {
  findByIdempotencyKey(key: string): Promise<Payment | null>
  findById(id: string): Promise<Payment | null>
  save(payment: Payment): Promise<void>
  listByUser(userId: string, limit?: number, offset?: number): Promise<Payment[]>
  listAll(limit?: number): Promise<Payment[]>
}
