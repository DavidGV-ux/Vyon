import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBilling } from '../context/BillingContext'
import { Lock, X, Check, Loader2, Sparkles, FileText, CreditCard } from 'lucide-react'

const STATE_LABELS: Record<string, string> = {
  PRO_ACTIVE: 'Pro activo',
  PRO_TRIALING: 'Prueba Pro vigente',
  PRO_CANCELED: 'Acceso hasta fin de periodo',
  PRO_PAST_DUE: 'Pago pendiente',
  PRO_EXPIRED: 'Plan expirado',
  PRO_TERMINATED: 'Suscripción cancelada',
  FREE_PLAN: 'Plan gratuito',
  SUBSCRIPTION_NOT_FOUND: 'Sin suscripción',
}

/**
 * Paywall automatizado (MECL-041): se abre cuando el usuario intenta
 * usar una feature Pro sin plan. Permite el checkout in-place.
 */
export default function Paywall() {
  const { paywallOpen, paywallFeature, closePaywall, state, checkout } = useBilling()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)

  useEffect(() => {
    if (paywallOpen) {
      setPhase('idle')
      setError(null)
      setInvoiceId(null)
    }
  }, [paywallOpen])

  useEffect(() => {
    if (!paywallOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePaywall()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paywallOpen, closePaywall])

  if (!paywallOpen) return null

  const featureLabel = paywallFeature ? state?.featureLabels[paywallFeature] : null
  const reason =
    featureLabel != null && state
      ? `${featureLabel} requiere el plan Pro.`
      : state?.state.reason ?? 'Esta función forma parte de los planes de pago de Vyon.'

  const handleUpgrade = async () => {
    setPhase('processing')
    const result = await checkout('pro')
    if (result.ok) {
      setInvoiceId(result.invoiceId ?? null)
      setPhase('success')
    } else {
      setError(result.error ?? 'No se pudo completar el pago.')
      setPhase('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={closePaywall}
      role="dialog"
      aria-modal="true"
      aria-label="Paywall"
    >
      <div
        className="vyon-card w-full max-w-lg p-7 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-vyon-yellow/20 to-vyon-orange/20 blur-3xl pointer-events-none" />

        <button
          onClick={closePaywall}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition z-10"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {phase === 'success' ? (
          <div className="relative z-10 text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">
              ¡Bienvenido a <span className="vyon-gradient-text">Pro</span>! 🎉
            </h2>
            <p className="text-white/60 text-sm mb-1">Tu suscripción está activa y verificada.</p>
            <p className="text-white/40 text-xs mb-6">
              Factura emitida automáticamente{invoiceId ? ' y lista para descargar' : ''}.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  closePaywall()
                  navigate('/dashboard/billing')
                }}
                className="vyon-btn-primary py-3 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Ver facturas y recibos
              </button>
              <button onClick={closePaywall} className="vyon-btn-secondary py-3">
                Seguir trabajando
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-xl bg-vyon-yellow/15 border border-vyon-yellow/30 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-vyon-yellow" />
            </div>
            <p className="text-xs uppercase tracking-widest text-vyon-yellow font-bold mb-1">
              Función Pro
            </p>
            <h2 className="text-2xl font-black tracking-tight mb-2">
              Desbloquea <span className="vyon-gradient-text">{featureLabel ?? 'Vyon Pro'}</span>
            </h2>
            <p className="text-white/60 text-sm mb-5">{reason}</p>

            {state && (
              <div className="rounded-xl bg-vyon-slate/50 border border-white/5 px-4 py-3 mb-5 text-xs text-white/50">
                Estado actual:{' '}
                <span className="text-white/80 font-semibold">
                  {STATE_LABELS[state.state.state] ?? state.state.state}
                </span>{' '}
                · verificación Pro v{state.state.version}
              </div>
            )}

            <div className="rounded-2xl border border-vyon-yellow/30 bg-vyon-yellow/5 p-5 mb-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-vyon-yellow" />
                    Plan Pro
                  </p>
                  <p className="text-xs text-white/50">Facturación mensual</p>
                </div>
                <p className="text-2xl font-black">
                  $12<span className="text-sm font-medium text-white/50">/mes</span>
                </p>
              </div>
              <ul className="space-y-2 text-sm text-white/70">
                {[
                  'Proyectos y tareas ilimitados',
                  'Prioridad de procesamiento de audio',
                  'Facturas y recibos en PDF automáticos',
                  'Acceso completo a la API',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {phase === 'error' && error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 mb-4 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleUpgrade}
                disabled={phase === 'processing'}
                className="vyon-btn-primary py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {phase === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando pago seguro...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Actualizar a Pro — $12/mes
                  </>
                )}
              </button>
              <button onClick={closePaywall} className="py-2 text-sm text-white/40 hover:text-white transition">
                Ahora no
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
