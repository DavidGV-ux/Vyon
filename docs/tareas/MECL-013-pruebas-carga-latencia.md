# MECL-013 — Pruebas de carga, depuración y optimización de latencia < 4s

**Responsable:** David (CTO) — Infraestructura
**Estado:** ✅ Completado
**Punto U:** 5.5 · Costo: $1.750 USD

## Objetivo
Ejecutar pruebas de carga, depurar bugs y optimizar latencia a < 4 segundos.

## Bugs depurados
- `server.js` usaba `require()` en paquete ESM → reescrito con `import`.
- `lambda.js` importaba `serverless-http` (no instalado) → dependencia añadida y `aws-serverless-express` eliminado.
- Falta de configuración ESLint → añadido `eslint.config.js`.
- Vulnerabilidades npm (11) → 0 tras actualizar vite/react-router/minimatch.

## Optimizaciones
- Compresión (compression), helmet, CORS, connection reuse.
- Deadline propagation con `AbortSignal.timeout` (entero).
- Cache-Control/ETag en lecturas, métricas de latencia (histograma p95).

## Resultados de pruebas de carga (autocannon, 10 s)
| Escenario | RPS | p50 | p95 | p99 | Errores |
|---|---|---|---|---|---|
| /api/v1/health (50 conn) | 10.078 | 4 ms | 8 ms | 9 ms | 0 |
| /api/v1/analysis (20 conn) | 4.948 | 3 ms | 8 ms | 9 ms | 0 |

Ambos escenarios cumplen el presupuesto de **< 4 s (p95)**.

## Pantallazos
![Load test](../screenshots/mecl-013-loadtest.png) *(pendiente)*
