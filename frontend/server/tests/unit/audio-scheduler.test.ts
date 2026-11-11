import { describe, it, expect } from 'vitest'
import { AudioPriorityScheduler } from '../../src/application/services/audio-scheduler.js'
import { EnqueueAudioJobUseCase } from '../../src/application/use-cases/enqueue-audio-job.js'
import { InMemoryAudioJobRepository } from '../../src/infrastructure/billing/in-memory-audio-job-repository.js'
import { InMemorySubscriptionRepository } from '../../src/infrastructure/billing/in-memory-subscription-repository.js'
import { SimulatedAudioProcessor } from '../../src/infrastructure/billing/simulated-audio-processor.js'
import type { AudioJob } from '../../src/domain/audio-jobs/entities.js'
import { newAudioJob } from '../../src/domain/audio-jobs/entities.js'
import type { AudioProcessResult, AudioProcessorPort } from '../../src/domain/audio-jobs/ports.js'
import type { Subscription } from '../../src/domain/billing/entities.js'
import { FakeClock, silentLogger, noopMetrics, sequentialIds, flush } from '../helpers.js'

/** Procesador controlado: permite liberar trabajos a voluntad. */
class ControlledProcessor implements AudioProcessorPort {
  readonly name = 'controlled'
  readonly started: string[] = []
  private readonly resolvers = new Map<string, () => void>()

  async process(job: AudioJob): Promise<AudioProcessResult> {
    this.started.push(job.id)
    await new Promise<void>(resolve => this.resolvers.set(job.id, resolve))
    return { text: `ok:${job.id}`, provider: this.name }
  }

  release(id: string): void {
    this.resolvers.get(id)?.()
  }
}

function makeJob(id: string, plan: 'free' | 'pro' | 'business', priority: 'normal' | 'high'): AudioJob {
  return newAudioJob({
    id,
    userId: `user-${id}`,
    plan,
    priority,
    mediaType: 'audio/webm',
    fileName: `${id}.webm`,
    now: '2026-11-11T12:00:00.000Z',
  })
}

function makeScheduler(processor: AudioProcessorPort, maxConcurrency: number, agingSecondsPerPoint = 5) {
  const jobs = new InMemoryAudioJobRepository()
  const clock = new FakeClock()
  const scheduler = new AudioPriorityScheduler(
    jobs,
    processor,
    clock,
    silentLogger,
    noopMetrics,
    {
      maxConcurrency,
      basePriority: { free: 10, pro: 100, business: 120 },
      agingSecondsPerPoint,
    },
  )
  return { scheduler, jobs, clock }
}

describe('MECL-043 · prioridad de audio para cuentas Pro', () => {
  it('con un slot libre, el trabajo Pro se atiende antes que el Free encolado', async () => {
    const processor = new ControlledProcessor()
    const { scheduler, jobs } = makeScheduler(processor, 1)

    scheduler.enqueue(makeJob('a', 'free', 'normal'))
    await flush()
    expect(processor.started).toEqual(['a'])

    // Se encolan un Free y un Pro mientras 'a' ocupa el único slot
    scheduler.enqueue(makeJob('b-free', 'free', 'normal'))
    scheduler.enqueue(makeJob('c-pro', 'pro', 'high'))

    processor.release('a')
    await flush()
    expect(processor.started).toEqual(['a', 'c-pro']) // el Pro saltó la cola

    processor.release('c-pro')
    await flush()
    expect(processor.started).toEqual(['a', 'c-pro', 'b-free'])

    processor.release('b-free')
    await flush()
    expect((await jobs.findById('c-pro'))?.status).toBe('done')
    expect(scheduler.snapshot().processed).toBe(3)
  })

  it('el aging evita la inanición: un job Free viejo supera a un Pro nuevo', async () => {
    const processor = new ControlledProcessor()
    const { scheduler, clock } = makeScheduler(processor, 1, 1) // 1 punto por segundo

    scheduler.enqueue(makeJob('slow-free', 'free', 'normal'))
    await flush()

    // El Free lleva 200s esperando → prioridad efectiva 10 + 200 = 210 > Pro (100)
    clock.advance(200_000)
    scheduler.enqueue(makeJob('fresh-pro', 'pro', 'high'))

    processor.release('slow-free')
    await flush()
    expect(processor.started).toEqual(['slow-free', 'fresh-pro'])
  })

  it('respeta el límite de concurrencia configurado', async () => {
    const processor = new ControlledProcessor()
    const { scheduler } = makeScheduler(processor, 2)

    for (const id of ['j1', 'j2', 'j3', 'j4']) scheduler.enqueue(makeJob(id, 'free', 'normal'))
    await flush()

    expect(processor.started).toHaveLength(2) // solo 2 corren a la vez
    expect(scheduler.snapshot().queueDepth).toBe(2)
    expect(scheduler.snapshot().running).toBe(2)
  })

  it('un fallo de procesamiento no detiene la cola', async () => {
    const jobs = new InMemoryAudioJobRepository()
    const clock = new FakeClock()
    const failing: AudioProcessorPort = {
      name: 'failing',
      async process(job): Promise<AudioProcessResult> {
        if (job.id === 'bad') throw new Error('provider caído')
        return { text: `ok:${job.id}`, provider: failing.name }
      },
    }
    const scheduler = new AudioPriorityScheduler(jobs, failing, clock, silentLogger, noopMetrics, {
      maxConcurrency: 1,
      basePriority: { free: 10, pro: 100, business: 120 },
      agingSecondsPerPoint: 5,
    })

    scheduler.enqueue(makeJob('bad', 'free', 'normal'))
    await flush()
    expect((await jobs.findById('bad'))?.status).toBe('failed')
    expect(scheduler.snapshot().failed).toBe(1)

    // Siguiente trabajo sigue procesándose
    scheduler.enqueue(makeJob('good', 'pro', 'high'))
    await flush()
    expect(scheduler.snapshot().failed).toBe(1)
  })

  it('la prioridad se resuelve con el Paywall: Pro → high, Free → normal', async () => {
    const subscriptions = new InMemorySubscriptionRepository()
    const jobs = new InMemoryAudioJobRepository()
    const clock = new FakeClock()
    const scheduler = new AudioPriorityScheduler(
      jobs,
      new SimulatedAudioProcessor({ delayMs: 0 }),
      clock,
      silentLogger,
      noopMetrics,
    )
    const uc = new EnqueueAudioJobUseCase(subscriptions, jobs, scheduler, clock, sequentialIds('job'), silentLogger)

    const periodEnd = new Date(clock.now().getTime() + 10 * 86400000).toISOString()
    const proSub: Subscription = {
      id: 's-pro',
      userId: 'user-pro',
      plan: 'pro',
      status: 'active',
      startedAt: '2026-10-19T00:00:00.000Z',
      trialEndsAt: null,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      updatedAt: clock.now().toISOString(),
    }
    await subscriptions.save(proSub)

    const freeJob = await uc.execute({ userId: 'user-free', mediaType: 'audio/webm', fileName: 'a.webm' })
    const proJob = await uc.execute({ userId: 'user-pro', mediaType: 'audio/webm', fileName: 'b.webm' })

    expect(freeJob.ok && proJob.ok).toBe(true)
    if (!freeJob.ok || !proJob.ok) return
    expect(freeJob.value.priority).toBe('normal')
    expect(proJob.value.priority).toBe('high')
    expect(proJob.value.job.plan).toBe('pro')
    expect(freeJob.value.job.plan).toBe('free')
    await flush()
  })
})
