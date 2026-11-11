/**
 * Escritor PDF mínimo sin dependencias (PDF 1.4, fuentes base-14 Helvetica).
 * Suficiente para facturas/recibos de texto con tablas simples.
 */

export type PdfColor = readonly [number, number, number]

export type TextOptions = {
  readonly size?: number
  readonly bold?: boolean
  readonly color?: PdfColor
  readonly align?: 'left' | 'center' | 'right'
}

const PAGE_WIDTH = 595 // A4
const PAGE_HEIGHT = 842
const MARGIN = 56

type Op = string

function escapePdfText(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`
    } else if (code < 32 || code > 255) {
      out += '?'
    } else {
      out += ch
    }
  }
  return out
}

/** Ancho aproximado en puntos (Helvetica). Suficiente para alineación de tablas. */
function estimateWidth(text: string, size: number): number {
  let units = 0
  for (const ch of text) {
    if ('iljI.,;:!?\'|'.includes(ch)) units += 0.28
    else if ('ftr()[]{}-'.includes(ch)) units += 0.35
    else if ('mMWw@'.includes(ch)) units += 0.86
    else if (ch === ' ') units += 0.28
    else if (ch >= 'A' && ch <= 'Z') units += 0.67
    else units += 0.55
  }
  return units * size
}

export class PdfWriter {
  private readonly pages: Op[][] = [[]]
  private cursorY = PAGE_HEIGHT - MARGIN

  get width(): number {
    return PAGE_WIDTH
  }

  get height(): number {
    return PAGE_HEIGHT
  }

  get margin(): number {
    return MARGIN
  }

  get y(): number {
    return this.cursorY
  }

  set y(value: number) {
    this.cursorY = value
  }

  newPage(): void {
    this.pages.push([])
    this.cursorY = PAGE_HEIGHT - MARGIN
  }

  text(content: string, x: number, y: number, options: TextOptions = {}): void {
    const size = options.size ?? 10
    const font = options.bold ? '/F2' : '/F1'
    const [r, g, b] = options.color ?? [0, 0, 0]
    let tx = x
    if (options.align === 'right') tx = x - estimateWidth(content, size)
    else if (options.align === 'center') tx = x - estimateWidth(content, size) / 2

    this.currentPage.push(
      `BT ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${font} ${size} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(content)}) Tj ET`,
    )
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = [0.85, 0.85, 0.85], width = 1): void {
    const [r, g, b] = color
    this.currentPage.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    )
  }

  rect(x: number, y: number, w: number, h: number, color: PdfColor): void {
    const [r, g, b] = color
    this.currentPage.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`)
  }

  render(): Buffer {
    const objects: string[] = []
    const pageObjectIds = this.pages.map((_, i) => 3 + i * 2) // obj 1 catálogo, 2 pages, luego página+contenido por par
    const catalogId = 1
    const pagesId = 2
    const fontRegularId = 3 + this.pages.length * 2
    const fontBoldId = fontRegularId + 1

    objects.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
    objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`)

    this.pages.forEach((ops, i) => {
      const pageId = pageObjectIds[i] as number
      const stream = ops.join('\n')
      objects.push(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
          `/Contents ${pageId + 1} 0 R >>`,
      )
      objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
    })

    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

    let body = '%PDF-1.4\n'
    const offsets: number[] = []
    objects.forEach((obj, index) => {
      offsets.push(Buffer.byteLength(body, 'latin1'))
      body += `${index + 1} 0 obj\n${obj}\nendobj\n`
    })

    const xrefStart = Buffer.byteLength(body, 'latin1')
    const xrefLines = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n']
    for (const offset of offsets) {
      xrefLines.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
    }
    body += xrefLines.join('')
    body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

    return Buffer.from(body, 'latin1')
  }

  private get currentPage(): Op[] {
    const page = this.pages[this.pages.length - 1]
    if (!page) throw new Error('PdfWriter: no hay página activa')
    return page
  }
}
