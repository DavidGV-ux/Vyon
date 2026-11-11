import type { AnalysisCachePort } from '../../domain/ai/ports.js'
import type { ParsedDocument } from '../../domain/ai/entities.js'

type CacheEntry = {
  readonly value: ParsedDocument
  readonly expiresAt: number
}

export type InMemoryAnalysisCacheOptions = {
  readonly maxEntries?: number
  readonly ttlMs?: number
}

/**
 * Cache LRU con TTL para análisis idénticos (MECL-058). Evita re-llamar al
 * proveedor de IA cuando la misma entrada (kind + strictness + input) se
 * repite, reduciendo tokens de entrada y costo.
 */
export class InMemoryAnalysisCache implements AnalysisCachePort {
  private readonly store = new Map<string, CacheEntry>()
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(options: InMemoryAnalysisCacheOptions = {}, now: () => number = Date.now) {
    this.maxEntries = options.maxEntries ?? 200
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000
    this.now = now
  }

  private evict(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  async get(key: string): Promise<ParsedDocument | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key)
      return null
    }
    // re-insert to refresh LRU order
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value
  }

  async set(key: string, value: ParsedDocument): Promise<void> {
    this.store.delete(key)
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs })
    this.evict()
  }

  get size(): number {
    return this.store.size
  }
}
