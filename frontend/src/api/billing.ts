/**
 * Cliente HTTP del módulo de billing (MECL-041..044).
 * Usa VITE_API_URL si existe; en desarrollo va por el proxy de Vite (/api → :3000).
 */
const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

export type ProStateCode =
  | 'PRO_ACTIVE'
  | 'PRO_TRIALING'
  | 'PRO_CANCELED'
  | 'PRO_PAST_DUE'
  | 'PRO_EXPIRED'
  | 'PRO_TERMINATED'
  | 'FREE_PLAN'
  | 'SUBSCRIPTION_NOT_FOUND'

export type FeatureKey = 'unlimited_projects' | 'audio_priority' | 'pdf_invoices' | 'api_access'

export type PlanId = 'free' | 'pro' | 'business'

export type Plan = {
  id: PlanId
  name: string
  priceUsdMonthly: number
  limits: Record<string, number | string | boolean>
}

export type ProStateVerification = {
  version: string
  isPro: boolean
  state: ProStateCode
  plan: PlanId | null
  reason: string
  verifiedAt: string
  currentPeriodEnd: string | null
  daysRemaining: number | null
}

export type BillingStateResponse = {
  userId: string
  state: ProStateVerification
  plan: Plan
  limits: Record<string, number | string | boolean>
  features: Record<FeatureKey, boolean>
  featureLabels: Record<FeatureKey, string>
  subscription: unknown | null
}

export type InvoiceDto = {
  id: string
  number: string
  status: 'issued' | 'paid' | 'void'
  issuedAt: string
  periodStart: string
  periodEnd: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: string
  customerEmail: string | null
  hasReceipt: boolean
}

export type PaymentDto = {
  id: string
  idempotencyKey: string
  amountCents: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed'
  providerRef: string | null
  failureCode: string | null
  createdAt: string
  attempts: { attempt: number; outcome: string; code: string | null }[]
}

export type AudioJobDto = {
  id: string
  plan: PlanId
  priority: 'normal' | 'high'
  status: 'queued' | 'running' | 'done' | 'failed'
  fileName: string
  enqueuedAt: string
  transcript: string | null
  error: string | null
}

export type AudioStatsDto = {
  queueDepth: number
  running: number
  maxConcurrency: number
  processed: number
  failed: number
  avgWaitMs: { pro: number; free: number }
  jobsByPriority: { high: number; normal: number }
}

export type ReconciliationDto = {
  at: string
  paymentsTotal: number
  paymentsSucceeded: number
  gatewayChargesTotal: number
  missingLocal: unknown[]
  missingGateway: unknown[]
  balanced: boolean
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new ApiError(`Error ${res.status}`, 'HTTP_ERROR', res.status)
    return (await res.blob()) as unknown as T
  }

  const data = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null

  if (!res.ok) {
    throw new ApiError(
      data?.error?.message ?? `Error ${res.status}`,
      data?.error?.code ?? 'HTTP_ERROR',
      res.status,
    )
  }
  return data as T
}

export const billingApi = {
  state(userId: string): Promise<BillingStateResponse> {
    return request(`/billing/state?userId=${encodeURIComponent(userId)}`)
  },

  plans(): Promise<{ plans: Plan[] }> {
    return request('/billing/plans')
  },

  checkout(
    userId: string,
    plan: 'pro' | 'business',
    customerEmail?: string,
  ): Promise<{
    subscription: { plan: PlanId; currentPeriodEnd: string }
    paymentId: string
    invoiceId: string | null
    state: ProStateVerification
  }> {
    return request('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ userId, plan, customerEmail }),
    })
  },

  invoices(userId: string): Promise<{ items: InvoiceDto[]; total: number }> {
    return request(`/invoices?userId=${encodeURIComponent(userId)}`)
  },

  payments(userId: string): Promise<{ items: PaymentDto[]; total: number }> {
    return request(`/payments?userId=${encodeURIComponent(userId)}`)
  },

  reconciliation(): Promise<ReconciliationDto> {
    return request('/payments/reconciliation')
  },

  audioStats(): Promise<AudioStatsDto> {
    return request('/audio/stats')
  },

  audioJobs(userId: string): Promise<{ items: AudioJobDto[]; total: number }> {
    return request(`/audio/jobs?userId=${encodeURIComponent(userId)}`)
  },

  enqueueAudio(userId: string, fileName: string): Promise<{ job: AudioJobDto; priority: 'normal' | 'high'; reason: string }> {
    return request('/audio/jobs', {
      method: 'POST',
      body: JSON.stringify({ userId, fileName, mediaType: 'audio/webm' }),
    })
  },
}

export function pdfUrl(kind: 'invoice' | 'receipt', id: string): string {
  const suffix = kind === 'invoice' ? '/pdf' : '/receipt/pdf'
  return `${API_BASE}/api/v1/invoices/${encodeURIComponent(id)}${suffix}`
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency }).format(cents / 100)
}
