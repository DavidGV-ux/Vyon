import type { PlanId, Subscription } from '../entities.js'

/**
 * Estados Pro v1.2 — máquina de verificación de acceso.
 *
 * | state                  | isPro | descripción                                    |
 * |------------------------|-------|------------------------------------------------|
 * | PRO_ACTIVE             | true  | Suscripción pagada dentro del periodo vigente  |
 * | PRO_TRIALING           | true  | Prueba vigente                                 |
 * | PRO_CANCELED           | true  | Cancelada pero dentro del periodo pagado       |
 * | PRO_PAST_DUE           | false | En dunning (v1.2: acceso suspendido estricto)  |
 * | PRO_EXPIRED            | false | Periodo vencido sin renovación                 |
 * | PRO_TERMINATED         | false | Cancelada inmediatamente                       |
 * | FREE_PLAN              | false | Sin plan de pago                               |
 * | SUBSCRIPTION_NOT_FOUND | false | Sin suscripción registrada                    |
 */
export const PRO_STATE_VERSION = '1.2'

export type ProStateCode =
  | 'PRO_ACTIVE'
  | 'PRO_TRIALING'
  | 'PRO_CANCELED'
  | 'PRO_PAST_DUE'
  | 'PRO_EXPIRED'
  | 'PRO_TERMINATED'
  | 'FREE_PLAN'
  | 'SUBSCRIPTION_NOT_FOUND'

export type ProStateVerification = {
  readonly version: typeof PRO_STATE_VERSION
  readonly isPro: boolean
  readonly state: ProStateCode
  readonly plan: PlanId | null
  readonly reason: string
  readonly verifiedAt: string
  readonly currentPeriodEnd: string | null
  readonly daysRemaining: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS)
}

export function verifyProState(sub: Subscription | null, now: Date): ProStateVerification {
  const verifiedAt = now.toISOString()

  if (!sub) {
    return {
      version: PRO_STATE_VERSION,
      isPro: false,
      state: 'SUBSCRIPTION_NOT_FOUND',
      plan: null,
      reason: 'No hay suscripción registrada para este usuario.',
      verifiedAt,
      currentPeriodEnd: null,
      daysRemaining: null,
    }
  }

  if (sub.plan === 'free') {
    return {
      version: PRO_STATE_VERSION,
      isPro: false,
      state: 'FREE_PLAN',
      plan: 'free',
      reason: 'El usuario se encuentra en el plan gratuito.',
      verifiedAt,
      currentPeriodEnd: null,
      daysRemaining: null,
    }
  }

  const periodEnd = new Date(sub.currentPeriodEnd)
  const inPeriod = periodEnd.getTime() > now.getTime()
  const daysRemaining = inPeriod ? daysBetween(now, periodEnd) : 0

  const base = {
    version: PRO_STATE_VERSION,
    plan: sub.plan,
    currentPeriodEnd: sub.currentPeriodEnd,
    daysRemaining,
  } as const

  switch (sub.status) {
    case 'active':
      if (inPeriod && !sub.cancelAtPeriodEnd) {
        return { ...base, isPro: true, state: 'PRO_ACTIVE', reason: 'Suscripción activa y vigente.', verifiedAt }
      }
      if (inPeriod && sub.cancelAtPeriodEnd) {
        return {
          ...base,
          isPro: true,
          state: 'PRO_CANCELED',
          reason: 'Cancelada con acceso vigente hasta el fin del periodo.',
          verifiedAt,
        }
      }
      return { ...base, isPro: false, state: 'PRO_EXPIRED', reason: 'Periodo de suscripción vencido.', verifiedAt }

    case 'trialing': {
      const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : periodEnd
      if (trialEnd.getTime() > now.getTime() && inPeriod) {
        return {
          ...base,
          isPro: true,
          state: 'PRO_TRIALING',
          reason: 'Prueba Pro vigente.',
          verifiedAt,
          daysRemaining: daysBetween(now, trialEnd),
        }
      }
      return { ...base, isPro: false, state: 'PRO_EXPIRED', reason: 'Prueba vencida.', verifiedAt }
    }

    case 'past_due':
      return {
        ...base,
        isPro: false,
        state: 'PRO_PAST_DUE',
        reason: 'Pago pendiente: acceso suspendido hasta regularizar (v1.2 estricto).',
        verifiedAt,
      }

    case 'canceled':
      return { ...base, isPro: false, state: 'PRO_TERMINATED', reason: 'Suscripción cancelada.', verifiedAt }

    case 'expired':
      return { ...base, isPro: false, state: 'PRO_EXPIRED', reason: 'Suscripción expirada.', verifiedAt }
    default:
      return { ...base, isPro: false, state: 'PRO_EXPIRED', reason: 'Estado desconocido.', verifiedAt }
  }
}
