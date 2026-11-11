import type { TranscriptionPort, AnalysisRepositoryPort, MasterPromptRepositoryPort, AiProviderPort } from '../../domain/ai/ports.js'
import type { Clock, Logger, MetricsPort } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError } from '../../domain/shared/errors.js'
import type { OutputParserPort } from '../ports/output-parser.js'
import { AnalyzeDocumentUseCase } from './analyze-document.js'
import type { MultimodalInput } from '../../domain/ai/entities.js'
import type { TranscriptionResult } from '../../domain/ai/entities.js'
import type { OutputKind } from '../../domain/ai/value-objects.js'
import type { ParsedDocument } from '../../domain/ai/entities.js'

export type TranscribeAudioInput = {
  readonly audio: Buffer
  readonly mediaType: string
  readonly language?: string
  readonly prompt?: string
  readonly analyze?: { readonly outputKind: OutputKind }
}

export type TranscribeAudioOutput = {
  readonly transcription: TranscriptionResult
  readonly analysis?: ParsedDocument
}

export class TranscribeAudioUseCase {
  private readonly analyzeUseCase: AnalyzeDocumentUseCase | null

  constructor(
    private readonly transcription: TranscriptionPort,
    analyzeDeps: {
      promptRepository: MasterPromptRepositoryPort
      aiProvider: AiProviderPort
      analysisRepository: AnalysisRepositoryPort
      outputParser: OutputParserPort
      clock: Clock
      idGenerator: { next(): string }
      logger: Logger
      metrics: MetricsPort
    } | null,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly metrics: MetricsPort,
  ) {
    this.analyzeUseCase = analyzeDeps
      ? new AnalyzeDocumentUseCase(
          analyzeDeps.promptRepository,
          analyzeDeps.aiProvider,
          analyzeDeps.analysisRepository,
          analyzeDeps.outputParser,
          analyzeDeps.clock,
          analyzeDeps.idGenerator,
          analyzeDeps.logger,
          analyzeDeps.metrics,
        )
      : null
  }

  async execute(input: TranscribeAudioInput): Promise<Result<TranscribeAudioOutput, AppError>> {
    const startedAt = this.clock.monotonicMs()
    let transcription: TranscriptionResult
    try {
      transcription = await this.transcription.transcribe({
        audio: input.audio,
        mediaType: input.mediaType,
        language: input.language,
        prompt: input.prompt,
      })
    } catch (error) {
      this.logger.error('transcription failed', { error: String(error) })
      this.metrics.increment('vyon_transcription_total', { status: 'failed' })
      return err(new AppError({ code: 'TRANSCRIPTION_ERROR', message: error instanceof Error ? error.message : 'Transcription failed', retryable: true }))
    }
    this.metrics.increment('vyon_transcription_total', { status: 'success' })
    this.metrics.observe('vyon_transcription_latency_ms', this.clock.monotonicMs() - startedAt)

    let analysis: ParsedDocument | undefined
    if (input.analyze && this.analyzeUseCase) {
      const language = input.language === 'en' ? 'en' : 'es'
      const multimodalInput: MultimodalInput = {
        parts: [{ kind: 'text', text: transcription.text }],
        language,
      }
      const result = await this.analyzeUseCase.execute({
        outputKind: input.analyze.outputKind,
        input: multimodalInput,
      })
      if (result.ok) analysis = result.value
    }

    return ok({ transcription, analysis })
  }
}
