import { useEffect, useState } from 'react'
import { supabase } from '../supabase/client'
import { AnalyticsEvent } from '../supabase/types'

type OriginStat = {
  origin: string
  visits: number
  cta_clicks: number
  wa_clicks: number
  messages: number
  conversionRate: number
}

const SOCIAL_ORIGINS = ['tiktok', 'instagram', 'youtube', 'whatsapp', 'direct', 'organic']

export default function Analytics() {
  const [stats, setStats] = useState<OriginStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error: supabaseError } = await supabase
          .from('analytics_events')
          .select('event_name, utm_source, created_at')
          .order('created_at', { ascending: false })

        if (supabaseError) throw supabaseError

        const events = (data || []) as AnalyticsEvent[]
        const map = new Map<string, OriginStat>()

        const init = (origin: string): OriginStat => ({
          origin,
          visits: 0,
          cta_clicks: 0,
          wa_clicks: 0,
          messages: 0,
          conversionRate: 0,
        })

        SOCIAL_ORIGINS.forEach(o => map.set(o, init(o)))

        for (const e of events) {
          const origin = (e.utm_source || 'direct').toLowerCase()
          const key = SOCIAL_ORIGINS.includes(origin) ? origin : 'organic'
          const cur = map.get(key) || init(key)
          if (e.event_name === 'page_visit') cur.visits += 1
          else if (e.event_name === 'cta_click') cur.cta_clicks += 1
          else if (e.event_name === 'wa_click') cur.wa_clicks += 1
          else if (e.event_name === 'wa_message_sent') cur.messages += 1
          map.set(key, cur)
        }

        const result = Array.from(map.values()).map(s => ({
          ...s,
          conversionRate: s.visits ? Math.round((s.messages / s.visits) * 1000) / 10 : 0,
        }))

        if (!cancelled) setStats(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando analítica')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const totalVisits = stats.reduce((a, s) => a + s.visits, 0)
  const totalMessages = stats.reduce((a, s) => a + s.messages, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Analítica de tráfico por origen</h1>
        <p className="text-white/60 mt-1">
          Tasa de conversión: visita a Landing → primer mensaje al bot
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Resumen global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Visitas totales" value={totalVisits} iconClass="text-blue-400" />
        <StatCard label="CTA clics" value={stats.reduce((a, s) => a + s.cta_clicks, 0)} iconClass="text-cyan-400" />
        <StatCard label="Apertura bot" value={stats.reduce((a, s) => a + s.wa_clicks, 0)} iconClass="text-violet-400" />
        <StatCard
          label="Mensajes al bot"
          value={totalMessages}
          iconClass="text-vyon-yellow"
        />
        <StatCard
          label="Conversión global"
          value={totalVisits ? `${Math.round((totalMessages / totalVisits) * 1000) / 10}%` : '0%'}
          iconClass="text-emerald-400"
        />
      </div>

      {/* Tabla por origen */}
      <div className="vyon-card p-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-wider">
              <th className="pb-3 font-semibold">Origen</th>
              <th className="pb-3 font-semibold text-right">Visitas</th>
              <th className="pb-3 font-semibold text-right">CTA clics</th>
              <th className="pb-3 font-semibold text-right">Apertura bot</th>
              <th className="pb-3 font-semibold text-right">Mensajes</th>
              <th className="pb-3 font-semibold text-right">Conversión</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-white/40">Cargando...</td>
              </tr>
            ) : stats.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-white/40">Sin datos de analítica todavía.</td>
              </tr>
            ) : (
              stats.map(s => (
                <tr key={s.origin} className="border-b border-white/5 hover:bg-white/3 transition">
                  <td className="py-4 text-sm font-medium">{s.origin.charAt(0).toUpperCase() + s.origin.slice(1)}</td>
                  <td className="py-4 text-sm text-right text-white/80">{s.visits}</td>
                  <td className="py-4 text-sm text-right text-white/80">{s.cta_clicks}</td>
                  <td className="py-4 text-sm text-right text-white/80">{s.wa_clicks}</td>
                  <td className="py-4 text-sm text-right text-white/80">{s.messages}</td>
                  <td className="py-4 text-sm text-right font-semibold text-vyon-yellow">
                    {s.conversionRate}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/40 mt-2">
        Fuente: tabla analytics_events. Orígenes detectados por parámetro UTM utm_source (TikTok, IG, YT, WhatsApp, Directo).
      </p>
    </div>
  )
}

function StatCard({ label, value, iconClass }: { label: string; value: React.ReactNode; iconClass: string }) {
  return (
    <div className="vyon-card p-5 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br from-vyon-dark to-vyon-navy blur-2xl pointer-events-none" />
      <div className="relative z-10 flex items-start justify-between mb-3">
        <p className="text-sm text-white/50">{label}</p>
      </div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
    </div>
  )
}
