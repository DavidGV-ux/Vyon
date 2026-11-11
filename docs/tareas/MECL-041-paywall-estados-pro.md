# MECL-041 — Desplegar la lógica de Paywall automatizado y verificación de estados Pro v1.2

**Responsable:** David (CTO) — Tecnología
**Estado:** ✅ Completado
**Punto U:** 4.5 · Costo: $1.250 USD + $250 USD = $1.500 USD
**Fecha:** 19/10/2026 (tarea) · Implementado: 11/11/2026

## Objetivo
Desplegar la lógica de Paywall automatizado y la verificación de estados Pro v1.2 en producción.

## Implementación

### Máquina de estados Pro v1.2
`server/src/domain/billing/services/pro-state.ts` — 8 estados con verificación pura y determinista:

| Estado | Acceso | Descripción |
|---|---|---|
| `PRO_ACTIVE` | ✅ | Suscripción pagada dentro del periodo vigente |
| `PRO_TRIALING` | ✅ | Prueba Pro vigente |
| `PRO_CANCELED` | ✅ | Cancelada pero dentro del periodo pagado |
| `PRO_PAST_DUE` | ❌ | En dunning — acceso suspendido (regla estricta v1.2) |
| `PRO_EXPIRED` | ❌ | Periodo o prueba vencido sin renovación |
| `PRO_TERMINATED` | ❌ | Cancelada inmediatamente |
| `FREE_PLAN` | ❌ | Sin plan de pago |
| `SUBSCRIPTION_NOT_FOUND` | ❌ | Sin suscripción registrada |

La verificación devuelve además `daysRemaining`, `currentPeriodEnd` y `version: "1.2"`.

### Paywall automatizado
`server/src/domain/billing/services/paywall.ts`:
- Evaluación por feature: `unlimited_projects`, `audio_priority`, `pdf_invoices`, `api_access` (plan mínimo: Pro).
- Límites por plan (Free: 3 proyectos / 50 tareas; Pro/Business: ilimitado).
- `PaywallDeniedError` con HTTP **402** y detalle `{feature, requiredPlan, currentPlan, state}`.

### Casos de uso
- `VerifyProStateUseCase` — verificación que nunca falla por "no encontrado" (ese es un estado válido).
- `StartCheckoutUseCase` — flujo automatizado: checkout → pago idempotente → suscripción activa → factura emitida.
- `HandleBillingWebhookUseCase` — webhook con firma **HMAC-SHA256** (`timingSafeEqual`): `payment.failed` → `past_due` (bloquea acceso), `payment.succeeded` → renueva periodo, `subscription.canceled` → termina.

### Frontend
- `BillingContext` — estado Pro, `can(feature)`, checkout y modal de paywall.
- `src/components/Paywall.tsx` — modal con checkout in-place y estado actual de verificación.
- Gating en Dashboard: botón "Nueva tarea" bloqueado para Free.
- Ruta `/dashboard/billing` en el sidebar.

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/billing/state` | Estado Pro + features + límites |
| GET | `/api/v1/billing/plans` | Planes disponibles |
| POST | `/api/v1/billing/checkout` | Checkout automatizado (201) |
| POST | `/api/v1/billing/webhook` | Webhook firmado de pasarela |

## Resultados
- `server/tests/unit/pro-state.test.ts` — 10/10 ✅
- `server/tests/unit/paywall.test.ts` — 7/7 ✅
- `server/tests/unit/checkout-webhook.test.ts` — 9/9 ✅
- E2E `billing-flow.mjs`: estado inicial `SUBSCRIPTION_NOT_FOUND` → checkout → `PRO_ACTIVE` → features desbloqueadas ✅
