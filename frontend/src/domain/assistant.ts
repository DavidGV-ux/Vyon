export type OutputKind = 'finanzas' | 'tareas' | 'resumenes'

export type MultimodalInput = {
  text?: string
  image?: { mediaType: string; base64: string }
  audio?: { mediaType: string; base64: string; durationSeconds?: number }
}

export type AnalysisResult = {
  requestId: string
  outputKind: OutputKind
  provider: string
  model: string
  data: unknown
  calibration: { score: number; passed: boolean; attempts: number; issues: { code: string; message: string; severity: string }[] }
  latencyMs: number
}
