import { describe, it, expect } from 'vitest'
import { InMemoryAnalysisCache } from '../../src/infrastructure/ai/in-memory-analysis-cache.js'
import { TokenCostService } from '../../src/domain/ai/services/token-cost.js'
import type { ParsedDocument } from '../../src/domain/ai/entities.js'

function doc(id: string): ParsedDocument {
  return {
    requestId: id,
    outputKind: 'resumenes',
    provider: 'deterministic',
    model: 'deterministic',
    data: { title: 't', summary: 's', keyPoints: [], actionItems: [], sentiment: 'neutral', entities: [], topics: [] },
    calibration: { score: 1, passed: true, attempts: 1, issues: [], repairs: [] },
    rawResponse: '{}',
    latencyMs: 1,
    createdAt: '2026-11-11T12:00:00.000Z',
  }
}

describe('InMemoryAnalysisCache', () => {
  it('stores and returns values', async () => {
    const cache = new InMemoryAnalysisCache({ maxEntries: 10, ttlMs: 1000 })
    await cache.set('a', doc('a'))
    expect((await cache.get('a'))?.requestId).toBe('a')
  })

  it('expires entries after the ttl', async () => {
    let now = 0
    const cache = new InMemoryAnalysisCache({ maxEntries: 10, ttlMs: 1000 }, () => now)
    await cache.set('a', doc('a'))
    now = 1001
    expect(await cache.get('a')).toBeNull()
  })

  it('evicts the least recently used entry beyond maxEntries', async () => {
    const cache = new InMemoryAnalysisCache({ maxEntries: 2, ttlMs: 60_000 })
    await cache.set('a', doc('a'))
    await cache.set('b', doc('b'))
    await cache.get('a') // refresh LRU order of 'a'
    await cache.set('c', doc('c'))
    expect(await cache.get('b')).toBeNull()
    expect(await cache.get('a')).not.toBeNull()
    expect(await cache.get('c')).not.toBeNull()
  })
})

describe('TokenCostService', () => {
  it('computes cost for a known model', () => {
    const service = new TokenCostService()
    // gpt-4o-mini: 1M input = $0.15, 1M output = $0.60
    expect(service.costUsd('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6)
    expect(service.costUsd('gpt-4o-mini', 100_000, 50_000)).toBeCloseTo(0.045, 6)
  })

  it('falls back to mini pricing for unknown models', () => {
    const service = new TokenCostService()
    expect(service.costUsd('unknown-model', 1_000_000, 0)).toBeCloseTo(0.15, 6)
  })

  it('returns zero for the deterministic provider', () => {
    const service = new TokenCostService()
    expect(service.costUsd('deterministic', 1_000_000, 1_000_000)).toBe(0)
  })
})
