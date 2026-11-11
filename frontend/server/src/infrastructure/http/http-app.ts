import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import type { AppConfig } from '../config/config.js'
import type { Logger } from '../../domain/shared/ports.js'
import type { MetricsPort } from '../../domain/shared/ports.js'
import type { MetricsRegistry } from '../observability/metrics.js'
import type { AnalysisRepositoryPort, MasterPromptRepositoryPort, AiProviderPort, TranscriptionPort, AnalysisCachePort } from '../../domain/ai/ports.js'
import type { Clock, IdGenerator } from '../../domain/shared/ports.js'
import type { AuthPort } from '../auth/supabase-auth.js'
import type { TokenCostService } from '../../domain/ai/services/token-cost.js'
import { requestContextMiddleware } from './middleware/request-context.js'
import { notFoundHandler, errorHandler } from './middleware/error-handler.js'
import { makeAuthMiddleware } from './middleware/auth.js'
import { rateLimit } from './middleware/rate-limit.js'
import { ZodOutputParser } from '../ai/output-parser.js'
import { AnalyzeDocumentUseCase } from '../../application/use-cases/analyze-document.js'
import { TranscribeAudioUseCase } from '../../application/use-cases/transcribe-audio.js'
import { HealthCheckUseCase } from '../../application/use-cases/health-check.js'
import { z } from 'zod'

const analyzeBodySchema = z.object({
  outputKind: z.enum(['finanzas', 'tareas', 'resumenes']),
  strictness: z.enum(['relaxed', 'balanced', 'strict']).optional(),
  language: z.enum(['es', 'en']).optional(),
  context: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  text: z.string().optional(),
  image: z.object({ mediaType: z.string(), base64: z.string() }).optional(),
  audio: z.object({ mediaType: z.string(), base64: z.string(), durationSeconds: z.number().optional() }).optional(),
  deadlineMs: z.number().int().positive().optional(),
})

export type HttpAppDeps = {
  readonly config: AppConfig
  readonly logger: Logger
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly metrics: MetricsPort
  readonly metricsRegistry: MetricsRegistry
  readonly promptRepository: MasterPromptRepositoryPort
  readonly aiProvider: AiProviderPort
  readonly transcription: TranscriptionPort
  readonly analysisRepository: AnalysisRepositoryPort
  readonly auth: AuthPort
  readonly analysisCache?: AnalysisCachePort
  readonly tokenCost?: TokenCostService
  readonly version: string
}

export function createHttpApp(deps: HttpAppDeps): express.Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(compression())

  // CORS: allowlist desde env (coma-separado). '*' → reflejar origen sin
  // credenciales; lista explícita → credenciales habilitadas (MECL-057).
  const configuredOrigins = deps.config.corsOrigin.split(',').map((value) => value.trim()).filter(Boolean)
  const allowAnyOrigin = configuredOrigins.length === 0 || configuredOrigins.includes('*')
  app.use(cors(allowAnyOrigin ? { origin: true, credentials: false } : { origin: configuredOrigins, credentials: true }))

  app.use(requestContextMiddleware(deps.logger))

  // Raw stream endpoint must bypass JSON body parser
  app.use('/api/v1/transcription/stream', express.raw({ type: '*/*', limit: '50mb' }))

  app.use(express.json({ limit: '10mb', type: 'application/json' }))
  app.use(express.urlencoded({ extended: false }))

  const authMiddleware = makeAuthMiddleware(deps.auth, deps.config.authRequired)

  const outputParser = new ZodOutputParser()
  const analyzeUseCase = new AnalyzeDocumentUseCase(
    deps.promptRepository,
    deps.aiProvider,
    deps.analysisRepository,
    outputParser,
    deps.clock,
    deps.idGenerator,
    deps.logger,
    deps.metrics,
    { cache: deps.analysisCache, tokenCost: deps.tokenCost, maxTokensByKind: deps.config.ai.maxTokensByKind },
  )
  const transcribeUseCase = new TranscribeAudioUseCase(
    deps.transcription,
    {
      promptRepository: deps.promptRepository,
      aiProvider: deps.aiProvider,
      analysisRepository: deps.analysisRepository,
      outputParser,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      logger: deps.logger,
      metrics: deps.metrics,
    },
    deps.clock,
    deps.logger,
    deps.metrics,
  )
  const healthUseCase = new HealthCheckUseCase(deps.clock, deps.analysisRepository, deps.version)

  const analysisRateLimit = rateLimit({ windowMs: 60_000, max: 30 })
  const transcriptionRateLimit = rateLimit({ windowMs: 60_000, max: 20 })

  // Health
  app.get('/api/v1/health', async (_req, res, next) => {
    try {
      const report = await healthUseCase.execute()
      res.status(report.status === 'ok' ? 200 : 503).json(report)
    } catch (error) {
      next(error)
    }
  })
  app.get('/api/v1/health/ready', async (_req, res, next) => {
    try {
      const report = await healthUseCase.execute()
      res.status(report.status === 'ok' ? 200 : 503).json({ ready: report.status === 'ok', ...report })
    } catch (error) {
      next(error)
    }
  })

  // Metrics
  app.get('/metrics', async (_req, res) => {
    if (!deps.config.metricsEnabled) {
      res.status(404).end()
      return
    }
    res.setHeader('Content-Type', deps.metricsRegistry.registry.contentType)
    res.end(await deps.metricsRegistry.registry.metrics())
  })

  // Meta
  app.get('/api/v1/meta', (_req, res) => {
    res.json({ version: deps.version, nodeEnv: deps.config.nodeEnv, provider: deps.config.ai.provider })
  })

  // Analysis
  app.post('/api/v1/analysis', authMiddleware, analysisRateLimit, async (req, res, next) => {
    try {
      const body = analyzeBodySchema.parse(req.body)
      const parts: { kind: string; [key: string]: unknown }[] = []
      if (body.text) parts.push({ kind: 'text', text: body.text })
      if (body.image) parts.push({ kind: 'image', mediaType: body.image.mediaType, base64: body.image.base64 })
      if (body.audio) parts.push({ kind: 'audio', mediaType: body.audio.mediaType, base64: body.audio.base64, durationSeconds: body.audio.durationSeconds })

      if (parts.length === 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide at least one of text, image or audio' } })
        return
      }

      const result = await analyzeUseCase.execute({
        outputKind: body.outputKind,
        strictness: body.strictness,
        input: {
          parts: parts as never,
          language: body.language ?? 'es',
          context: body.context,
          workspaceId: body.workspaceId,
          projectId: body.projectId,
        },
        deadlineMs: body.deadlineMs ?? deps.config.requestBudgetMs,
      })

      if (!result.ok) {
        const status = result.error.status
        res.status(status).json(result.error.toJSON())
        return
      }
      res.json(result.value)
    } catch (error) {
      next(error)
    }
  })

  // List analyses
  app.get('/api/v1/analyses', authMiddleware, async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)))
      const offset = Math.max(0, Number(req.query.offset ?? 0))
      const items = await deps.analysisRepository.list(limit, offset)
      const total = await deps.analysisRepository.count()
      res.json({ items, total, limit, offset })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/v1/analyses/:id', authMiddleware, async (req, res, next) => {
    try {
      const item = await deps.analysisRepository.findById(String(req.params.id))
      if (!item) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } })
        return
      }
      res.json(item)
    } catch (error) {
      next(error)
    }
  })

  // Transcription (multipart-ish: accept base64 JSON for simplicity + raw stream)
  app.post('/api/v1/transcription', authMiddleware, transcriptionRateLimit, async (req, res, next) => {
    try {
      const body = z.object({
        audioBase64: z.string(),
        mediaType: z.string().default('audio/webm'),
        language: z.string().optional(),
        prompt: z.string().optional(),
        analyze: z.object({ outputKind: z.enum(['finanzas', 'tareas', 'resumenes']) }).optional(),
      }).parse(req.body)

      const audio = Buffer.from(body.audioBase64, 'base64')
      const result = await transcribeUseCase.execute({
        audio,
        mediaType: body.mediaType,
        language: body.language,
        prompt: body.prompt,
        analyze: body.analyze,
      })
      if (!result.ok) {
        res.status(result.error.status).json(result.error.toJSON())
        return
      }
      res.json(result.value)
    } catch (error) {
      next(error)
    }
  })

  // Streaming transcription (SSE over a single POST with octet-stream body)
  app.post('/api/v1/transcription/stream', authMiddleware, transcriptionRateLimit, async (req, res, next) => {
    try {
      const mediaType = (req.headers['content-type'] as string) || 'audio/webm'
      const language = (req.query.language as string) || undefined
      const chunks: Buffer[] = []
      const accumulator = new (await import('../audio/chunk-accumulator.js')).ChunkAccumulator({
        partialIntervalMs: 4000,
        minPartialBytes: 32 * 1024,
        silenceRmsThreshold: 200,
      })

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const send = (event: string, data: unknown): void => {
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        const { shouldTranscribePartial } = accumulator.append({ data: chunk, timestampMs: performance.now() })
        if (shouldTranscribePartial) {
          const buffer = accumulator.getBuffer()
          deps.transcription.transcribe({ audio: buffer, mediaType, language }).then((r) => {
            send('partial', { text: r.text, latencyMs: r.latencyMs })
          }).catch((e: unknown) => {
            send('error', { message: String(e) })
          })
        }
      })

      req.on('end', async () => {
        try {
          const finalBuffer = Buffer.concat(chunks)
          const result = await deps.transcription.transcribe({ audio: finalBuffer, mediaType, language })
          send('final', result)
        } catch (e) {
          send('error', { message: String(e) })
        } finally {
          res.end()
        }
      })

      req.on('error', (e) => {
        send('error', { message: String(e) })
        res.end()
      })
    } catch (error) {
      next(error)
    }
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
