import { randomUUID } from 'node:crypto'
import type {
  ChargeRequest,
  ChargeResult,
  GatewayChargeRecord,
  PaymentRepositoryPort,
  ReconcilablePaymentGatewayPort,
} from '../../domain/payments/ports.js'

export type SimulatedGatewayOptions = {
  /** Los primeros N intentos de cada llave fallan (retryable). */
  readonly failFirstN?: number
  readonly failureCode?: string
  /** Latencia simulada por cobro (ms). */
  readonly delayMs?: number
  /** Cada N-ésima llave única falla en su primer intento (flakiness para stress test). */
  readonly flakyEvery?: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Pasarela simulada con las mismas garantías que una real:
 * - Deduplica por idempotencyKey (rechaza dobles cobros).
 * - Expone su ledger para conciliación (cero pérdida).
 * - Soporta inyección de fallos para tests de estrés.
 */
export class SimulatedPaymentGateway implements ReconcilablePaymentGatewayPort {
  readonly name = 'simulated'

  private readonly charges = new Map<string, GatewayChargeRecord>()
  private readonly attempts = new Map<string, number>()
  private readonly failureCounts = new Map<string, number>()

  constructor(
    private readonly options: SimulatedGatewayOptions = {},
    private readonly payments?: PaymentRepositoryPort,
  ) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const seen = (this.attempts.get(request.idempotencyKey) ?? 0) + 1
    this.attempts.set(request.idempotencyKey, seen)

    if (this.options.delayMs) await sleep(this.options.delayMs)

    // Deduplicación: si ya cobramos esta llave, devolvemos el mismo resultado.
    const existing = this.charges.get(request.idempotencyKey)
    if (existing) {
      return { status: 'succeeded', providerRef: existing.providerRef }
    }

    const flaky =
      this.options.flakyEvery !== undefined &&
      seen === 1 &&
      this.hashKey(request.idempotencyKey) % this.options.flakyEvery === 0

    const shouldFail =
      flaky ||
      (this.options.failFirstN !== undefined && seen <= this.options.failFirstN)

    if (shouldFail) {
      const code = flaky ? 'GATEWAY_TIMEOUT' : (this.options.failureCode ?? 'CARD_DECLINED')
      this.failureCounts.set(request.idempotencyKey, seen)
      return { status: 'failed', code, retryable: true }
    }

    const record: GatewayChargeRecord = {
      idempotencyKey: request.idempotencyKey,
      providerRef: `sim_${randomUUID().slice(0, 8)}`,
      amountCents: request.amountCents,
      currency: request.currency,
    }
    this.charges.set(request.idempotencyKey, record)

    // Persistencia opcional del "lado de la pasarela" para conciliación cruzada.
    await this.payments?.findByIdempotencyKey(request.idempotencyKey)

    return { status: 'succeeded', providerRef: record.providerRef }
  }

  listCharges(): GatewayChargeRecord[] {
    return [...this.charges.values()]
  }

  private hashKey(key: string): number {
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
    return hash
  }
}
