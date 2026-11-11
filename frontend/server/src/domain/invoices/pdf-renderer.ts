import type { Invoice, Receipt } from './entities.js'
import { formatMoney } from './entities.js'
import type { PdfRendererPort, RenderedPdf } from './ports.js'
import { PdfWriter } from './pdf-writer.js'

const BRAND: PdfColor = [1, 0.78, 0.22] // vyon-yellow
const INK: PdfColor = [0.08, 0.09, 0.11]
const MUTED: PdfColor = [0.45, 0.47, 0.5]
const RULE: PdfColor = [0.85, 0.86, 0.88]

type PdfColor = readonly [number, number, number]

const LEFT = 56
const RIGHT = 539

function companyBlock(writer: PdfWriter): void {
  writer.text('VYON', LEFT, writer.y, { size: 24, bold: true, color: INK })
  writer.rect(LEFT, writer.y + 24, 54, 3, BRAND)
  writer.text('Vyon S.A.S. · NIT 900.000.000-1', LEFT, writer.y - 14, { size: 8, color: MUTED })
  writer.text('facturas@vyon.app · vyon.app', LEFT, writer.y - 24, { size: 8, color: MUTED })
}

function ensureRoom(writer: PdfWriter, needed: number): void {
  if (writer.y - needed < 72) writer.newPage()
}

export class InvoicePdfRenderer implements PdfRendererPort {
  renderInvoice(invoice: Invoice): RenderedPdf {
    const writer = new PdfWriter()
    let y = writer.height - writer.margin
    writer.y = y

    companyBlock(writer)
    y = writer.y - 48
    writer.y = y

    writer.text('FACTURA DE VENTA', RIGHT, y + 8, { size: 14, bold: true, align: 'right', color: INK })
    writer.text(invoice.number, RIGHT, y - 8, { size: 11, bold: true, align: 'right', color: MUTED })
    writer.text(`Emitida: ${invoice.issuedAt.slice(0, 10)}`, RIGHT, y - 22, { size: 9, align: 'right', color: MUTED })
    writer.text(`Estado: ${invoice.status === 'paid' ? 'PAGADA' : 'PENDIENTE'}`, RIGHT, y - 34, {
      size: 9,
      align: 'right',
      color: invoice.status === 'paid' ? [0.05, 0.6, 0.35] : MUTED,
    })

    y -= 20
    writer.line(LEFT, y, RIGHT, y, RULE, 1)
    y -= 24
    writer.y = y

    writer.text('CLIENTE', LEFT, y, { size: 8, bold: true, color: MUTED })
    writer.text(invoice.customerEmail ?? invoice.userId, LEFT, y - 13, { size: 10, color: INK })
    writer.text('SUSCRIPCIÓN', LEFT + 250, y, { size: 8, bold: true, color: MUTED })
    writer.text(invoice.subscriptionId, LEFT + 250, y - 13, { size: 10, color: INK })
    writer.text('PERIODO FACTURADO', RIGHT, y, { size: 8, bold: true, align: 'right', color: MUTED })
    writer.text(`${invoice.periodStart} → ${invoice.periodEnd}`, RIGHT, y - 13, {
      size: 10,
      align: 'right',
      color: INK,
    })
    y -= 40

    // Tabla
    writer.rect(LEFT, y - 4, RIGHT - LEFT, 20, [0.96, 0.96, 0.97])
    writer.text('CONCEPTO', LEFT + 8, y + 2, { size: 8, bold: true, color: MUTED })
    writer.text('CANT.', 380, y + 2, { size: 8, bold: true, align: 'right', color: MUTED })
    writer.text('PRECIO', 460, y + 2, { size: 8, bold: true, align: 'right', color: MUTED })
    writer.text('TOTAL', RIGHT - 8, y + 2, { size: 8, bold: true, align: 'right', color: MUTED })
    y -= 8
    writer.y = y

    for (const line of invoice.lines) {
      ensureRoom(writer, 60)
      y = writer.y - 16
      writer.y = y
      writer.text(line.description, LEFT + 8, y, { size: 9.5, color: INK })
      writer.text(String(line.quantity), 380, y, { size: 9.5, align: 'right', color: INK })
      writer.text(formatMoney(line.unitPriceCents, invoice.currency), 460, y, {
        size: 9.5,
        align: 'right',
        color: INK,
      })
      writer.text(formatMoney(line.totalCents, invoice.currency), RIGHT - 8, y, {
        size: 9.5,
        align: 'right',
        color: INK,
      })
      writer.line(LEFT, y - 6, RIGHT, y - 6, [0.93, 0.93, 0.94], 0.5)
      writer.y = y - 6
    }

    ensureRoom(writer, 90)
    y = writer.y - 24
    writer.y = y

    writer.text('Subtotal', 400, y, { size: 9.5, color: MUTED })
    writer.text(formatMoney(invoice.subtotalCents, invoice.currency), RIGHT, y, {
      size: 9.5,
      align: 'right',
      color: INK,
    })
    y -= 16
    writer.y = y
    writer.text('Impuestos', 400, y, { size: 9.5, color: MUTED })
    writer.text(formatMoney(invoice.taxCents, invoice.currency), RIGHT, y, {
      size: 9.5,
      align: 'right',
      color: INK,
    })
    y -= 10
    writer.y = y
    writer.line(400, y, RIGHT, y, RULE, 1)
    y -= 18
    writer.y = y
    writer.text('TOTAL', 400, y, { size: 11, bold: true, color: INK })
    writer.text(formatMoney(invoice.totalCents, invoice.currency), RIGHT, y, {
      size: 12,
      bold: true,
      align: 'right',
      color: INK,
    })

    // Footer
    const footerY = writer.margin - 10
    writer.line(LEFT, footerY + 24, RIGHT, footerY + 24, RULE, 1)
    writer.text(
      `Factura generada automáticamente por Vyon · Documento equilibrado digitalmente · ${invoice.id}`,
      LEFT,
      footerY + 10,
      { size: 7.5, color: MUTED },
    )
    writer.text(invoice.currency, RIGHT, footerY + 10, { size: 7.5, align: 'right', color: MUTED })

    return {
      bytes: writer.render(),
      fileName: `${invoice.number}.pdf`,
      contentType: 'application/pdf',
    }
  }

  renderReceipt(receipt: Receipt, invoice: Invoice): RenderedPdf {
    const writer = new PdfWriter()
    let y = writer.height - writer.margin
    writer.y = y

    companyBlock(writer)
    y = writer.y - 48
    writer.y = y

    writer.text('RECIBO DE PAGO', RIGHT, y + 8, { size: 14, bold: true, align: 'right', color: INK })
    writer.text(`#${receipt.id}`, RIGHT, y - 8, { size: 11, bold: true, align: 'right', color: MUTED })
    writer.text(`Pagado: ${receipt.paidAt}`, RIGHT, y - 22, { size: 9, align: 'right', color: MUTED })
    writer.text('PAGADO', RIGHT, y - 36, { size: 10, bold: true, align: 'right', color: [0.05, 0.6, 0.35] })

    y -= 20
    writer.line(LEFT, y, RIGHT, y, RULE, 1)
    y -= 28
    writer.y = y

    writer.text('Recibimos de', LEFT, y, { size: 8, bold: true, color: MUTED })
    writer.text(invoice.customerEmail ?? invoice.userId, LEFT, y - 14, { size: 10.5, color: INK })
    writer.text('Concepto', LEFT, y - 40, { size: 8, bold: true, color: MUTED })
    writer.text(`Suscripción Vyon ${invoice.number} · ${invoice.periodStart} → ${invoice.periodEnd}`, LEFT, y - 54, {
      size: 10.5,
      color: INK,
    })

    y -= 90
    writer.y = y
    writer.rect(LEFT, y - 10, RIGHT - LEFT, 56, [0.98, 0.97, 0.92])
    writer.text('Monto pagado', LEFT + 14, y + 18, { size: 9, color: MUTED })
    writer.text(formatMoney(receipt.amountCents, receipt.currency), LEFT + 14, y - 2, {
      size: 18,
      bold: true,
      color: INK,
    })
    writer.text(`Método: ${receipt.method}`, RIGHT - 14, y + 18, { size: 9, align: 'right', color: MUTED })
    writer.text(`Referencia: ${receipt.paymentId}`, RIGHT - 14, y - 2, { size: 9, align: 'right', color: MUTED })

    const footerY = writer.margin - 10
    writer.line(LEFT, footerY + 24, RIGHT, footerY + 24, RULE, 1)
    writer.text('Gracias por tu pago · Vyon S.A.S. · soporte@vyon.app', LEFT, footerY + 10, {
      size: 7.5,
      color: MUTED,
    })

    return {
      bytes: writer.render(),
      fileName: `RECIBO-${receipt.id}.pdf`,
      contentType: 'application/pdf',
    }
  }
}
