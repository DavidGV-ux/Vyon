# MECL-012 — Pipeline de Whisper API para transcripción en tiempo real

**Responsable:** David (CTO) — Tecnología
**Estado:** ✅ Completado
**Punto U:** 4.3 · Costo: $1.400 USD

## Objetivo
Integrar el pipeline de Whisper API para transcripción de audio a texto en tiempo real.

## Implementación
- `WhisperTranscriber` (adaptador) → OpenAI Audio Transcriptions API (multipart, `verbose_json`, segmentos con timestamps).
- Endpoint síncrono `POST /api/v1/transcription` (base64).
- Endpoint streaming `POST /api/v1/transcription/stream` (SSE sobre un único POST con cuerpo octet-stream).
- `ChunkAccumulator` agrega chunks, detecta límites de silencio (VAD-lite por RMS) y dispara transcripciones parciales.
- Frontend: hook `useAudioRecorder` (MediaRecorder) + página Asistente IA.
- Configurable vía `WHISPER_API_BASE`, `WHISPER_API_KEY`, `WHISPER_MODEL`, `WHISPER_LANGUAGE`.

## Resultados de pruebas
- Tests unitarios: `chunk-accumulator` (4) ✅.
- Build del servidor ✅ (tsc sin errores).
- Latencia p95 del endpoint de salud: 8 ms (sin carga de IA externa).

## Pantallazos
![Grabación de audio](../screenshots/mecl-012-recording.png) *(pendiente)*
![Transcripción SSE](../screenshots/mecl-012-stream.png) *(pendiente)*
