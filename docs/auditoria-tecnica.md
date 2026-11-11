# VYON — Auditoría Técnica (MECL-014)

## Alcance

Auditoría de código en GitHub + configuración de monitoreo 24/7 del servidor.

## Hallazgos corregidos

1. **`server.js` roto**: usaba `require()` en un paquete ESM (`"type": "module"`). Reescrito con `import`.
2. **`lambda.js` roto**: importaba `serverless-http` (no instalado; solo estaba `aws-serverless-express`). Se añadió `serverless-http` y se eliminó la dependencia no usada.
3. **Sin lint config**: el script `lint` referenciaba ESLint pero no existía configuración. Añadido `eslint.config.js` (flat config, TS + React).
4. **Sin tests**: añadido Vitest (unit + integration + load).
5. **Vulnerabilidades npm**: `npm audit` reportaba 11 vulnerabilidades (esbuild/vite, minimatch/typescript-eslint, react-router). Actualizadas a versiones parcheadas → **0 vulnerabilidades**.
6. **Sin monitoreo**: añadidos endpoints `/api/v1/health`, `/api/v1/health/ready`, `/metrics` (Prometheus) y alarmas CloudWatch (errores, p95, throttles) + SNS.
7. **Sin CI**: añadidos workflows de GitHub Actions (lint, typecheck, test, build, audit, CodeQL) y Dependabot.

## Monitoreo 24/7

- **Health probe**: EventBridge Scheduler → `GET /api/v1/health` cada 1 minuto.
- **Métricas**: `prom-client` expone `/metrics` (latencia p95, contadores de análisis/transcripción, memoria).
- **Alarmas CloudWatch**: errores 5xx, latencia p95 > 4s, throttles → SNS → email.
- **Logs**: CloudWatch Log Group con retención 30 días.
- **Latencia objetivo**: p95 < 4s (verificado por load test con autocannon).

## Comandos

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run audit
npm run test:load
```
