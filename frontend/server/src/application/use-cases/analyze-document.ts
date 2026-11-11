import type { AiProviderPort, MasterPromptRepositoryPort, AnalysisRepositoryPort, AnalysisCachePort } from '../../domain/ai/ports.js'
import type { Clock, IdGenerator, Logger, MetricsPort } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError, ValidationError, DeadlineExceededError } from '../../domain/shared/errors.js'
import type { OutputParserPort } from '../ports/output-parser.js'
import { MasterPromptBuilder } from '../../domain/ai/services/master-prompt-builder.js'
import { CalibrationService } from '../../domain/ai/services/calibration.js'
import { extractJson } from '../../domain/ai/services/json-extractor.js'
import type { TokenCostService } from '../../domain/ai/services/token-cost.js'
import type { MultimodalInput, ParsedDocument } from '../../domain/ai/entities.js'
import type { OutputKind, Strictness } from '../../domain/ai/value-objects.js'
import { isOutputKind } from '../../domain/ai/value-objects.js'
import { createHash } from 'node:crypto'

export type AnalyzeDocumentInput = {
  readonly outputKind: OutputKind
  readonly strictness?: Strictness
  readonly input: MultimodalInput
  readonly deadlineMs?: number
  readonly maxAttempts?: number
}

export type AnalyzeDocumentUseCaseOptions = {
  readonly cache?: AnalysisCachePort
  readonly tokenCost?: TokenCostService
  readonly maxTokensByKind?: Record<string, number>
}

function buildCacheKey(input: AnalyzeDocumentInput): string {
  const payload = JSON.stringify({
    outputKind: input.outputKind,
    strictness: input.strictness ?? 'balanced',
    language: input.input.language,
    context: input.input.context ?? '',
    workspaceId: input.input.workspaceId ?? '',
    projectId: input.input.projectId ?? '',
    parts: input.input.parts,
  })
  return createHash('sha256').update(payload).digest('hex')
}

export class AnalyzeDocumentUseCase {
  private readonly builder = new MasterPromptBuilder()
  private readonly calibration = new CalibrationService()
  private readonly cache?: AnalysisCachePort
  private readonly tokenCost?: TokenCostService
  private readonly maxTokensByKind?: Record<string, number>

  constructor(
    private readonly promptRepository: MasterPromptRepositoryPort,
    private readonly aiProvider: AiProviderPort,
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly outputParser: OutputParserPort,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger,
    private readonly metrics: MetricsPort,
    options: AnalyzeDocumentUseCaseOptions = {},
  ) {
    this.cache = options.cache
    this.tokenCost = options.tokenCost
    this.maxTokensByKind = options.maxTokensByKind
  }

  async execute(input: AnalyzeDocumentInput): Promise<Result<ParsedDocument, AppError>> {
    if (!isOutputKind(input.outputKind)) {
      return err(new ValidationError(`Unsupported output kind: ${String(input.outputKind)}`))
    }
    const strictness: Strictness = input.strictness ?? 'balanced'
    const maxAttempts = input.maxAttempts ?? 2
    const requestId = this.idGenerator.next()
    const deadline = input.deadlineMs !== undefined ? this.clock.monotonicMs() + input.deadlineMs : undefined

    if (this.cache) {
      const cached = await this.cache.get(buildCacheKey(input))
      if (cached) {
        this.metrics.increment('vyon_ai_cache_hits_total', { kind: input.outputKind })
        this.logger.info('analysis cache hit', { kind: input.outputKind })
        return ok(cached)
      }
      this.metrics.increment('vyon_ai_cache_misses_total', { kind: input.outputKind })
    }

    let lastIssues: string[] = []
    let lastRaw = ''
    let attempts = 0

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (deadline !== undefined && this.clock.monotonicMs() > deadline) {
        return err(new DeadlineExceededError('Request budget exceeded before attempt', { attempt }))
      }
      attempts = attempt
      const template = await this.promptRepository.getActive(input.outputKind)
      const prompt = this.builder.build(template, input.input, strictness)

      let userPrompt = prompt.userPrompt
      if (lastIssues.length > 0) {
        userPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastIssues.join('\n')}\nFix these issues and re-emit a single valid JSON object.`
      }

      const startedAt = this.clock.monotonicMs()
      const maxTokens = this.maxTokensByKind?.[input.outputKind] ?? 2048
      let generation
      try {
        generation = await this.aiProvider.generate({
          systemPrompt: prompt.systemPrompt,
          userPrompt,
          parts: input.input.parts,
          maxTokens,
          temperature: attempt === 1 ? 0.2 : 0.1,
          responseFormat: 'json',
          signal: deadline !== undefined ? AbortSignal.timeout(Math.max(100, Math.round(deadline - this.clock.monotonicMs()))) : undefined,
        })
      } catch (error) {
        this.logger.warn('ai generation failed', { attempt, error: String(error) })
        lastIssues = [`AI generation failed: ${error instanceof Error ? error.message : String(error)}`]
        continue
      }
      const latencyMs = this.clock.monotonicMs() - startedAt
      lastRaw = generation.text

      this.metrics.increment('vyon_ai_tokens_input_total', { model: generation.model }, generation.inputTokens)
      this.metrics.increment('vyon_ai_tokens_output_total', { model: generation.model }, generation.outputTokens)
      if (this.tokenCost) {
        const costUsd = this.tokenCost.costUsd(generation.model, generation.inputTokens, generation.outputTokens)
        this.metrics.increment('vyon_ai_cost_usd_total', { model: generation.model }, costUsd)
      }

      const extracted = extractJson(generation.text)
      if (!extracted.ok) {
        lastIssues = [`JSON extraction failed: ${extracted.reason}`]
        this.logger.warn('json extraction failed', { attempt, reason: extracted.reason })
        continue
      }

      const parsed = this.outputParser.parse(input.outputKind, extracted.value)
      if (!parsed.ok) {
        lastIssues = [parsed.error.message]
        this.logger.warn('output parse failed', { attempt, error: parsed.error.message })
        continue
      }

      const calibration = this.calibration.calibrate({ outputKind: input.outputKind, data: parsed.value })
      const finalCalibration = { ...calibration, attempts }

      if (calibration.passed) {
        const createdAt = this.clock.now().toISOString()
        const stored = {
          id: this.idGenerator.next(),
          requestId,
          outputKind: input.outputKind,
          provider: this.aiProvider.name,
          model: generation.model,
          data: parsed.value,
          calibration: { score: finalCalibration.score, passed: finalCalibration.passed },
          createdAt,
        }
        await this.analysisRepository.save(stored)
        this.metrics.increment('vyon_analysis_total', { kind: input.outputKind, status: 'success' })
        this.metrics.observe('vyon_analysis_latency_ms', latencyMs, { kind: input.outputKind })

        const result: ParsedDocument = {
          requestId,
          outputKind: input.outputKind,
          provider: this.aiProvider.name,
          model: generation.model,
          data: parsed.value,
          calibration: { ...finalCalibration, attempts },
          rawResponse: lastRaw,
          latencyMs,
          createdAt,
        }
        if (this.cache) await this.cache.set(buildCacheKey(input), result)
        return ok(result)
      }

      lastIssues = calibration.issues.map((i) => `${i.code}: ${i.message}`)
      this.logger.info('calibration below threshold', { attempt, score: calibration.score, issues: lastIssues })
    }

    this.metrics.increment('vyon_analysis_total', { kind: input.outputKind, status: 'failed' })
    return err(
      new AppError({
        code: 'AI_INVALID_RESPONSE',
        message: `Failed to produce a valid ${input.outputKind} document after ${attempts} attempt(s)`,
        details: { issues: lastIssues, raw: lastRaw.slice(0, 500) },
        retryable: true,
      }),
    )
  }
}
