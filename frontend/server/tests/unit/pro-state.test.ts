import { describe, it, expect } from 'vitest'
import { verifyProState, PRO_STATE_VERSION } from '../../src/domain/billing/services/pro-state.js'
import type { Subscription } from '../../src/domain/billing/entities.js'

const NOW = new Date('2026-11-11T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    userId: 'u1',
    plan: 'pro',
    status: 'active',
    startedAt: '2026-10-19T00:00:00.000Z',
    trialEndsAt: null,
    currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY).toISOString(),
    cancelAtPeriodEnd: false,
    updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

describe('MECL-041 · verificación de estados Pro v1.2', () => {
  it('sin suscripción → SUBSCRIPTION_NOT_FOUND sin acceso', () => {
    const result = verifyProState(null, NOW)
    expect(result.isPro).toBe(false)
    expect(result.state).toBe('SUBSCRIPTION_NOT_FOUND')
    expect(result.version).toBe(PRO_STATE_VERSION)
    expect(result.version).toBe('1.2')
  })

  it('plan free → FREE_PLAN sin acceso', () => {
    const result = verifyProState(sub({ plan: 'free', status: 'active' }), NOW)
    expect(result.isPro).toBe(false)
    expect(result.state).toBe('FREE_PLAN')
  })

  it('activo dentro del periodo → PRO_ACTIVE con acceso', () => {
    const result = verifyProState(sub(), NOW)
    expect(result.isPro).toBe(true)
    expect(result.state).toBe('PRO_ACTIVE')
    expect(result.daysRemaining).toBe(10)
  })

  it('trial vigente → PRO_TRIALING con acceso', () => {
    const result = verifyProState(
      sub({ status: 'trialing', trialEndsAt: new Date(NOW.getTime() + 7 * DAY).toISOString() }),
      NOW,
    )
    expect(result.isPro).toBe(true)
    expect(result.state).toBe('PRO_TRIALING')
    expect(result.daysRemaining).toBe(7)
  })

  it('trial vencido → PRO_EXPIRED sin acceso', () => {
    const result = verifyProState(
      sub({ status: 'trialing', trialEndsAt: new Date(NOW.getTime() - DAY).toISOString() }),
      NOW,
    )
    expect(result.isPro).toBe(false)
    expect(result.state).toBe('PRO_EXPIRED')
  })

  it('cancelada pero en periodo pagado → PRO_CANCELED con acceso hasta el fin', () => {
    const result = verifyProState(sub({ cancelAtPeriodEnd: true }), NOW)
    expect(result.isPro).toBe(true)
    expect(result.state).toBe('PRO_CANCELED')
  })

  it('past_due (dunning) → PRO_PAST_DUE SIN acceso (regla estricta v1.2)', () => {
    const result = verifyProState(sub({ status: 'past_due' }), NOW)
    expect(result.isPro).toBe(false)
    expect(result.state).toBe('PRO_PAST_DUE')
  })

  it('periodo vencido → PRO_EXPIRED sin acceso', () => {
    const result = verifyProState(sub({ currentPeriodEnd: new Date(NOW.getTime() - DAY).toISOString() }), NOW)
    expect(result.isPro).toBe(false)
    expect(result.state).toBe('PRO_EXPIRED')
    expect(result.daysRemaining).toBe(0)
  })

  it('canceled → PRO_TERMINATED sin acceso', () => {
    const result = verifyProState(sub({ status: 'canceled' }), NOW)
    expect(result.isPro).toBe(false)
    expect(result.state).toBe('PRO_TERMINATED')
  })

  it('business activo → PRO_ACTIVE con acceso', () => {
    const result = verifyProState(sub({ plan: 'business' }), NOW)
    expect(result.isPro).toBe(true)
    expect(result.state).toBe('PRO_ACTIVE')
    expect(result.plan).toBe('business')
  })
})
