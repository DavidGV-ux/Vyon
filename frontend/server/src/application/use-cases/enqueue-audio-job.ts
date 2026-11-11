import type { AudioJob } from '../../domain/audio-jobs/entities.js'
import { newAudioJob } from '../../domain/audio-jobs/entities.js'
import type { AudioJobRepositoryPort } from '../../domain/audio-jobs/ports.js'
import type { SubscriptionRepositoryPort } from '../../domain/billing/ports.js'
import { Paywall } from '../../domain/billing/services/paywall.js'
import type { AudioPriorityScheduler } from '../services/audio-scheduler.js'
import type { Clock, IdGenerator, Logger } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok } from '../../domain/shared/result.js'
import type { AppError } from '../../domain/shared/errors.js'

export type EnqueueAudioJobInput = {
  readonly userId: string
  readonly mediaType: string
  readonly fileName: string
}

export type EnqueueAudioJobOutput = {
  readonly job: AudioJob
  readonly priority: AudioJob['priority']
  readonly reason: string
}

/**
 * Encola trabajos de audio resolviendo la prioridad con el Paywall:
 * cuentas Pro obtienen prioridad alta de proceso (MECL-043).
 */
export class EnqueueAudioJobUseCase {
  private readonly paywall = new Paywall()

  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly jobs: AudioJobRepositoryPort,
    private readonly scheduler: AudioPriorityScheduler,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async execute(input: EnqueueAudioJobInput): Promise<Result<EnqueueAudioJobOutput, AppError>> {
    const now = this.clock.now()
    const subscription = await this.subscriptions.findByUserId(input.userId)
    const decision = this.paywall.evaluate(subscription, 'audio_priority', now)

    const priority = decision.allowed ? 'high' : 'normal'
    const plan = decision.verification.plan ?? 'free'

    const job = newAudioJob({
      id: this.idGenerator.next(),
      userId: input.userId,
      plan,
      priority,
      mediaType: input.mediaType,
      fileName: input.fileName,
      now: now.toISOString(),
    })

    await this.jobs.save(job)
    this.scheduler.enqueue(job)

    this.logger.info('audio job scheduled', { jobId: job.id, userId: input.userId, priority, plan })
    return ok({ job, priority, reason: decision.reason })
  }
}
