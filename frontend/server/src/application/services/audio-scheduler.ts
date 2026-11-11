import type { AudioJob } from '../../domain/audio-jobs/entities.js'
import type {
  AudioJobRepositoryPort,
  AudioProcessorPort,
  AudioSchedulerSnapshot,
} from '../../domain/audio-jobs/ports.js'
import type { Clock, Logger, MetricsPort } from '../../domain/shared/ports.js'

export type AudioSchedulerConfig = {
  readonly maxConcurrency: number
  /** Puntos de prioridad por plan: Pro/Business entran antes que Free. */
  readonly basePriority: Record<'free' | 'pro' | 'business', number>
  /** Segundos de espera que equivalen a 1 punto extra (anti-inanición). */
  readonly agingSecondsPerPoint: number
}

export const DEFAULT_SCHEDULER_CONFIG: AudioSchedulerConfig = {
  maxConcurrency: 2,
  basePriority: { free: 10, pro: 100, business: 120 },
  agingSecondsPerPoint: 5,
}

type QueuedItem = {
  readonly job: AudioJob
  readonly enqueuedMonotonicMs: number
}

/**
 * Cola con prioridad para procesamiento de audio (MECL-043):
 *
 * - Los usuarios Pro/Business entran con prioridad alta y se atienden
 *   antes que los trabajos Free (misma cola, distinto peso).
 * - Envejecimiento (aging) por tiempo de espera: nadie muere de inanición,
 *   un job Free suficientemente viejo supera a uno Pro recién llegado.
 * - Concurrencia limitada con slots dedicados según límite del plan.
 */
export class AudioPriorityScheduler {
  private readonly queue: QueuedItem[] = []
  private running = 0
  private processed = 0
  private failed = 0
  private waitSamples: { pro: number[]; free: number[] } = { pro: [], free: [] }
  private readonly inFlight = new Set<string>()

  constructor(
    private readonly jobs: AudioJobRepositoryPort,
    private readonly processor: AudioProcessorPort,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly metrics: MetricsPort,
    private readonly config: AudioSchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
  ) {}

  enqueue(job: AudioJob): void {
    this.queue.push({ job, enqueuedMonotonicMs: this.clock.monotonicMs() })
    this.metrics.increment('vyon_audio_jobs_total', { priority: job.priority, event: 'enqueued' })
    this.logger.info('audio job enqueued', { jobId: job.id, priority: job.priority, plan: job.plan })
    this.schedule()
  }

  get queueDepth(): number {
    return this.queue.length
  }

  get runningCount(): number {
    return this.running
  }

  snapshot(): AudioSchedulerSnapshot {
    const avg = (samples: number[]) =>
      samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : 0
    const proSamples = this.waitSamples.pro
    const freeSamples = this.waitSamples.free
    return {
      queueDepth: this.queue.length,
      running: this.running,
      maxConcurrency: this.config.maxConcurrency,
      processed: this.processed,
      failed: this.failed,
      avgWaitMs: { pro: avg(proSamples), free: avg(freeSamples) },
      jobsByPriority: {
        high: this.queue.filter(i => i.job.priority === 'high').length,
        normal: this.queue.filter(i => i.job.priority === 'normal').length,
      },
    }
  }

  /** Prioridad efectiva = base del plan + puntos por espera (aging). */
  effectivePriority(item: QueuedItem, nowMs: number): number {
    const base = this.config.basePriority[item.job.plan]
    const waitedSeconds = Math.max(0, (nowMs - item.enqueuedMonotonicMs) / 1000)
    return base + waitedSeconds / this.config.agingSecondsPerPoint
  }

  private schedule(): void {
    while (this.running < this.config.maxConcurrency && this.queue.length > 0) {
      const nowMs = this.clock.monotonicMs()
      let bestIndex = 0
      let bestScore = -Infinity
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i] as QueuedItem
        const score = this.effectivePriority(item, nowMs)
        if (score > bestScore) {
          bestScore = score
          bestIndex = i
        }
      }
      const [picked] = this.queue.splice(bestIndex, 1)
      if (!picked) break
      void this.run(picked)
    }
  }

  private async run(item: QueuedItem): Promise<void> {
    const { job } = item
    this.running += 1
    this.inFlight.add(job.id)

    const waitedMs = Math.max(0, this.clock.monotonicMs() - item.enqueuedMonotonicMs)
    const bucket = job.plan === 'free' ? this.waitSamples.free : this.waitSamples.pro
    bucket.push(waitedMs)
    if (bucket.length > 500) bucket.shift()

    const started: AudioJob = { ...job, status: 'running', startedAt: this.clock.now().toISOString() }
    await this.jobs.save(started)
    this.metrics.observe('vyon_audio_queue_wait_ms', waitedMs, { priority: job.priority })

    try {
      const result = await this.processor.process(started)
      const done: AudioJob = {
        ...started,
        status: 'done',
        finishedAt: this.clock.now().toISOString(),
        transcript: result.text,
      }
      await this.jobs.save(done)
      this.processed += 1
      this.metrics.increment('vyon_audio_jobs_total', { priority: job.priority, event: 'done' })
      this.logger.info('audio job done', { jobId: job.id, waitedMs })
    } catch (error) {
      const failed: AudioJob = {
        ...started,
        status: 'failed',
        finishedAt: this.clock.now().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }
      await this.jobs.save(failed)
      this.failed += 1
      this.metrics.increment('vyon_audio_jobs_total', { priority: job.priority, event: 'failed' })
      this.logger.error('audio job failed', { jobId: job.id, error: String(error) })
    } finally {
      this.running -= 1
      this.inFlight.delete(job.id)
      this.schedule()
    }
  }

  isRunning(jobId: string): boolean {
    return this.inFlight.has(jobId)
  }
}
