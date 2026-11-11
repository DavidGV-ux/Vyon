# MECL-042 — Configurar la generación automática de facturas y recibos de pago en PDF para usuarios Pro

**Responsable:** David (CTO) — Tecnología
**Estado:** ✅ Completado
**Punto U:** 4.3 · Costo: $1.150 USD + $250 USD = $1.400 USD
**Fecha:** 19/10/2026 (tarea) · Implementado: 11/11/2026

## Objetivo
Generación automática de facturas y recibos de pago en PDF para usuarios Pro.

## Implementación

### Modelo y cálculo
`server/src/domain/invoices/entities.ts`:
- `Invoice` con numeración secuencial por año: **`INV-2026-0001`**.
- Líneas de factura, subtotal, impuestos y total en centavos (sin errores de punto flotante: `Math.round`).
- `Receipt` vinculado al pago (`paymentId`, método, fecha).

### Generador PDF sin dependencias
`server/src/domain/invoices/pdf-writer.ts` — escritor PDF 1.4 propio:
- Fuentes base-14 Helvetica / Helvetica-Bold, A4 (595×842), página y tablas.
- Tabla `xref` con offsets byte-precisos (validado por test: `startxref` apunta a `xref` real).
- Escapado de texto y sustitución de caracteres fuera de WinAnsi.
- **Cero dependencias nuevas** — no requirió `npm install` durante el trabajo paralelo.

### Renderizador
`server/src/domain/invoices/pdf-renderer.ts`:
- **Factura**: cabecera de marca, datos del cliente/suscripción/periodo, tabla de conceptos, subtotal/impuestos/total, pie con hash del documento.
- **Recibo**: monto pagado destacado, método y referencia del pago, concepto del periodo.

### Emisión automática
`GenerateInvoiceUseCase` — numeración secuencial por año, totales con impuestos configurables, recibo solo cuando hay pago. Se invoca **automáticamente** dentro de `StartCheckoutUseCase` (MECL-041): cada checkout produce su factura y recibo sin intervención manual.

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/invoices` | Listado con flag `hasReceipt` |
| GET | `/api/v1/invoices/:id/pdf` | Descarga de factura PDF |
| GET | `/api/v1/invoices/:id/receipt/pdf` | Descarga de recibo PDF |

## Frontend
Página `/dashboard/billing`: tabla de facturas con estado (Pagada/Emitida) y botones de descarga de factura y recibo.

## Resultados
- `server/tests/unit/invoice.test.ts` — 5/5 ✅ (totales, numeración, PDF `%PDF-1.4` + `xref` + `%%EOF` válidos)
- E2E: factura listada como `pagada`, recibo disponible, PDF de factura **3.257 bytes** y recibo **2.264 bytes** descargables ✅
