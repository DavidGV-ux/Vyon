import type { PlanId, Subscription } from '../entities.js'
import { PLANS, planAtLeast } from '../entities.js'
import { verifyProState } from './pro-state.js'
import type { ProStateVerification } from './pro-state.js'
import { AppError } from '../../shared/errors.js'

export type FeatureKey = 'unlimited_projects' | 'audio_priority' | 'pdf_invoices' | 'api_access'

/** Plan mínimo requerido por feature. */
export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanId> = {
  unlimited_projects: 'pro',
  audio_priority: 'pro',
  pdf_invoices: 'pro',
  api_access: 'pro',
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  unlimited_projects: 'Proyectos ilimitados',
  audio_priority: 'Prioridad de audio Pro',
  pdf_invoices: 'Facturas y recibos en PDF',
  api_access: 'Acceso a la API',
}

export type PaywallDecision = {
  readonly allowed: boolean
  readonly feature: FeatureKey
  readonly label: string
  readonly currentPlan: PlanId | null
  readonly requiredPlan: PlanId
  readonly reason: string
  readonly verification: ProStateVerification
}

export class PaywallDeniedError extends AppError {
  readonly decision: PaywallDecision

  constructor(decision: PaywallDecision) {
    super({
      code: 'PAYWALL_DENIED',
      message: decision.reason,
      details: {
        feature: decision.feature,
        requiredPlan: decision.requiredPlan,
        currentPlan: decision.currentPlan,
        state: decision.verification.state,
      },
    })
    this.decision = decision
  }
}

/**
 * Paywall automatizado: resuelve acceso a features y límites de plan
 * a partir de la verificación de estados Pro v1.2.
 */
export class Paywall {
  evaluate(sub: Subscription | null, feature: FeatureKey, now: Date): PaywallDecision {
    const verification = verifyProState(sub, now)
    const requiredPlan = FEATURE_MIN_PLAN[feature]
    const currentPlan = verification.plan
    const allowed = verification.isPro && currentPlan !== null && planAtLeast(currentPlan, requiredPlan)

    return {
      allowed,
      feature,
      label: FEATURE_LABELS[feature],
      currentPlan,
      requiredPlan,
      reason: allowed
        ? `Acceso concedido: ${FEATURE_LABELS[feature]}.`
        : verification.isPro
          ? `${FEATURE_LABELS[feature]} requiere el plan ${PLANS[requiredPlan].name}.`
          : `${FEATURE_LABELS[feature]} requiere una cuenta Pro (${verification.state}).`,
      verification,
    }
  }

  assert(sub: Subscription | null, feature: FeatureKey, now: Date): PaywallDecision {
    const decision = this.evaluate(sub, feature, now)
    if (!decision.allowed) throw new PaywallDeniedError(decision)
    return decision
  }

  /** Límite de proyectos: free queda bloqueado al llegar a maxProjects. */
  canCreateProject(sub: Subscription | null, currentCount: number, now: Date): PaywallDecision {
    const verification = verifyProState(sub, now)
    const requiredPlan = FEATURE_MIN_PLAN.unlimited_projects
    const currentPlan = verification.plan
    const limit = currentPlan ? PLANS[currentPlan].limits.maxProjects : PLANS.free.limits.maxProjects
    const allowed = verification.isPro
      ? currentPlan !== null && planAtLeast(currentPlan, requiredPlan)
      : currentCount < limit

    return {
      allowed,
      feature: 'unlimited_projects',
      label: FEATURE_LABELS.unlimited_projects,
      currentPlan,
      requiredPlan,
      reason: allowed
        ? 'Puedes crear más proyectos.'
        : verification.isPro
          ? `Límite de ${limit} proyectos alcanzado.`
          : `El plan gratuito permite ${limit} proyectos. Mejora a ${PLANS[requiredPlan].name} para continuar.`,
      verification,
    }
  }
}
