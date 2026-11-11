# MECL-011 — Calibrar el Prompt Maestro Multimodal

**Responsable:** David (CTO) — Tecnología
**Estado:** ✅ Completado
**Punto U:** 4.5 · Costo: $1.500 USD

## Objetivo
Calibrar el Prompt Maestro Multimodal con un parser JSON que produzca salidas estructuradas para **Finanzas**, **Tareas** y **Resúmenes**.

## Implementación
- Plantillas versionadas en `frontend/server/prompts/master.v1.json` (una por `outputKind`).
- `MasterPromptBuilder` compone system + user prompt inyectando schema, idioma, strictness y contexto.
- `extractJson` (dominio, puro) tolera fences markdown, prosa, comas finales y comentarios.
- `ZodOutputParser` valida y normaliza con zod (recomputa totales financieros).
- `CalibrationService` calcula score 0–1 + issues; si < 0.7 reintenta con prompt de reparación (max 2 intentos).
- Caso de uso `AnalyzeDocumentUseCase` orquesta todo y persiste en `AnalysisRepositoryPort`.
- Endpoint `POST /api/v1/analysis` (auth opcional).

## Resultados de pruebas
- Tests unitarios: `json-extractor` (7), `output-parser` (5), `master-prompt-builder` (1), `analyze-document` (3) — todos ✅.
- Test de integración HTTP: análisis devuelve 200 con `calibration.passed = true`.
- Latencia p95 del análisis (provider determinístico): 8 ms.

## Pantallazos
![Health](../screenshots/mecl-011-health.png) *(pendiente de captura en entorno desplegado)*
![Análisis exitoso](../screenshots/mecl-011-analysis.png) *(pendiente)*
