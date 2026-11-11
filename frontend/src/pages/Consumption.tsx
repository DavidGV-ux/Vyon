import { useEffect, useState } from 'react'
import { supabase } from '../supabase/client'
import { CohortConsumption } from '../supabase/types'

type CohortRow = {
  cohort: string
  size: number
  tokens: number
  dbReads: number
  dbWrites: number
  storageMB: number
  activeD3: number
  activeD7: number
  arpuCents: number
  retentionD3: number
  retentionD7: number
}

export default function Consumption() {
  const [rows, setRows] = useState<CohortRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error: supabaseError } = await supabase
          .from('cohort_consumption')
          .select('*')
          .order('cohort_date', { ascending: false })

        if (supabaseError) throw supabaseError

        const items = (data || []) as CohortConsumption[]
        if (!cancelled) {
          setRows(
            items.map(c => ({
              cohort: c.cohort_date,
              size: c.cohort_size,
              tokens: c.tokens_used,
              dbReads: c.db_read_operations,
              dbWrites: c.db_write_operations,
              storageMB: Math.round(c.db_storage_bytes / 1024 / 1024),
              activeD3: c.active_users_day3,
              activeD7: c.active_users_day7,
              arpuCents: c.avg_revenue_per_user_cents,
              retentionD3: c.cohort_size ? Math.round((c.active_users_day3 / c.cohort_size) * 1000) / 10 : 0,
              retentionD7: c.cohort_size ? Math.round((c.active_users_day7 / c.cohort_size) * 1000) / 10 : 0,
            }))
          )
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando consumo')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Consumo por cohorte</h1>
        <p className="text-white/60 mt-1">
          Tokens, operaciones de base de datos y retención por fecha de cohorte
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="vyon-card p-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs text-white/40 uppercase tracking-wider">
              <th className="pb-3 font-semibold">Cohorte</th>
              <th className="pb-3 font-semibold text-right">Usuarios</th>
              <th className="pb-3 font-semibold text-right">Tokens</th>
              <th className="pb-3 font-semibold text-right">Lecturas DB</th>
              <th className="pb-3 font-semibold text-right">Escrit. DB</th>
              <th className="pb-3 font-semibold text-right">Almacen. (MB)</th>
              <th className="pb-3 font-semibold text-right">Act. Día 3</th>
              <th className="pb-3 font-semibold text-right">Act. Día 7</th>
              <th className="pb-3 font-semibold text-right">ARPU (¢)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-white/40">Cargando...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-white/40">Sin datos de consumo registrados.</td>
              </tr>
            ) : (
              rows.map(r => (
                <tr key={r.cohort} className="border-b border-white/5 hover:bg-white/3 transition">
                  <td className="py-4 text-sm font-medium">{r.cohort}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.size}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.tokens.toLocaleString()}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.dbReads.toLocaleString()}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.dbWrites.toLocaleString()}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.storageMB}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.activeD3}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.activeD7}</td>
                  <td className="py-4 text-sm text-right text-white/80">{r.arpuCents}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/40 mt-2">
        Fuente: tabla cohort_consumption. Se alimenta por un job/serverless que agrega consumo por fecha de cohorte (MECL-024).
      </p>
    </div>
  )
}
