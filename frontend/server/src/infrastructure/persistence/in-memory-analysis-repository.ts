import type { AnalysisRepositoryPort, StoredAnalysis } from '../../domain/ai/ports.js'

export class InMemoryAnalysisRepository implements AnalysisRepositoryPort {
  private readonly store = new Map<string, StoredAnalysis>()
  private readonly order: string[] = []

  async save(analysis: StoredAnalysis): Promise<void> {
    this.store.set(analysis.id, analysis)
    this.order.unshift(analysis.id)
  }

  async findById(id: string): Promise<StoredAnalysis | null> {
    return this.store.get(id) ?? null
  }

  async list(limit: number, offset: number): Promise<StoredAnalysis[]> {
    return this.order.slice(offset, offset + limit).map((id) => this.store.get(id)!).filter(Boolean)
  }

  async count(): Promise<number> {
    return this.store.size
  }
}
