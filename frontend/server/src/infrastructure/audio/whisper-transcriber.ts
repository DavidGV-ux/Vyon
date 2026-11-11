import type { TranscriptionPort } from '../../domain/ai/ports.js'
import type { TranscriptionResult, TranscriptSegment } from '../../domain/ai/entities.js'
import { httpPostForm } from '../ai/http-client.js'

export type WhisperTranscriberOptions = {
  readonly apiBase: string
  readonly apiKey: string
  readonly model: string
  readonly language: string
}

export class WhisperTranscriber implements TranscriptionPort {
  readonly name = 'whisper'

  constructor(private readonly options: WhisperTranscriberOptions) {}

  async transcribe(input: {
    readonly audio: Buffer
    readonly mediaType: string
    readonly language?: string
    readonly prompt?: string
    readonly signal?: AbortSignal
  }): Promise<TranscriptionResult> {
    if (!this.options.apiKey) throw new Error('WHISPER_API_KEY not configured')

    const startedAt = performance.now()
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(input.audio)], { type: input.mediaType })
    formData.append('file', blob, 'audio.webm')
    formData.append('model', this.options.model)
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')
    formData.append('language', input.language ?? this.options.language)
    if (input.prompt) formData.append('prompt', input.prompt)

    const result = await httpPostForm(
      `${this.options.apiBase.replace(/\/$/, '')}/audio/transcriptions`,
      { Authorization: `Bearer ${this.options.apiKey}` },
      formData,
      input.signal,
    )
    if (!result.ok) throw result.error

    const data = JSON.parse(result.body) as {
      text: string
      language?: string
      duration?: number
      segments?: { id?: number; start: number; end: number; text: string }[]
    }

    const segments: TranscriptSegment[] = (data.segments ?? []).map((s, i) => ({
      id: s.id ?? i,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }))

    return {
      text: data.text.trim(),
      language: data.language ?? (input.language ?? this.options.language),
      durationSeconds: data.duration ?? 0,
      segments,
      model: this.options.model,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}
