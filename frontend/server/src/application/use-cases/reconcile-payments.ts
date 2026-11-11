import type { Clock, Logger, MetricsPort } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok } from '../../domain/shared/result.js'
import type { PaymentRepositoryPort, ReconcilablePaymentGatewayPort } from '../../domain/payments/ports.js'

export type ReconciliationReport = {
  readonly at: string
  readonly paymentsTotal: number
  readonly paymentsSucceeded: number
  readonly gatewayChargesTotal: number
  /** Cobros en la pasarela sin registro local (pérdida potencial). */
  readonly missingLocal: readonly { idempotencyKey: string; providerRef: string; amountCents: number }[]
  /** Registros locales marcados como cobrados sin cargo en pasarela (falso positivo). */
  readonly missingGateway: readonly { idempotencyKey: string; providerRef: string }[]
  readonly balanced: boolean
}

/**
 * Conciliación local ↔ pasarela. Es la red de seguridad de "cero pérdida
 * de transacciones": cualquier divergencia queda expuesta con detalle.
 */
export class ReconcilePaymentsUseCase {
  constructor(
    private readonly payments: PaymentRepositoryPort,
    private readonly gateway: ReconcilablePaymentGatewayPort,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly metrics: MetricsPort,
  ) {}

  async execute(): Promise<Result<ReconciliationReport, Error>> {
    const payments = await this.payments.listAll(10_000)
    const charges = this.gateway.listCharges()

    const localByKey = new Map(payments.map(p => [p.idempotencyKey, p]))
    const gatewayByKey = new Map(charges.map(c => [c.idempotencyKey, c]))

    const missingLocal = charges
      .filter(c => !localByKey.has(c.idempotencyKey))
      .map(c => ({ idempotencyKey: c.idempotencyKey, providerRef: c.providerRef, amountCents: c.amountCents }))

    const missingGateway = payments
      .filter(p => p.status === 'succeeded' && p.providerRef && !gatewayByKey.has(p.idempotencyKey))
      .map(p => ({ idempotencyKey: p.idempotencyKey, providerRef: p.providerRef as string }))

    const report: ReconciliationReport = {
      at: this.clock.now().toISOString(),
      paymentsTotal: payments.length,
      paymentsSucceeded: payments.filter(p => p.status === 'succeeded').length,
      gatewayChargesTotal: charges.length,
      missingLocal,
      missingGateway,
      balanced: missingLocal.length === 0 && missingGateway.length === 0,
    }

    this.metrics.gauge('vyon_reconciliation_unbalanced', report.balanced ? 0 : 1)
    if (!report.balanced) {
      this.logger.error('reconciliation mismatch', {
        missingLocal: missingLocal.length,
        missingGateway: missingGateway.length,
      })
    } else {
      this.logger.info('reconciliation balanced', { payments: report.paymentsTotal })
    }

    return ok(report)
  }
}
