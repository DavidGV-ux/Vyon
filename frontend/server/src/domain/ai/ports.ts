import type { MultimodalPart, ParsedData, ParsedDocument, TranscriptionResult } from './entities.js'
import type { OutputKind } from './value-objects.js'

export type AiGenerationRequest = {
  readonly systemPrompt: string
  readonly userPrompt: string
  readonly parts: readonly MultimodalPart[]
  readonly maxTokens: number
  readonly temperature: number
  readonly responseFormat?: 'json'
  readonly signal?: AbortSignal
}

export type AiGenerationResult = {
  readonly text: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly latencyMs: number
}

export interface AiProviderPort {
  readonly name: string
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>
}

export interface TranscriptionPort {
  readonly name: string
  transcribe(input: {
    readonly audio: Buffer
    readonly mediaType: string
    readonly language?: string
    readonly prompt?: string
    readonly signal?: AbortSignal
  }): Promise<TranscriptionResult>
}

export type MasterPromptTemplate = {
  readonly version: string
  readonly outputKind: OutputKind
  readonly systemPrompt: string
  readonly userPromptTemplate: string
  readonly schema: Record<string, unknown>
  readonly calibrationThreshold: number
}

export interface MasterPromptRepositoryPort {
  getActive(outputKind: OutputKind): Promise<MasterPromptTemplate>
  listVersions(outputKind: OutputKind): Promise<string[]>
}

export type StoredAnalysis = {
  readonly id: string
  readonly requestId: string
  readonly outputKind: OutputKind
  readonly provider: string
  readonly model: string
  readonly data: ParsedData
  readonly calibration: { readonly score: number; readonly passed: boolean }
  readonly createdAt: string
}

export interface AnalysisRepositoryPort {
  save(analysis: StoredAnalysis): Promise<void>
  findById(id: string): Promise<StoredAnalysis | null>
  list(limit: number, offset: number): Promise<StoredAnalysis[]>
  count(): Promise<number>
}

export interface AnalysisCachePort {
  get(key: string): Promise<ParsedDocument | null>
  set(key: string, value: ParsedDocument): Promise<void>
}
