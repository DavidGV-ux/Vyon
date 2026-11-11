import type { Invoice, Receipt } from '../../domain/invoices/entities.js'
import type { InvoiceRepositoryPort, ReceiptRepositoryPort } from '../../domain/invoices/ports.js'

export class InMemoryInvoiceRepository implements InvoiceRepositoryPort {
  private readonly byId = new Map<string, Invoice>()
  private readonly byUser = new Map<string, string[]>()
  private readonly sequences = new Map<number, number>()

  async save(invoice: Invoice): Promise<void> {
    this.byId.set(invoice.id, invoice)
    const list = this.byUser.get(invoice.userId) ?? []
    if (!list.includes(invoice.id)) list.push(invoice.id)
    this.byUser.set(invoice.userId, list)
  }

  async findById(id: string): Promise<Invoice | null> {
    return this.byId.get(id) ?? null
  }

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Invoice[]> {
    const ids = this.byUser.get(userId) ?? []
    const items = ids
      .map(id => this.byId.get(id))
      .filter((i): i is Invoice => Boolean(i))
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    return items.slice(offset, offset + limit)
  }

  async nextSequence(year: number): Promise<number> {
    const current = (this.sequences.get(year) ?? 0) + 1
    this.sequences.set(year, current)
    return current
  }
}

export class InMemoryReceiptRepository implements ReceiptRepositoryPort {
  private readonly byInvoice = new Map<string, Receipt>()

  async save(receipt: Receipt): Promise<void> {
    this.byInvoice.set(receipt.invoiceId, receipt)
  }

  async findByInvoice(invoiceId: string): Promise<Receipt | null> {
    return this.byInvoice.get(invoiceId) ?? null
  }
}
