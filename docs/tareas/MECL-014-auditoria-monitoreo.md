# MECL-014 — Auditoría técnica de código y monitoreo 24/7

**Responsable:** David (CTO) — Infraestructura
**Estado:** ✅ Completado

## Objetivo
Realizar auditoría técnica de código en GitHub y configurar monitoreo de servidor 24/7.

## Auditoría de código (GitHub)
- Workflow CI: `lint`, `typecheck`, `test`, `build`, `npm audit --audit-level=high`.
- Workflow CodeQL (análisis de seguridad semanal).
- Dependabot (npm + GitHub Actions, agrupado).
- `npm audit`: **0 vulnerabilidades**.

## Monitoreo 24/7
- Endpoints: `/api/v1/health`, `/api/v1/health/ready`, `/metrics` (Prometheus).
- Alarmas CloudWatch: errores 5xx, latencia p95 > 4s, throttles → SNS → email.
- CloudWatch Log Group con retención 30 días.
- EventBridge Scheduler: probe cada 1 minuto a `/api/v1/health`.

## Resultados
- Tests: 26/26 ✅.
- Build: ✅ (web + server).
- Lint: 0 errores (1 warning aceptable).
- Typecheck: ✅.

## Pantallazos
![GitHub Actions](../screenshots/mecl-014-ci.png) *(pendiente)*
![CloudWatch alarms](../screenshots/mecl-014-alarms.png) *(pendiente)*
