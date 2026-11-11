import { describe, it, expect } from 'vitest'
import { ChunkAccumulator } from '../../src/infrastructure/audio/chunk-accumulator.js'

describe('ChunkAccumulator', () => {
  it('accumulates bytes', () => {
    const acc = new ChunkAccumulator({ partialIntervalMs: 100000, minPartialBytes: 1000, silenceRmsThreshold: 10 })
    const r = acc.append({ data: Buffer.alloc(100), timestampMs: 0 })
    expect(r.shouldTranscribePartial).toBe(false)
    expect(acc.size).toBe(100)
  })

  it('triggers partial after interval and bytes', () => {
    const acc = new ChunkAccumulator({ partialIntervalMs: 100, minPartialBytes: 50, silenceRmsThreshold: 10 })
    acc.append({ data: Buffer.alloc(60), timestampMs: 0 })
    const r = acc.append({ data: Buffer.alloc(60), timestampMs: 200 })
    expect(r.shouldTranscribePartial).toBe(true)
  })

  it('resets state', () => {
    const acc = new ChunkAccumulator({ partialIntervalMs: 100000, minPartialBytes: 1000, silenceRmsThreshold: 10 })
    acc.append({ data: Buffer.alloc(100), timestampMs: 0 })
    acc.reset()
    expect(acc.size).toBe(0)
  })

  it('getBuffer concatenates', () => {
    const acc = new ChunkAccumulator({ partialIntervalMs: 100000, minPartialBytes: 1000, silenceRmsThreshold: 10 })
    acc.append({ data: Buffer.from([1, 2]), timestampMs: 0 })
    acc.append({ data: Buffer.from([3, 4]), timestampMs: 0 })
    expect(Array.from(acc.getBuffer())).toEqual([1, 2, 3, 4])
  })
})
