import type { Invoice, Receipt } from './entities.js'

export interface InvoiceRepositoryPort {
  save(invoice: Invoice): Promise<void>
  findById(id: string): Promise<Invoice | null>
  listByUser(userId: string, limit?: number, offset?: number): Promise<Invoice[]>
  nextSequence(year: number): Promise<number>
}

export interface ReceiptRepositoryPort {
  save(receipt: Receipt): Promise<void>
  findByInvoice(invoiceId: string): Promise<Receipt | null>
}

export type RenderedPdf = {
  readonly bytes: Buffer
  readonly fileName: string
  readonly contentType: 'application/pdf'
}

export interface PdfRendererPort {
  renderInvoice(invoice: Invoice): RenderedPdf
  renderReceipt(receipt: Receipt, invoice: Invoice): RenderedPdf
}
