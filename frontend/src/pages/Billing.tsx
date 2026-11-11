import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useBilling } from '../context/BillingContext'
import { useAuth } from '../context/AuthContext'
import {
  billingApi,
  formatCents,
  pdfUrl,
  InvoiceDto,
  PaymentDto,
  AudioJobDto,
  AudioStatsDto,
} from '../api/billing'
import {
  ShieldCheck,
  FileText,
  Receipt,
  Download,
  CreditCard,
  Check,
  Activity,
  Zap,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react'

const STATE_BADGES: Record<string, { label: string; className: string }> = {
  PRO_ACTIVE: { label: 'PRO ACTIVO', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  PRO_TRIALING: { label: 'PRUEBA PRO', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  PRO_CANCELED: { label: 'ACCESO VIGENTE', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  PRO_PAST_DUE: { label: 'PAGO PENDIENTE', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  PRO_EXPIRED: { label: 'EXPIRADO', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  PRO_TERMINATED: { label: 'CANCELADO', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  FREE_PLAN: { label: 'PLAN GRATUITO', className: 'bg-white/10 text-white/60 border-white/15' },
  SUBSCRIPTION_NOT_FOUND: { label: 'SIN SUSCRIPCIÓN', className: 'bg-white/10 text-white/60 border-white/15' },
}

const JOB_BADGES: Record<string, string> = {
  queued: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  running: 'bg-vyon-yellow/15 text-vyon-yellow border-vyon-yellow/30',
  done: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const JOB_LABELS: Record<string, string> = {
  queued: 'En cola',
  running: 'Procesando',
  done: 'Completado',
  failed: 'Fallido',
}

export default function Billing() {
  const { state, loading, error, isPro, can, refresh, openPaywall, checkout } = useBilling()
  const { user } = useAuth()

  const [invoices, setInvoices] = useState<InvoiceDto[]>([])
  const [payments, setPayments] = useState<PaymentDto[]>([])
  const [jobs, setJobs] = useState<AudioJobDto[]>([])
  const [stats, setStats] = useState<AudioStatsDto | null>(null)
  const [busy, setBusy] = useState(false)

  const userId = user?.id as string | undefined

  const loadLists = useCallback(async () => {
    if (!userId) return
    try {
      const [inv, pay, jobList, audioStats] = await Promise.all([
        billingApi.invoices(userId),
        billingApi.payments(userId),
        billingApi.audioJobs(userId),
        billingApi.audioStats(),
      ])
      setInvoices(inv.items)
      setPayments(pay.items)
      setJobs(jobList.items)
      setStats(audioStats)
    } catch {
      /* el estado principal ya muestra errores */
    }
  }, [userId])

  useEffect(() => {
    void loadLists()
    const interval = setInterval(() => void loadLists(), 2500)
    return () => clearInterval(interval)
  }, [loadLists])

  const handleUpgrade = async () => {
    setBusy(true)
    const result = await checkout('pro')
    setBusy(false)
    if (!result.ok) openPaywall('unlimited_projects')
  }

  const enqueueDemo = async () => {
    if (!userId) return
    try {
      await billingApi.enqueueAudio(userId, `demo-${Date.now()}.webm`)
      await loadLists()
    } catch {
      /* se refresca en el siguiente poll */
    }
  }

  const badge = state ? (STATE_BADGES[state.state.state] ?? STATE_BADGES.FREE_PLAN)! : null

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/40 mb-1">Dashboard / Facturación</p>
            <h1 className="text-3xl font-black tracking-tight">
              Plan, <span className="vyon-gradient-text">facturas y pagos</span>
            </h1>
            <p className="mt-2 text-white/60">
              Estado Pro verificado automáticamente · facturación y recibos en PDF.
            </p>
          </div>
          <button
            onClick={() => {
              void refresh()
              void loadLists()
            }}
            className="vyon-btn-secondary py-2.5 px-4 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {loading && (
          <div className="vyon-card p-8 flex items-center gap-3 text-white/60">
            <Loader2 className="w-5 h-5 animate-spin text-vyon-yellow" />
            Verificando estado de suscripción...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {state && (
          <>
            {/* Estado del plan */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 vyon-card p-6 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-vyon-yellow/15 to-vyon-orange/15 blur-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-vyon-gradient flex items-center justify-center text-vyon-dark">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          Plan actual
                        </p>
                        <p className="text-2xl font-black">{state.plan.name}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${badge?.className}`}
                    >
                      {badge?.label}
                    </span>
                  </div>

                  <p className="text-sm text-white/60 mb-1">{state.state.reason}</p>
                  <p className="text-xs text-white/40">
                    Verificación Pro v{state.state.version} · {new Date(state.state.verifiedAt).toLocaleString('es-CO')}
                    {state.state.daysRemaining !== null && state.state.daysRemaining > 0 && (
                      <> · {state.state.daysRemaining} días restantes</>
                    )}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {isPro ? (
                      <span className="inline-flex items-center gap-2 text-sm text-emerald-400 font-medium">
                        <Check className="w-4 h-4" />
                        Todas las funciones Pro desbloqueadas
                      </span>
                    ) : (
                      <button
                        onClick={handleUpgrade}
                        disabled={busy}
                        className="vyon-btn-primary py-2.5 px-5 flex items-center gap-2 text-sm disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        {busy ? 'Procesando pago...' : 'Actualizar a Pro — $12/mes'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="vyon-card p-6">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-4">Funciones</p>
                <ul className="space-y-3">
                  {(Object.keys(state.featureLabels) as (keyof typeof state.featureLabels)[]).map(feature => {
                    const enabled = state.features[feature]
                    return (
                      <li key={feature} className="flex items-center justify-between gap-2 text-sm">
                        <span className={enabled ? 'text-white/80' : 'text-white/40'}>
                          {state.featureLabels[feature]}
                        </span>
                        {enabled ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <button
                            onClick={() => openPaywall(feature)}
                            className="text-[11px] font-bold text-vyon-yellow hover:underline"
                          >
                            Desbloquear
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* Facturas */}
            <div className="vyon-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-vyon-slate flex items-center justify-center text-vyon-yellow">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold">Facturas y recibos</h2>
                    <p className="text-xs text-white/40">
                      Generadas automáticamente con cada pago
                    </p>
                  </div>
                </div>
                {!can('pdf_invoices') && (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/10 text-white/50 border border-white/10 uppercase">
                    Requiere Pro
                  </span>
                )}
              </div>

              {invoices.length === 0 ? (
                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center text-sm text-white/30">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Aún no hay facturas. Al suscribirte se emiten automáticamente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-white/40 border-b border-white/5">
                        <th className="pb-3 pr-4">Número</th>
                        <th className="pb-3 pr-4">Emitida</th>
                        <th className="pb-3 pr-4">Periodo</th>
                        <th className="pb-3 pr-4 text-right">Total</th>
                        <th className="pb-3 pr-4 text-center">Estado</th>
                        <th className="pb-3 text-right">Descargar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-3 pr-4 font-semibold">{inv.number}</td>
                          <td className="py-3 pr-4 text-white/60">
                            {new Date(inv.issuedAt).toLocaleDateString('es-CO')}
                          </td>
                          <td className="py-3 pr-4 text-white/60 text-xs">
                            {inv.periodStart} → {inv.periodEnd}
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold">
                            {formatCents(inv.totalCents, inv.currency)}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {inv.status === 'paid' ? 'Pagada' : 'Emitida'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={pdfUrl('invoice', inv.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-vyon-yellow/15 text-vyon-yellow border border-vyon-yellow/30 hover:bg-vyon-yellow/25 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Factura
                              </a>
                              {inv.hasReceipt && (
                                <a
                                  href={pdfUrl('receipt', inv.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/70 border border-white/10 hover:bg-white/15 transition"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  Recibo
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Pagos (MECL-044) */}
              <div className="vyon-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-vyon-slate flex items-center justify-center text-vyon-yellow">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold">Transacciones</h2>
                    <p className="text-xs text-white/40">Pasarela idempotente · cero pérdida</p>
                  </div>
                </div>

                {payments.length === 0 ? (
                  <p className="text-sm text-white/30">Sin transacciones registradas.</p>
                ) : (
                  <ul className="space-y-2">
                    {payments.slice(0, 6).map(payment => (
                      <li
                        key={payment.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-vyon-slate/40 border border-white/5 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {payment.idempotencyKey}
                          </p>
                          <p className="text-[11px] text-white/40">
                            {payment.providerRef ? `ref ${payment.providerRef}` : 'sin referencia'}
                            {payment.attempts.length > 1 && ` · ${payment.attempts.length} intentos`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold">
                            {formatCents(payment.amountCents, payment.currency)}
                          </p>
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              payment.status === 'succeeded'
                                ? 'text-emerald-400'
                                : payment.status === 'failed'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                            }`}
                          >
                            {payment.status === 'succeeded'
                              ? 'Exitoso'
                              : payment.status === 'failed'
                                ? 'Fallido'
                                : 'Pendiente'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Audio prioritario (MECL-043) */}
              <div className="vyon-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-vyon-slate flex items-center justify-center text-vyon-yellow">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold">Procesamiento de audio</h2>
                      <p className="text-xs text-white/40">
                        {can('audio_priority')
                          ? 'Tu cuenta tiene prioridad alta en la cola'
                          : 'Los usuarios Pro tienen prioridad en la cola'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={enqueueDemo}
                    className="vyon-btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Encolar demo
                  </button>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl bg-vyon-slate/40 border border-white/5 p-3 text-center">
                      <p className="text-lg font-black">{stats.queueDepth}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">En cola</p>
                    </div>
                    <div className="rounded-xl bg-vyon-slate/40 border border-white/5 p-3 text-center">
                      <p className="text-lg font-black">{stats.running}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Activos</p>
                    </div>
                    <div className="rounded-xl bg-vyon-slate/40 border border-white/5 p-3 text-center">
                      <p className="text-lg font-black">{stats.processed}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Procesados</p>
                    </div>
                  </div>
                )}

                {stats && (
                  <div className="flex items-center gap-4 mb-4 text-[11px] text-white/50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      espera media Pro: <b className="text-vyon-yellow">{stats.avgWaitMs.pro}ms</b>
                    </span>
                    <span>
                      Free: <b className="text-white/70">{stats.avgWaitMs.free}ms</b>
                    </span>
                  </div>
                )}

                {jobs.length === 0 ? (
                  <p className="text-sm text-white/30">Sin trabajos encolados.</p>
                ) : (
                  <ul className="space-y-2">
                    {jobs.slice(0, 5).map(job => (
                      <li
                        key={job.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-vyon-slate/40 border border-white/5 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{job.fileName}</p>
                          <p className="text-[11px] text-white/40">
                            plan {job.plan}
                            {job.transcript ? ' · transcripción lista' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {job.priority === 'high' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vyon-yellow/15 text-vyon-yellow border border-vyon-yellow/30 uppercase">
                              Prioridad Pro
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${JOB_BADGES[job.status]}`}
                          >
                            {JOB_LABELS[job.status]}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
