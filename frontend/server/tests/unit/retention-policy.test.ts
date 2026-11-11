import { describe, it, expect } from 'vitest'
import { RetentionPolicy } from '../../src/domain/messaging/services/retention-policy.js'

describe('RetentionPolicy', () => {
  const now = new Date('2026-11-11T12:00:00.000Z')

  it('reports inactivity in whole days', () => {
    const policy = new RetentionPolicy(30)
    expect(policy.inactivityDays('2026-10-12T12:00:00.000Z', now)).toBe(30)
    expect(policy.inactivityDays('2026-11-11T00:00:00.000Z', now)).toBe(0)
  })

  it('does not send when below the threshold', () => {
    const policy = new RetentionPolicy(30)
    const evaluation = policy.evaluate('2026-10-20T12:00:00.000Z', now)
    expect(evaluation.send).toBe(false)
    expect(evaluation.inactivityDays).toBe(22)
  })

  it('sends when reaching the threshold', () => {
    const policy = new RetentionPolicy(30)
    const evaluation = policy.evaluate('2026-10-11T12:00:00.000Z', now)
    expect(evaluation.send).toBe(true)
    expect(evaluation.inactivityDays).toBe(31)
  })

  it('is safe with invalid dates', () => {
    const policy = new RetentionPolicy(30)
    expect(policy.inactivityDays('not-a-date', now)).toBe(0)
    expect(policy.evaluate('not-a-date', now).send).toBe(false)
  })
})
