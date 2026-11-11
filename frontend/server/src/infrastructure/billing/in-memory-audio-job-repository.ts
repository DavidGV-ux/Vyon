import type { AudioJob } from '../../domain/audio-jobs/entities.js'
import type { AudioJobRepositoryPort } from '../../domain/audio-jobs/ports.js'

export class InMemoryAudioJobRepository implements AudioJobRepositoryPort {
  private readonly byId = new Map<string, AudioJob>()
  private readonly byUser = new Map<string, string[]>()

  async save(job: AudioJob): Promise<void> {
    this.byId.set(job.id, job)
    const list = this.byUser.get(job.userId) ?? []
    if (!list.includes(job.id)) list.push(job.id)
    this.byUser.set(job.userId, list)
  }

  async findById(id: string): Promise<AudioJob | null> {
    return this.byId.get(id) ?? null
  }

  async listByUser(userId: string, limit = 50): Promise<AudioJob[]> {
    const ids = this.byUser.get(userId) ?? []
    return ids
      .slice(-limit)
      .reverse()
      .map(id => this.byId.get(id))
      .filter((j): j is AudioJob => Boolean(j))
  }
}
