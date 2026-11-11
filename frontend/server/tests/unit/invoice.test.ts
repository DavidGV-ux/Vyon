import { describe, it, expect } from 'vitest'
import { computeTotals, invoiceLineTotal, formatMoney } from '../../src/domain/invoices/entities.js'
import { GenerateInvoiceUseCase } from '../../src/application/use-cases/generate-invoice.js'
import { InvoicePdfRenderer } from '../../src/domain/invoices/pdf-renderer.js'
import { InMemoryInvoiceRepository, InMemoryReceiptRepository } from '../../src/infrastructure/billing/in-memory-invoice-repository.js'
import { FakeClock, sequentialIds } from '../helpers.js'

const LINE = { description: 'Suscripción Vyon Pro · mensualidad', quantity: 1, unitPriceCents: 1200 }

function makeUseCase(taxRatePercent = 0) {
  const invoices = new InMemoryInvoiceRepository()
  const receipts = new InMemoryReceiptRepository()
  const clock = new FakeClock()
  const uc = new GenerateInvoiceUseCase(invoices, receipts, clock, sequentialIds('inv'), taxRatePercent)
  return { uc, invoices, receipts }
}

describe('MECL-042 · facturación automática PDF', () => {
  it('calcula totales con impuestos', () => {
    const totals = computeTotals(
      [
        { quantity: 2, unitPriceCents: 1200 },
        { quantity: 1, unitPriceCents: 500 },
      ],
      19,
    )
    expect(totals.subtotalCents).toBe(2900)
    expect(totals.taxCents).toBe(551)
    expect(totals.totalCents).toBe(3451)
    expect(invoiceLineTotal(3, 999)).toBe(2997)
  })

  it('formatea moneda', () => {
    expect(formatMoney(1250, 'USD')).toBe('$12.50')
  })

  it('emite factura numerada secuencialmente con recibo cuando hay pago', async () => {
    const { uc, invoices, receipts } = makeUseCase()

    const first = await uc.execute({
      userId: 'u1',
      subscriptionId: 's1',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      lines: [LINE],
      payment: { paymentId: 'p1', paidAt: '2026-11-11T12:00:00.000Z', method: 'card' },
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.invoice.number).toMatch(/^INV-2026-0001$/)
    expect(first.value.invoice.status).toBe('paid')
    expect(first.value.invoice.totalCents).toBe(1200)
    expect(first.value.receipt).not.toBeNull()

    const second = await uc.execute({
      userId: 'u2',
      subscriptionId: 's2',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      lines: [LINE],
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.invoice.number).toBe('INV-2026-0002')
    expect(second.value.invoice.status).toBe('issued')
    expect(second.value.receipt).toBeNull()

    expect((await invoices.listByUser('u1')).length).toBe(1)
    expect(await receipts.findByInvoice(first.value.invoice.id)).not.toBeNull()
  })

  it('rechaza facturas sin líneas', async () => {
    const { uc } = makeUseCase()
    const result = await uc.execute({
      userId: 'u1',
      subscriptionId: 's1',
      periodStart: 'a',
      periodEnd: 'b',
      lines: [],
    })
    expect(result.ok).toBe(false)
  })

  it('el PDF renderizado tiene estructura válida (%PDF, xref, EOF)', async () => {
    const { uc } = makeUseCase(19)
    const created = await uc.execute({
      userId: 'user@vyon.app',
      subscriptionId: 's1',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      lines: [LINE],
      payment: { paymentId: 'p1', paidAt: '2026-11-11T12:00:00.000Z', method: 'card' },
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const renderer = new InvoicePdfRenderer()
    const rendered = renderer.renderInvoice(created.value.invoice)
    const pdf = rendered.bytes

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    expect(pdf.toString('latin1')).toContain('INV-2026-0001')
    expect(pdf.toString('latin1')).toContain('VYON')
    expect(pdf.toString('latin1')).toContain('user@vyon.app')
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
    expect(rendered.contentType).toBe('application/pdf')
    expect(rendered.fileName).toBe('INV-2026-0001.pdf')

    // xref apunta a la tabla de referencias real
    const text = pdf.toString('latin1')
    const startxrefIdx = text.lastIndexOf('startxref')
    expect(startxrefIdx).toBeGreaterThan(0)
    const offset = Number(text.slice(startxrefIdx + 'startxref'.length).trim().split(/\s+/)[0])
    expect(Number.isInteger(offset)).toBe(true)
    expect(text.slice(offset, offset + 4)).toBe('xref')

    // recibo también renderiza
    expect(created.value.receipt).not.toBeNull()
    const receiptPdf = renderer.renderReceipt(created.value.receipt!, created.value.invoice)
    expect(receiptPdf.bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    expect(receiptPdf.bytes.toString('latin1')).toContain('RECIBO DE PAGO')
  })
})
