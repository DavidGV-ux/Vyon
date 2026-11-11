import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { billingApi, BillingStateResponse, FeatureKey, ApiError } from '../api/billing'

type CheckoutResult = {
  ok: boolean
  error?: string
  invoiceId?: string | null
}

type BillingContextType = {
  loading: boolean
  error: string | null
  state: BillingStateResponse | null
  isPro: boolean
  can: (feature: FeatureKey) => boolean
  refresh: () => Promise<void>
  checkout: (plan: 'pro' | 'business') => Promise<CheckoutResult>
  paywallFeature: FeatureKey | null
  paywallOpen: boolean
  openPaywall: (feature?: FeatureKey) => void
  closePaywall: () => void
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<BillingStateResponse | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallFeature, setPaywallFeature] = useState<FeatureKey | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setState(null)
      setLoading(false)
      return
    }
    try {
      setError(null)
      const next = await billingApi.state(user.id)
      setState(next)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el estado de facturación')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const checkout = useCallback(
    async (plan: 'pro' | 'business'): Promise<CheckoutResult> => {
      if (!user) return { ok: false, error: 'Debes iniciar sesión.' }
      try {
        const email = (user.email as string | undefined) ?? undefined
        const result = await billingApi.checkout(user.id, plan, email)
        await refresh()
        return { ok: true, invoiceId: result.invoiceId }
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? e.message : 'Error al procesar el pago.' }
      }
    },
    [user, refresh],
  )

  const openPaywall = useCallback((feature?: FeatureKey) => {
    setPaywallFeature(feature ?? null)
    setPaywallOpen(true)
  }, [])

  const closePaywall = useCallback(() => {
    setPaywallOpen(false)
    setPaywallFeature(null)
  }, [])

  const value = useMemo<BillingContextType>(
    () => ({
      loading,
      error,
      state,
      isPro: state?.state.isPro ?? false,
      can: feature => state?.features[feature] ?? false,
      refresh,
      checkout,
      paywallFeature,
      paywallOpen,
      openPaywall,
      closePaywall,
    }),
    [loading, error, state, refresh, checkout, paywallFeature, paywallOpen, openPaywall, closePaywall],
  )

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBilling(): BillingContextType {
  const ctx = useContext(BillingContext)
  if (!ctx) throw new Error('useBilling debe usarse dentro de BillingProvider')
  return ctx
}
