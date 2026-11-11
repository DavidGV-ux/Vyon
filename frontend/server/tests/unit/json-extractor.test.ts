import { describe, it, expect } from 'vitest'
import { extractJson } from '../../src/domain/ai/services/json-extractor.js'

describe('extractJson', () => {
  it('parses plain JSON', () => {
    const r = extractJson('{"a":1,"b":"x"}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: 1, b: 'x' })
  })

  it('strips markdown fences', () => {
    const r = extractJson('```json\n{"a":2}\n```')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: 2 })
  })

  it('extracts JSON embedded in prose', () => {
    const r = extractJson('Here is the result: {"a":3} thanks!')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: 3 })
  })

  it('repairs trailing commas', () => {
    const r = extractJson('{"a": [1,2,], "b": 3,}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ a: [1, 2], b: 3 })
  })

  it('handles nested objects and arrays', () => {
    const r = extractJson('prefix {"x":{"y":[1,2,3]}} suffix')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ x: { y: [1, 2, 3] } })
  })

  it('returns error on empty input', () => {
    const r = extractJson('')
    expect(r.ok).toBe(false)
  })

  it('returns error when no JSON present', () => {
    const r = extractJson('just some text without braces')
    expect(r.ok).toBe(false)
  })
})
