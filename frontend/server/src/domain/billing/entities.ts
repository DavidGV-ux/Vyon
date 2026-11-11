export type PlanId = 'free' | 'pro' | 'business'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export type PlanLimits = {
  readonly maxProjects: number
  readonly maxTasksPerProject: number
  readonly audioPriority: 'normal' | 'high'
  readonly maxConcurrentAudioJobs: number
  readonly pdfInvoices: boolean
  readonly apiAccess: boolean
}

export type Plan = {
  readonly id: PlanId
  readonly name: string
  readonly priceUsdMonthly: number
  readonly limits: PlanLimits
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsdMonthly: 0,
    limits: {
      maxProjects: 3,
      maxTasksPerProject: 50,
      audioPriority: 'normal',
      maxConcurrentAudioJobs: 1,
      pdfInvoices: false,
      apiAccess: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsdMonthly: 12,
    limits: {
      maxProjects: Infinity,
      maxTasksPerProject: Infinity,
      audioPriority: 'high',
      maxConcurrentAudioJobs: 4,
      pdfInvoices: true,
      apiAccess: true,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    priceUsdMonthly: 29,
    limits: {
      maxProjects: Infinity,
      maxTasksPerProject: Infinity,
      audioPriority: 'high',
      maxConcurrentAudioJobs: 10,
      pdfInvoices: true,
      apiAccess: true,
    },
  },
}

export const PLAN_ORDER: readonly PlanId[] = ['free', 'pro', 'business']

export function minPlan(a: PlanId, b: PlanId): PlanId {
  return PLAN_ORDER.indexOf(a) <= PLAN_ORDER.indexOf(b) ? a : b
}

export function planAtLeast(actual: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(actual) >= PLAN_ORDER.indexOf(required)
}

export type Subscription = {
  readonly id: string
  readonly userId: string
  readonly plan: PlanId
  readonly status: SubscriptionStatus
  readonly startedAt: string
  readonly trialEndsAt: string | null
  readonly currentPeriodEnd: string
  readonly cancelAtPeriodEnd: boolean
  readonly updatedAt: string
}
