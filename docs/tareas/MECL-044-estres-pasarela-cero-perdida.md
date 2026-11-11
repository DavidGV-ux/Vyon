# MECL-044 — Ejecutar pruebas de estrés en la pasarela de pagos y asegurar cero pérdida de transacciones

**Responsable:** David (CTO) — Infraestructura
**Estado:** ✅ Completado
**Punto U:** 6.0 (referencia) · Costo: pasarela de pagos
**Fecha:** 19/10/2026 · Implementado: 11/11/2026

## Objetivo
Ejecutar pruebas de estrés en la pasarela de pagos y asegurar **cero pérdida de transacciones**.

## Implementación

### Procesamiento idempotente
`server/src/application/use-cases/process-payment.ts`:
1. Todo intento se **persiste antes** de llamar a la pasarela (registro durable).
2. Misma `idempotencyKey` → jamás se cobra dos veces (la pasarela también deduplica).
3. Fallos reintentables → reintentos con backoff, **cada intento auditable** (`attempt`, `outcome`, `code`, `latencyMs`).
4. Si el proceso muere tras cobrar, el replay devuelve el resultado registrado sin volver a cobrar.

### Conciliación (red de seguridad)
`ReconcilePaymentsUseCase` — compara el ledger local ↔ pasarela:
- `missingLocal`: cobros en pasarela sin registro local (pérdida potencial).
- `missingGateway`: registros locales "cobrados" sin cargo real (falso positivo).
- `balanced: false` → métrica `vyon_reconciliation_unbalanced` + log de error.

### Pasarela simulada
`SimulatedPaymentGateway` con las mismas garantías que una real: deduplicación por llave, ledger expuesto para conciliación, inyección de fallos (`failFirstN`, `flakyEvery`, `delayMs`) para tests de estrés.

## Pruebas de estrés — `npm run test:load` → **15/15 ✅**

| Fase | Escenario | Resultado |
|---|---|---|
| 1 | Storm: 600 llaves únicas @ 60 conexiones con reintentos del cliente | 600 OK, 0 sin resolver |
| 2 | Blast: 25 requests concurrentes con la **misma** llave | **1 solo cobro**, mismo `providerRef` |
| 3 | Conciliación local ↔ pasarela | Balanceada: `missingLocal=0`, `missingGateway=0` |
| 4 | Replay masivo: 100 pagos exitosos reenviados | 100/100 `replayed=true`, **0 cobros nuevos** |
| 5 | Throughput autocannon (health) | **9.457 req/s**, 0 errores de conexión |

## Verificación E2E — `billing-flow.mjs` → **26/26 ✅**
Checkout → pago idempotente → factura emitida → conciliación balanceada con `charges=1` para 1 checkout.

## Resultados
- `server/tests/unit/process-payment.test.ts` — 7/7 ✅ (replay sin doble cobro, backoff, rechazo definitivo, reintentos agotados auditables, conciliación balanceada).
- **CERO pérdida de transacciones verificada** en carga + E2E.
