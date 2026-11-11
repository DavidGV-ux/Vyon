import { describe, it, expect } from 'vitest'
import { Paywall, PaywallDeniedError, FEATURE_MIN_PLAN } from '../../src/domain/billing/services/paywall.js'
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

describe('MECL-041 · paywall automatizado', () => {
  const paywall = new Paywall()

  it('usuario sin suscripción no accede a features Pro', () => {
    const decision = paywall.evaluate(null, 'audio_priority', NOW)
    expect(decision.allowed).toBe(false)
    expect(decision.requiredPlan).toBe('pro')
    expect(decision.verification.state).toBe('SUBSCRIPTION_NOT_FOUND')
  })

  it('plan free no accede a pdf_invoices', () => {
    const decision = paywall.evaluate(sub({ plan: 'free' }), 'pdf_invoices', NOW)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('Pro')
  })

  it('suscriptor Pro activo accede a todas las features', () => {
    const pro = sub()
    for (const feature of Object.keys(FEATURE_MIN_PLAN) as (keyof typeof FEATURE_MIN_PLAN)[]) {
      expect(paywall.evaluate(pro, feature, NOW).allowed).toBe(true)
    }
  })

  it('Pro en dunning NO accede (estado v1.2 estricto)', () => {
    const decision = paywall.evaluate(sub({ status: 'past_due' }), 'audio_priority', NOW)
    expect(decision.allowed).toBe(false)
    expect(decision.verification.state).toBe('PRO_PAST_DUE')
  })

  it('assert lanza PaywallDeniedError con status 402 y detalle de plan', () => {
    try {
      paywall.assert(sub({ plan: 'free' }), 'api_access', NOW)
      throw new Error('no debió pasar')
    } catch (error) {
      expect(error).toBeInstanceOf(PaywallDeniedError)
      const denied = error as PaywallDeniedError
      expect(denied.status).toBe(402)
      expect(denied.code).toBe('PAYWALL_DENIED')
      expect(denied.details).toMatchObject({ requiredPlan: 'pro', currentPlan: 'free' })
    }
  })

  it('límite de proyectos: free con 3 proyectos bloqueado, con 2 permitido', () => {
    const free = sub({ plan: 'free' })
    expect(paywall.canCreateProject(free, 2, NOW).allowed).toBe(true)
    const denied = paywall.canCreateProject(free, 3, NOW)
    expect(denied.allowed).toBe(false)
    expect(denied.reason).toContain('3 proyectos')
  })

  it('límite de proyectos: Pro sin límite', () => {
    expect(paywall.canCreateProject(sub(), 999, NOW).allowed).toBe(true)
    expect(paywall.canCreateProject(null, 3, NOW).allowed).toBe(false)
  })
})
