# MECL-043 — Optimizar la prioridad de velocidad de procesamiento de audio en backend para cuentas Pro

**Responsable:** David (CTO) — Infraestructura
**Estado:** ✅ Completado
**Punto U:** 5.5 · Costo: $1.500 USD + $250 USD = $1.750 USD
**Fecha:** 19/10/2026 (Implementado: 11/11/2026)

## Objetivo
Optimizar la prioridad de velocidad de procesamiento de audio en backend para cuentas Pro.

## Implementación

### Cola con prioridad
`server/src/application/services/audio-scheduler.ts` — `AudioPriorityScheduler`:
- **Cola única con pesos por plan**: Business 120 > Pro 100 > Free 10.
- **Aging anti-inanición**: 5 s de espera = 1 punto extra — un job Free viejo supera a uno Pro recién llegado (nadie muere de inanición).
- **Concurrencia limitada** configurable (`maxConcurrency`, slots según límite del plan).
- Métricas: `vyon_audio_jobs_total`, `vyon_audio_queue_wait_ms`, snapshot con espera media por plan.

### Resolución de prioridad con el Paywall
`EnqueueAudioJobUseCase` evalúa `audio_priority` vía el Paywall (MECL-041):
- Suscriptor Pro/Business vigente → prioridad **high**.
- Free / sin suscripción / dunning → prioridad **normal**.

### Procesamiento
- `AudioProcessorPort` — adapter desacoplado; listo para conectar el `TranscribeAudioUseCase` del dominio AI **sin tocar sus archivos**.
- Adapter simulado `SimulatedAudioProcessor` con latencia y fallo configurables.
- Estados del job: `queued → running → done | failed`; un fallo no detiene la cola.

## API
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/audio/jobs` | Encola trabajo (202) resolviendo prioridad |
| GET | `/api/v1/audio/jobs` | Historial del usuario |
| GET | `/api/v1/audio/jobs/:id` | Estado de un trabajo |
| GET | `/api/v1/audio/stats` | Snapshot de la cola |

## Frontend
Panel "Procesamiento de audio" en `/dashboard/billing`: cola/activos/procesados, espera media Pro vs Free, badge "Prioridad Pro" y botón de encolado demo.

## Resultados
- `server/tests/unit/audio-scheduler.test.ts` — 5/5 ✅:
  - Pro salta la cola sobre Free encolado.
  - Aging: Free de 200 s supera a Pro nuevo.
  - Respeta el límite de concurrencia.
  - Fallo no detiene la cola.
  - Paywall asigna `high` a Pro y `normal` a Free.
- E2E: job Pro → `priority: high` (202); job Free → `priority: normal`; trabajos procesados ≥ 2 ✅
