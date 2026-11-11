import type { OutputKind, MultimodalInput, AnalysisResult } from '../domain/assistant.js'
export type { OutputKind, MultimodalInput, AnalysisResult }

export interface AnalysisPort {
  analyze(input: { outputKind: OutputKind; input: MultimodalInput; language?: string }): Promise<AnalysisResult>
  transcribe(audioBase64: string, mediaType: string, language?: string): Promise<{ text: string; language: string; durationSeconds: number }>
}

export class AnalyzeDocumentUseCase {
  constructor(private readonly port: AnalysisPort) {}
  async run(outputKind: OutputKind, input: MultimodalInput, language = 'es'): Promise<AnalysisResult> {
    return this.port.analyze({ outputKind, input, language })
  }
}
