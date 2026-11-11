/**
 * Smoke test E2E del flujo integral MECL-041..044:
 *   estado Pro → paywall → checkout → factura PDF → recibo PDF →
 *   cola de audio con prioridad → conciliación de pagos.
 *
 * Uso: node server/tests/e2e/billing-flow.mjs   (exit != 0 si algo falla)
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(here, '../../..')
const PORT = Number(process.env.E2E_PORT ?? 3124)
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const USER = 'e2e-user-001'

const sleep = ms => new Promise(r => setTimeout(r, ms))
let failures = 0

function check(name, condition, detail = '') {
  if (!condition) failures++
  console.log(`  ${condition ? '✔' : '✘'} ${name}${detail ? ` (${detail})` : ''}`)
}

const json = (method, pathName, body) =>
  fetch(`${BASE}${pathName}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-user-id': USER },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) }))

async function startServer() {
  const bin = path.join(frontendDir, 'node_modules', '.bin', 'tsx')
  const child = spawn(bin, ['server/src/composition/server.ts'], {
    cwd: frontendDir,
    env: { ...process.env, PORT: String(PORT), LOG_LEVEL: 'error', AUTH_REQUIRED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.on('data', d => process.stderr.write(`[server] ${d}`))
  const deadline = Date.now() + 20_000
  for (;;) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return child
    } catch { /* esperar */ }
    if (Date.now() > deadline) {
      child.kill('SIGKILL')
      throw new Error('servidor no levantó en 20s')
    }
    await sleep(250)
  }
}

const server = await startServer()
console.log(`Servidor E2E en ${BASE}\n`)

try {
  console.log('[MECL-041] Estado inicial y paywall')
  const initial = await json('GET', `/billing/state?userId=${USER}`)
  check('estado 200', initial.status === 200)
  check('usuario sin suscripción → SUBSCRIPTION_NOT_FOUND',
    initial.data?.state?.state === 'SUBSCRIPTION_NOT_FOUND')
  check('features Pro bloqueadas', initial.data?.features?.pdf_invoices === false)
  check('versión de verificación 1.2', initial.data?.state?.version === '1.2')

  console.log('\n[MECL-044] Pago idempotente del checkout')
  const checkout = await json('POST', '/billing/checkout', {
    userId: USER,
    plan: 'pro',
    customerEmail: 'e2e@vyon.app',
  })
  check('checkout 201', checkout.status === 201, `status=${checkout.status}`)
  check('suscripción activa', checkout.data?.subscription?.status === 'active')
  check('estado verificado PRO_ACTIVE', checkout.data?.state?.state === 'PRO_ACTIVE')
  const invoiceId = checkout.data?.invoiceId
  check('factura emitida automáticamente', Boolean(invoiceId))

  console.log('\n[MECL-041] Verificación posterior del estado Pro')
  const after = await json('GET', `/billing/state?userId=${USER}`)
  check('isPro=true', after.data?.state?.isPro === true)
  check('features desbloqueadas', after.data?.features?.pdf_invoices === true
    && after.data?.features?.audio_priority === true)

  console.log('\n[MECL-042] Facturas y recibos PDF')
  const invoices = await json('GET', `/invoices?userId=${USER}`)
  check('1 factura listada', invoices.data?.items?.length === 1)
  check('factura marcada como pagada', invoices.data?.items?.[0]?.status === 'paid')
  check('recibo disponible', invoices.data?.items?.[0]?.hasReceipt === true)

  const pdf = await fetch(`${BASE}/invoices/${invoiceId}/pdf`, { headers: { 'x-user-id': USER } })
  const pdfBytes = Buffer.from(await pdf.arrayBuffer())
  check('PDF de factura descargable', pdf.status === 200 && pdfBytes.subarray(0, 8).toString('latin1') === '%PDF-1.4',
    `${pdfBytes.length} bytes`)
  check('nombre de archivo correcto', (pdf.headers.get('content-disposition') ?? '').includes('INV-'))

  const receipt = await fetch(`${BASE}/invoices/${invoiceId}/receipt/pdf`, { headers: { 'x-user-id': USER } })
  const receiptBytes = Buffer.from(await receipt.arrayBuffer())
  check('PDF de recibo descargable', receipt.status === 200 && receiptBytes.subarray(0, 8).toString('latin1') === '%PDF-1.4',
    `${receiptBytes.length} bytes`)

  console.log('\n[MECL-043] Cola de audio con prioridad Pro')
  const jobPro = await json('POST', '/audio/jobs', { fileName: 'pro-audio.webm' })
  const jobFree = await (async () => {
    const res = await fetch(`${BASE}/audio/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'free-user-001' },
      body: JSON.stringify({ userId: 'free-user-001', fileName: 'free-audio.webm', mediaType: 'audio/webm' }),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  })()
  check('job Pro aceptado (202)', jobPro.status === 202)
  check('job Pro con prioridad alta', jobPro.data?.priority === 'high')
  check('job Free con prioridad normal', jobFree.data?.priority === 'normal')

  await sleep(600)
  const stats = await json('GET', '/audio/stats')
  check('estadísticas de cola disponibles', typeof stats.data?.queueDepth === 'number')
  check('trabajos procesados ≥ 2', (stats.data?.processed ?? 0) >= 2, `processed=${stats.data?.processed}`)

  console.log('\n[MECL-044] Conciliación de pagos')
  const recon = await json('GET', '/payments/reconciliation')
  check('conciliación balanceada', recon.data?.balanced === true)
  check('cero pérdida (missingLocal=0, missingGateway=0)',
    recon.data?.missingLocal?.length === 0 && recon.data?.missingGateway?.length === 0)
  check('1 cobro en pasarela para 1 checkout', recon.data?.gatewayChargesTotal === 1,
    `charges=${recon.data?.gatewayChargesTotal}`)
} catch (error) {
  failures++
  console.error('Error inesperado:', error)
} finally {
  server.kill('SIGTERM')
  await sleep(400)
  server.kill('SIGKILL')
}

console.log(`\n${failures === 0 ? '✔ E2E OK — flujo MECL-041..044 verificado' : `✘ ${failures} verificaciones fallidas`}`)
process.exit(failures === 0 ? 0 : 1)
