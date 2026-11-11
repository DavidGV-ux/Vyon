import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { z } from 'zod'
import type { Clock, IdGenerator, Logger, MetricsPort } from '../domain/shared/ports.js'
import { ValidationError } from '../domain/shared/errors.js'
import { PLANS } from '../domain/billing/entities.js'
import type { FeatureKey } from '../domain/billing/services/paywall.js'
import { FEATURE_LABELS, Paywall } from '../domain/billing/services/paywall.js'
import { VerifyProStateUseCase } from '../application/use-cases/verify-pro-state.js'
import { StartCheckoutUseCase } from '../application/use-cases/start-checkout.js'
import { HandleBillingWebhookUseCase } from '../application/use-cases/handle-billing-webhook.js'
import { GenerateInvoiceUseCase } from '../application/use-cases/generate-invoice.js'
import { ProcessPaymentUseCase } from '../application/use-cases/process-payment.js'
import { ReconcilePaymentsUseCase } from '../application/use-cases/reconcile-payments.js'
import { EnqueueAudioJobUseCase } from '../application/use-cases/enqueue-audio-job.js'
import { AudioPriorityScheduler, DEFAULT_SCHEDULER_CONFIG } from '../application/services/audio-scheduler.js'
import { InMemorySubscriptionRepository } from '../infrastructure/billing/in-memory-subscription-repository.js'
import { InMemoryInvoiceRepository, InMemoryReceiptRepository } from '../infrastructure/billing/in-memory-invoice-repository.js'
import { InMemoryPaymentRepository } from '../infrastructure/billing/in-memory-payment-repository.js'
import { InMemoryAudioJobRepository } from '../infrastructure/billing/in-memory-audio-job-repository.js'
import { SimulatedPaymentGateway } from '../infrastructure/billing/simulated-payment-gateway.js'
import type { SimulatedGatewayOptions } from '../infrastructure/billing/simulated-payment-gateway.js'
import { SimulatedAudioProcessor } from '../infrastructure/billing/simulated-audio-processor.js'
import { LogEventPublisher } from '../infrastructure/billing/log-event-publisher.js'
import { InvoicePdfRenderer } from '../domain/invoices/pdf-renderer.js'
import { isAppError } from '../domain/shared/errors.js'

export type BillingModuleDeps = {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly logger: Logger
  readonly metrics: MetricsPort
  readonly corsOrigin?: string
  readonly webhookSecret?: string
  readonly schedulerConcurrency?: number
  readonly gatewayOptions?: SimulatedGatewayOptions
  readonly audioDelayMs?: number
}

export type BillingModule = {
  readonly router: express.Router
  readonly scheduler: AudioPriorityScheduler
  readonly gateway: SimulatedPaymentGateway
  readonly subscriptions: InMemorySubscriptionRepository
  readonly invoices: InMemoryInvoiceRepository
  readonly receipts: InMemoryReceiptRepository
  readonly payments: InMemoryPaymentRepository
  readonly jobs: InMemoryAudioJobRepository
  readonly paywall: Paywall
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

const ah =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next)
  }

function resolveUserId(req: Request): string {
  const header = req.headers['x-user-id']
  const fromHeader = typeof header === 'string' && header.length > 0 ? header : undefined
  const bodyUserId = typeof req.body === 'object' && req.body ? (req.body as { userId?: unknown }).userId : undefined
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined
  const userId = fromHeader ?? (typeof bodyUserId === 'string' ? bodyUserId : undefined) ?? queryUserId
  if (!userId) {
    throw new ValidationError('Se requiere userId (header x-user-id, body o query).')
  }
  return userId
}

const checkoutSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(['pro', 'business']),
  customerEmail: z.string().email().optional(),
  idempotencyKey: z.string().min(8).optional(),
})

const paymentSchema = z.object({
  userId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  idempotencyKey: z.string().min(8),
  method: z.string().optional(),
})

const audioJobSchema = z.object({
  userId: z.string().min(1).optional(),
  mediaType: z.string().default('audio/webm'),
  fileName: z.string().default('audio.webm'),
})

/**
 * Módulo de billing/paywall/facturación/pagos/audio (MECL-041..044).
 * Se monta en el servidor HTTP principal como router independiente.
 */
export function createBillingModule(deps: BillingModuleDeps): BillingModule {
  const { clock, idGenerator, logger, metrics } = deps
  const webhookSecret = deps.webhookSecret ?? process.env.BILLING_WEBHOOK_SECRET ?? 'vyon-dev-secret'

  // --- Adaptadores ---
  const subscriptions = new InMemorySubscriptionRepository()
  const invoices = new InMemoryInvoiceRepository()
  const receipts = new InMemoryReceiptRepository()
  const payments = new InMemoryPaymentRepository()
  const jobs = new InMemoryAudioJobRepository()
  const gateway = new SimulatedPaymentGateway({ delayMs: 3, flakyEvery: 7, ...deps.gatewayOptions })
  const events = new LogEventPublisher(logger)
  const paywall = new Paywall()

  // --- Casos de uso ---
  const verifyProStateUC = new VerifyProStateUseCase(subscriptions, clock)
  const processPaymentUC = new ProcessPaymentUseCase({
    repository: payments,
    gateway,
    clock,
    idGenerator,
    logger: logger.child({ module: 'payments' }),
    metrics,
    maxAttempts: 3,
    retryDelayMs: 20,
  })
  const generateInvoiceUC = new GenerateInvoiceUseCase(invoices, receipts, clock, idGenerator, 0)
  const startCheckoutUC = new StartCheckoutUseCase(
    subscriptions,
    processPaymentUC,
    generateInvoiceUC,
    events,
    clock,
    idGenerator,
    logger.child({ module: 'checkout' }),
  )
  const webhookUC = new HandleBillingWebhookUseCase(subscriptions, events, clock, logger.child({ module: 'webhook' }))
  const reconcileUC = new ReconcilePaymentsUseCase(payments, gateway, clock, logger.child({ module: 'reconcile' }), metrics)
  const invoiceRenderer = new InvoicePdfRenderer()

  const scheduler = new AudioPriorityScheduler(
    jobs,
    new SimulatedAudioProcessor({ delayMs: deps.audioDelayMs ?? 40 }),
    clock,
    logger.child({ module: 'audio-scheduler' }),
    metrics,
    { ...DEFAULT_SCHEDULER_CONFIG, maxConcurrency: deps.schedulerConcurrency ?? DEFAULT_SCHEDULER_CONFIG.maxConcurrency },
  )
  const enqueueAudioUC = new EnqueueAudioJobUseCase(
    subscriptions,
    jobs,
    scheduler,
    clock,
    idGenerator,
    logger.child({ module: 'audio' }),
  )

  // --- Router ---
  const router = express.Router()
  router.use(cors({ origin: deps.corsOrigin ?? 'http://localhost:5173', credentials: true }))

  // Webhook con body crudo: la firma HMAC se calcula sobre el payload exacto.
  router.post(
    '/billing/webhook',
    express.raw({ type: '*/*', limit: '1mb' }),
    ah(async (req, res) => {
      const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body ?? {})
      const result = await webhookUC.execute({
        payload,
        signature: req.headers['x-vyon-signature'] as string | undefined,
        secret: webhookSecret,
      })
      if (!result.ok) {
        res.status(result.error.status).json(result.error.toJSON())
        return
      }
      res.json(result.value)
    }),
  )

  router.use(express.json({ limit: '1mb' }))

  // ---------- MECL-041: estados Pro + paywall ----------
  router.get(
    '/billing/state',
    ah(async (req, res) => {
      const userId = resolveUserId(req)
      const result = await verifyProStateUC.execute(userId)
      if (!result.ok) {
        res.status(result.error.status).json(result.error.toJSON())
        return
      }
      const subscription = await subscriptions.findByUserId(userId)
      const now = clock.now()
      const features = Object.fromEntries(
        (Object.keys(FEATURE_LABELS) as FeatureKey[]).map(feature => [
          feature,
          paywall.evaluate(subscription, feature, now).allowed,
        ]),
      ) as Record<FeatureKey, boolean>
      const plan = result.value.plan ? PLANS[result.value.plan] : PLANS.free

      res.json({
        userId,
        state: result.value,
        plan,
        limits: plan.limits,
        features,
        featureLabels: FEATURE_LABELS,
        subscription,
      })
    }),
  )

  router.get('/billing/plans', (_req, res) => {
    res.json({ plans: Object.values(PLANS) })
  })

  router.post(
    '/billing/checkout',
    ah(async (req, res) => {
      const body = checkoutSchema.parse(req.body)
      const result = await startCheckoutUC.execute(body)
      if (!result.ok) {
        res.status(result.error.status).json(result.error.toJSON())
        return
      }
      res.status(201).json(result.value)
    }),
  )

  // ---------- MECL-042: facturas y recibos PDF ----------
  router.get(
    '/invoices',
    ah(async (req, res) => {
      const userId = resolveUserId(req)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)))
      const offset = Math.max(0, Number(req.query.offset ?? 0))
      const items = await invoices.listByUser(userId, limit, offset)
      const withFlags = await Promise.all(
        items.map(async invoice => ({
          ...invoice,
          hasReceipt: (await receipts.findByInvoice(invoice.id)) !== null,
        })),
      )
      res.json({ items: withFlags, total: withFlags.length, limit, offset })
    }),
  )

  router.get(
    '/invoices/:id/pdf',
    ah(async (req, res) => {
      const invoice = await invoices.findById(String(req.params.id))
      if (!invoice) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Factura no encontrada' } })
        return
      }
      const rendered = invoiceRenderer.renderInvoice(invoice)
      res.setHeader('Content-Type', rendered.contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${rendered.fileName}"`)
      res.send(rendered.bytes)
    }),
  )

  router.get(
    '/invoices/:id/receipt/pdf',
    ah(async (req, res) => {
      const invoice = await invoices.findById(String(req.params.id))
      if (!invoice) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Factura no encontrada' } })
        return
      }
      const receipt = await receipts.findByInvoice(invoice.id)
      if (!receipt) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recibo no encontrado para esta factura' } })
        return
      }
      const rendered = invoiceRenderer.renderReceipt(receipt, invoice)
      res.setHeader('Content-Type', rendered.contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${rendered.fileName}"`)
      res.send(rendered.bytes)
    }),
  )

  // ---------- MECL-044: pasarela de pagos idempotente ----------
  router.post(
    '/payments',
    ah(async (req, res) => {
      const body = paymentSchema.parse(req.body)
      const result = await processPaymentUC.execute({ ...body, userId: body.userId ?? resolveUserId(req) })
      if (!result.ok) {
        res.status(result.error.status).json(result.error.toJSON())
        return
      }
      res.status(result.value.replayed ? 200 : 201).json(result.value)
    }),
  )

  router.get(
    '/payments',
    ah(async (req, res) => {
      const userId = resolveUserId(req)
      const items = await payments.listByUser(userId, 50, 0)
      res.json({ items, total: items.length })
    }),
  )

  router.get(
    '/payments/reconciliation',
    ah(async (_req, res) => {
      const result = await reconcileUC.execute()
      if (!result.ok) {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: result.error.message } })
        return
      }
      res.json(result.value)
    }),
  )

  // ---------- MECL-043: cola de audio con prioridad Pro ----------
  router.post(
    '/audio/jobs',
    ah(async (req, res) => {
      const body = audioJobSchema.parse(req.body)
      const result = await enqueueAudioUC.execute({ ...body, userId: body.userId ?? resolveUserId(req) })
      if (!result.ok) {
        res.status(result.error.status).json(result.error.toJSON())
        return
      }
      res.status(202).json(result.value)
    }),
  )

  router.get(
    '/audio/jobs',
    ah(async (req, res) => {
      const userId = resolveUserId(req)
      const items = await jobs.listByUser(userId)
      res.json({ items, total: items.length })
    }),
  )

  router.get(
    '/audio/jobs/:id',
    ah(async (req, res) => {
      const job = await jobs.findById(String(req.params.id))
      if (!job) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trabajo de audio no encontrado' } })
        return
      }
      res.json(job)
    }),
  )

  router.get('/audio/stats', (_req, res) => {
    res.json(scheduler.snapshot())
  })

  // Errores de validación zod → AppError
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      const error = new ValidationError('Payload inválido', err.issues)
      res.status(error.status).json(error.toJSON())
      return
    }
    if (isAppError(err)) {
      res.status(err.status).json(err.toJSON())
      return
    }
    logger.error('billing module error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  })

  return { router, scheduler, gateway, subscriptions, invoices, receipts, payments, jobs, paywall }
}
