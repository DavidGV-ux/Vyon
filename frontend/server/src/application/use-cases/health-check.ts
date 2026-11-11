import type { AnalysisRepositoryPort } from '../../domain/ai/ports.js'
import type { Clock } from '../../domain/shared/ports.js'

export type HealthStatus = 'ok' | 'degraded' | 'down'

export type HealthReport = {
  readonly status: HealthStatus
  readonly uptimeMs: number
  readonly timestamp: string
  readonly checks: Readonly<Record<string, { ok: boolean; detail?: string }>>
  readonly version: string
}

export class HealthCheckUseCase {
  private readonly startedAt: number

  constructor(
    private readonly clock: Clock,
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly version: string,
  ) {
    this.startedAt = clock.monotonicMs()
  }

  async execute(): Promise<HealthReport> {
    const checks: Record<string, { ok: boolean; detail?: string }> = {}
    let allOk = true

    try {
      await this.analysisRepository.count()
      checks.storage = { ok: true }
    } catch (error) {
      checks.storage = { ok: false, detail: String(error) }
      allOk = false
    }

    checks.memory = { ok: process.memoryUsage().heapUsed < 512 * 1024 * 1024 }

    return {
      status: allOk ? 'ok' : 'degraded',
      uptimeMs: this.clock.monotonicMs() - this.startedAt,
      timestamp: this.clock.now().toISOString(),
      checks,
      version: this.version,
    }
  }
}
