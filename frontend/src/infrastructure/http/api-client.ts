import type { AnalysisPort, OutputKind, MultimodalInput, AnalysisResult } from '../../application/analyze-document.js'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export class ApiClient implements AnalysisPort {
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  async analyze(input: { outputKind: OutputKind; input: MultimodalInput; language?: string }): Promise<AnalysisResult> {
    const parts: unknown[] = []
    if (input.input.text) parts.push({ kind: 'text', text: input.input.text })
    if (input.input.image) parts.push({ kind: 'image', ...input.input.image })
    if (input.input.audio) parts.push({ kind: 'audio', ...input.input.audio })
    return this.request<AnalysisResult>('/api/v1/analysis', {
      method: 'POST',
      body: JSON.stringify({
        outputKind: input.outputKind,
        language: input.language ?? 'es',
        text: input.input.text,
        image: input.input.image,
        audio: input.input.audio,
      }),
    })
  }

  async transcribe(audioBase64: string, mediaType: string, language?: string): Promise<{ text: string; language: string; durationSeconds: number }> {
    const res = await this.request<{ transcription: { text: string; language: string; durationSeconds: number } }>('/api/v1/transcription', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, mediaType, language }),
    })
    return res.transcription
  }
}
