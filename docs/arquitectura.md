# VYON — Arquitectura Hexagonal

## Visión

VYON evoluciona de un mockup SPA a una plataforma con backend propio siguiendo
**Arquitectura Hexagonal (Ports & Adapters)**. El dominio no depende de frameworks,
proveedores de IA ni de la infraestructura de despliegue.

## Capas

```
server/src/
├── domain/          # Núcleo: entidades, value objects, servicios de dominio, puertos (interfaces)
│   ├── shared/      # Result, AppError, Clock, Logger, IdGenerator, MetricsPort
│   ├── ai/          # MasterPrompt, calibración, entidades de salida
│   ├── finance/     # (reservado) entidades financieras
│   ├── task/        # (reservado) entidades de tarea
│   └── summary/     # (reservado) entidades de resumen
├── application/     # Casos de uso + puertos de salida (OutputParserPort, AnalysisRepositoryPort)
├── infrastructure/  # Adaptadores: HTTP (Express), IA (Anthropic/OpenAI/Deterministic),
│   │                # Whisper, persistencia in-memory, observabilidad, auth
└── composition/     # Composition root (container) + bootstrap (server, lambda)
```

## Puertos principales

- `AiProviderPort` — generación de texto multimodal
- `TranscriptionPort` — Whisper / audio → texto
- `MasterPromptRepositoryPort` — plantillas versionadas del Prompt Maestro
- `AnalysisRepositoryPort` — persistencia de análisis
- `OutputParserPort` — validación JSON con zod
- `AuthPort` — verificación de JWT (Supabase)
- `Clock`, `Logger`, `IdGenerator`, `MetricsPort` — infraestructura transversal

## Flujo: MECL-011 (Prompt Maestro Multimodal)

1. `AnalyzeDocumentUseCase.execute(request)`
2. `MasterPromptRepositoryPort.getActive(outputKind)` → plantilla versionada
3. `MasterPromptBuilder.build(template, input, strictness)` → system + user prompt
4. `AiProviderPort.generate(...)` con deadline (AbortSignal)
5. `extractJson` (tolerante a fences/prosa/comas finales)
6. `OutputParserPort.parse` (zod) → datos tipados
7. `CalibrationService.calibrate` → score + issues
8. Si falla → reintento con prompt de reparación (max 2)
9. Persistencia + métricas

## Flujo: MECL-012 (Whisper)

- `POST /api/v1/transcription` (base64) o `POST /api/v1/transcription/stream` (SSE)
- `WhisperTranscriber` → OpenAI Audio Transcriptions API (multipart, verbose_json)
- `ChunkAccumulator` agrega chunks y detecta límites de silencio (VAD-lite)

## Convenciones

- Código en inglés, UI en español.
- `Result<T, E>` en lugar de excepciones para casos de uso.
- Errores tipados (`AppError` con `code` y `status`).
- Sin `any`. `noUncheckedIndexedAccess` activo.
- Imports con extensión `.js` (ESM NodeNext).
- Tests con Vitest; load tests con autocannon.
