export type InvoiceStatus = 'issued' | 'paid' | 'void'

export type InvoiceLine = {
  readonly description: string
  readonly quantity: number
  readonly unitPriceCents: number
  readonly totalCents: number
}

export type Invoice = {
  readonly id: string
  readonly number: string
  readonly userId: string
  readonly subscriptionId: string
  readonly status: InvoiceStatus
  readonly issuedAt: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly lines: readonly InvoiceLine[]
  readonly subtotalCents: number
  readonly taxCents: number
  readonly totalCents: number
  readonly currency: string
  readonly customerEmail: string | null
  readonly paymentId: string | null
}

export type Receipt = {
  readonly id: string
  readonly invoiceId: string
  readonly paymentId: string
  readonly paidAt: string
  readonly amountCents: number
  readonly currency: string
  readonly method: string
}

export function invoiceLineTotal(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents)
}

export function computeTotals(
  lines: readonly { quantity: number; unitPriceCents: number }[],
  taxRatePercent: number,
): { subtotalCents: number; taxCents: number; totalCents: number } {
  const subtotalCents = lines.reduce((sum, l) => sum + invoiceLineTotal(l.quantity, l.unitPriceCents), 0)
  const taxCents = Math.round((subtotalCents * taxRatePercent) / 100)
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}

export function formatMoney(cents: number, currency: string): string {
  const symbol = currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}
