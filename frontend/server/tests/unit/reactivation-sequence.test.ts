import { describe, it, expect } from 'vitest'
import { ReactivationSequence } from '../../src/domain/messaging/services/reactivation-sequence.js'

describe('ReactivationSequence', () => {
  const sequence = new ReactivationSequence([
    { step: 1, kind: 'reactivation', delayDays: 0 },
    { step: 2, kind: 'reactivation', delayDays: 3 },
    { step: 3, kind: 'reactivation', delayDays: 7 },
  ])

  it('returns due steps ordered by delay', () => {
    expect(sequence.dueSteps(5).map((s) => s.step)).toEqual([1, 2])
    expect(sequence.dueSteps(0).map((s) => s.step)).toEqual([1])
    expect(sequence.dueSteps(100).map((s) => s.step)).toEqual([1, 2, 3])
  })

  it('picks the latest due step', () => {
    expect(sequence.latestDueStep(6)?.step).toBe(2)
    expect(sequence.latestDueStep(-1)).toBeNull()
  })

  it('returns the next undelivered due step', () => {
    expect(sequence.nextUndeliveredStep(5, [])?.step).toBe(1)
    expect(sequence.nextUndeliveredStep(5, [1])?.step).toBe(2)
    expect(sequence.nextUndeliveredStep(5, [1, 2])).toBeNull()
    expect(sequence.nextUndeliveredStep(10, [1, 2])?.step).toBe(3)
  })

  it('rejects an empty sequence', () => {
    expect(() => new ReactivationSequence([])).toThrow()
  })
})
