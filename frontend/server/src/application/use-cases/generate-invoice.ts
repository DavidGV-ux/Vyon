import type { Clock, IdGenerator } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError, ValidationError } from '../../domain/shared/errors.js'
import type { Invoice, InvoiceLine, Receipt } from '../../domain/invoices/entities.js'
import { computeTotals, invoiceLineTotal } from '../../domain/invoices/entities.js'
import type { InvoiceRepositoryPort, ReceiptRepositoryPort } from '../../domain/invoices/ports.js'

export type GenerateInvoiceInput = {
  readonly userId: string
  readonly subscriptionId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly lines: readonly { description: string; quantity: number; unitPriceCents: number }[]
  readonly currency?: string
  readonly customerEmail?: string | null
  readonly taxRatePercent?: number
  readonly payment?: {
    readonly paymentId: string
    readonly paidAt: string
    readonly method: string
  }
}

export type GenerateInvoiceOutput = {
  readonly invoice: Invoice
  readonly receipt: Receipt | null
}

/**
 * Emite la factura (y recibo de pago si hubo pago) de forma automática.
 * Numeración secuencial por año: INV-YYYY-0001.
 */
export class GenerateInvoiceUseCase {
  constructor(
    private readonly invoices: InvoiceRepositoryPort,
    private readonly receipts: ReceiptRepositoryPort,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly taxRatePercent = 0,
  ) {}

  async execute(input: GenerateInvoiceInput): Promise<Result<GenerateInvoiceOutput, AppError>> {
    if (input.lines.length === 0) {
      return err(new ValidationError('La factura debe incluir al menos una línea.'))
    }

    const lines: InvoiceLine[] = input.lines.map(l => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      totalCents: invoiceLineTotal(l.quantity, l.unitPriceCents),
    }))

    const totals = computeTotals(lines, input.taxRatePercent ?? this.taxRatePercent)
    const now = this.clock.now()
    const sequence = await this.invoices.nextSequence(now.getUTCFullYear())
    const number = `INV-${now.getUTCFullYear()}-${String(sequence).padStart(4, '0')}`

    const invoice: Invoice = {
      id: this.idGenerator.next(),
      number,
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      status: input.payment ? 'paid' : 'issued',
      issuedAt: now.toISOString(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      lines,
      ...totals,
      currency: input.currency ?? 'USD',
      customerEmail: input.customerEmail ?? null,
      paymentId: input.payment?.paymentId ?? null,
    }

    let receipt: Receipt | null = null
    if (input.payment) {
      receipt = {
        id: this.idGenerator.next(),
        invoiceId: invoice.id,
        paymentId: input.payment.paymentId,
        paidAt: input.payment.paidAt,
        amountCents: totals.totalCents,
        currency: invoice.currency,
        method: input.payment.method,
      }
    }

    await this.invoices.save(invoice)
    if (receipt) await this.receipts.save(receipt)

    return ok({ invoice, receipt })
  }
}
