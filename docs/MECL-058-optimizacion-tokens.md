# MECL-058 — Optimización del consumo de tokens (margen bruto >85%)

**Fecha:** 11/11/2026 · **Alcance:** pipeline de análisis de IA (AnalyzeDocumentUseCase).

---

## 1. Objetivo

Reducir el costo por llamada a la API de IA de modo que el **margen bruto del
producto supere el 85%**, midiendo el costo real con métricas y evitando
llamadas redundantes al proveedor.

## 2. Mecanismos implementados

### 2.1 Cache de análisis idénticos (evita llamadas)

- **Clave:** `sha256(outputKind + strictness + language + context + workspaceId + projectId + parts)`.
- **Adaptador:** `InMemoryAnalysisCache` — LRU con TTL configurable
  (`AI_CACHE_TTL_MS`, `AI_CACHE_MAX_ENTRIES`).
- **Puerto:** `AnalysisCachePort` (domain) → el adaptador se puede sustituir por
  Redis/DynamoDB sin tocar la lógica de negocio.
- **Efecto:** una repetición de la misma entrada devuelve el resultado en
  caché **sin consumir tokens de entrada ni de salida**.

### 2.2 Presupuestos de tokens por tipo de análisis

Antes todas las llamadas usaban `maxTokens: 2048` fijo. Ahora cada `outputKind`
tiene su propio techo (`maxTokensByKind`):

| Kind | Default | Env |
|---|---|---|
| `resumenes` | 1200 | `AI_MAX_TOKENS_RESUMENES` |
| `tareas` | 1600 | `AI_MAX_TOKENS_TAREAS` |
| `finanzas` | 1600 | `AI_MAX_TOKENS_FINANZAS` |
| fallback | 2048 | `AI_MAX_TOKENS` |

Reduce la salida generada (y facturada) sin sacrificar la calidad (el
calibrado garantiza que la respuesta pase el validador Zod).

### 2.3 Control de costos medible (margen >85%)

- **`TokenCostService`** (domain): tabla de precios USD por millón de tokens
  input/output por modelo → estima el costo de cada llamada.
- **Métricas** emitidas en cada generación:
  - `vyon_ai_tokens_input_total{model}`
  - `vyon_ai_tokens_output_total{model}`
  - `vyon_ai_cost_usd_total{model}` ← **costo acumulado en USD**
  - `vyon_ai_cache_hits_total{kind}` / `vyon_ai_cache_misses_total{kind}`

#### Cómo verificar el margen

1. Ingresos del periodo (facturación) → `I`.
2. Costo de IA del periodo → sumar `vyon_ai_cost_usd_total` (Prometheus/Grafana
   o `curl /metrics`).
3. Margen bruto = `(I − Costo_IA) / I × 100`.

Para `margen ≥ 85%` se requiere `Costo_IA ≤ 0.15 × I`. Con `gpt-4o-mini`
($0.15/M input, $0.60/M output), el costo típico de una llamada (<2K tokens de
salida) queda en el orden de **< $0.0015**, lo que da amplio margen incluso con
planes de bajo ticket.

## 3. Configuración

| Variable | Default | Descripción |
|---|---|---|
| `AI_CACHE_TTL_MS` | `1800000` (30 min) | TTL del cache de análisis |
| `AI_CACHE_MAX_ENTRIES` | `200` | Capacidad LRU |
| `AI_MAX_TOKENS_RESUMENES` | `1200` | Presupuesto por kind |
| `AI_MAX_TOKENS_TAREAS` | `1600` | Presupuesto por kind |
| `AI_MAX_TOKENS_FINANZAS` | `1600` | Presupuesto por kind |

## 4. Puntos de extensión

- **Precios:** actualizar `DEFAULT_PRICING` en
  `domain/ai/services/token-cost.ts` al cambiar de modelo (o inyectar precios
  desde config/env).
- **Cache distribuido:** implementar `AnalysisCachePort` sobre Redis para
  lambdas múltiples (hoy el cache es por instancia en memoria).

## 5. Tests

`server/tests/unit/analysis-cache-and-token-cost.test.ts`:
- hit/miss, expiración TTL, eviction LRU;
- cálculo de costo por modelo, fallback de precios y costo cero del provider
  determinista.

## 6. Verificación

```bash
npm run typecheck   # ✅
npm run lint        # ✅ 0 errores
npm run test        # ✅ 104 tests
npm run build       # ✅ web + server
```
