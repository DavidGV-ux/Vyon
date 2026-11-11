// MECL-059 — Sonda de estabilidad 24/7: verifica el health endpoint y sale
// con código distinto de cero si el servicio no está sano.
// Uso: node scripts/uptime-check.mjs   (o npm run uptime:check)
const url = process.env.HEALTH_URL ?? 'http://localhost:3000/api/v1/health'
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 5000)
const started = Date.now()

try {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const response = await fetch(url, { signal: controller.signal })
  clearTimeout(timer)

  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.status !== 'ok') {
    console.error(`UNHEALTHY: HTTP ${response.status} status=${String(body.status)} url=${url}`)
    process.exit(1)
  }

  console.log(`HEALTHY in ${Date.now() - started}ms: ${url} status=${body.status}`)
} catch (error) {
  console.error(`HEALTH CHECK FAILED: ${error instanceof Error ? error.message : String(error)} url=${url}`)
  process.exit(1)
}
