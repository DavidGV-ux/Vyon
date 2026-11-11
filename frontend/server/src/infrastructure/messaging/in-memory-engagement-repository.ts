import type { EngagementRepositoryPort } from '../../domain/messaging/ports.js'
import type { EngagementProfile } from '../../domain/messaging/entities.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Persistencia en memoria para el mockup. Sustituible por un adaptador
 * Supabase/Postgres sin tocar el dominio (puerto EngagementRepositoryPort).
 */
export class InMemoryEngagementRepository implements EngagementRepositoryPort {
  private readonly store = new Map<string, EngagementProfile>()

  async save(profile: EngagementProfile): Promise<void> {
    this.store.set(profile.userId, profile)
  }

  async findById(userId: string): Promise<EngagementProfile | null> {
    return this.store.get(userId) ?? null
  }

  async findInactive(thresholdDays: number, now: Date): Promise<EngagementProfile[]> {
    const cutoff = now.getTime() - thresholdDays * MS_PER_DAY
    return [...this.store.values()].filter((profile) => {
      const last = Date.parse(profile.lastActivityAt)
      return !Number.isNaN(last) && last <= cutoff
    })
  }

  async count(): Promise<number> {
    return this.store.size
  }
}
