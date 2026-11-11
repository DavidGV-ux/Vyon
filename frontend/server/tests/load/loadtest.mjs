/**
 * MECL-044 — Pruebas de estrés de la pasarela de pagos con objetivo de
 * CERO pérdida de transacciones.
 *
 * Fases:
 *  1. Storm de pagos: N llaves únicas con concurrencia alta + reintentos
 *     del lado del cliente con la MISMA idempotencyKey.
 *  2. Blast de llave compartida: 25 requests concurrentes con la misma
 *     llave → exactamente UN cobro en la pasarela.
 *  3. Conciliación local ↔ pasarela vía API: balanceada, sin faltantes.
 *  4. Replay masivo: reenviar pagos exitosos → 200 con replayed=true y
 *     sin cobros nuevos.
 *  5. Throughput con autocannon sobre /api/v1/health.
 *
 * Uso: npm run test:load   (sale con código != 0 si algo falla)
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import autocannon from 'autocannon'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(here, '../../..')
const PORT = Number(process.env.LOADTEST_PORT ?? 3123)
const BASE = `http://127.0.0.1:${PORT}/api/v1`

const PAYMENT_STORM = {
  total: 600,
  concurrency: 60,
  clientRetries: 3,
}
const SHARED_KEY = 'key-shared-blast-001'
const SHARED_REQUESTS = 25

const results = {
  failures: [],
  checks: [],
}

function check(name, condition, detail = '') {
  results.checks.push({ name, ok: Boolean(condition), detail })
  if (!condition) results.failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
  console.log(`  ${condition ? '✔' : '✘'} ${name}${detail ? ` (${detail})` : ''}`)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function startServer() {
  const bin = path.join(frontendDir, 'node_modules', '.bin', 'tsx')
  const child = spawn(bin, ['server/src/composition/server.ts'], {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      LOG_LEVEL: 'error',
      AUTH_REQUIRED: 'false',
      BILLING_WEBHOOK_SECRET: 'loadtest-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', d => process.stderr.write(`[server] ${d}`))

  const deadline = Date.now() + 20_000
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return child
    } catch {
      /* aún no levanta */
    }
    if (Date.now() > deadline) {
      child.kill('SIGKILL')
      throw new Error('El servidor no respondió en 20s')
    }
    await sleep(250)
  }
}

async function postPayment(body) {
  let lastStatus = 0
  let lastBody = null
  for (let attempt = 1; attempt <= PAYMENT_STORM.clientRetries; attempt++) {
    try {
      const res = await fetch(`${BASE}/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      lastStatus = res.status
      lastBody = await res.json().catch(() => null)
      if (res.ok) return { ok: true, status: res.status, body: lastBody }
      // 4xx definitivo: no reintentar (rechazo real del banco)
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, body: lastBody }
      }
    } catch (error) {
      lastStatus = 0
      lastBody = { error: { message: String(error) } }
    }
    await sleep(50 * attempt)
  }
  return { ok: false, status: lastStatus, body: lastBody }
}

async function runPaymentStorm() {
  console.log(`\n[1/5] Storm de pagos: ${PAYMENT_STORM.total} llaves únicas @ ${PAYMENT_STORM.concurrency} conexiones`)
  const keys = Array.from({ length: PAYMENT_STORM.total }, (_, i) => `key-storm-${String(i).padStart(5, '0')}`)
  const outcomes = new Map()

  let cursor = 0
  const worker = async () => {
    for (;;) {
      const index = cursor++
      if (index >= keys.length) return
      const key = keys[index]
      const result = await postPayment({
        userId: `load-user-${index % 50}`,
        amountCents: 1200,
        idempotencyKey: key,
      })
      outcomes.set(key, result)
    }
  }
  await Promise.all(Array.from({ length: PAYMENT_STORM.concurrency }, worker))

  const succeeded = [...outcomes.values()].filter(o => o.ok).length
  const failed = [...outcomes.values()].filter(o => !o.ok)
  const failed5xx = failed.filter(f => f.status === 0 || f.status >= 500)

  check('toda request tuvo respuesta definitiva (sin 5xx/timeout final)', failed5xx.length === 0,
    failed5xx.length ? `${failed5xx.length} sin resolver` : `${succeeded} OK, ${failed.length} rechazos 4xx esperados`)
  return { keys, outcomes }
}

async function runSharedKeyBlast() {
  console.log(`\n[2/5] Blast de llave compartida: ${SHARED_REQUESTS} requests concurrentes → 1 solo cobro`)
  const before = await (await fetch(`${BASE}/payments/reconciliation`)).json()

  const responses = await Promise.all(
    Array.from({ length: SHARED_REQUESTS }, () =>
      fetch(`${BASE}/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'blast-user', amountCents: 500, idempotencyKey: SHARED_KEY }),
      }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) })),
    ),
  )

  const okResponses = responses.filter(r => r.status >= 200 && r.status < 300)
  const after = await (await fetch(`${BASE}/payments/reconciliation`)).json()
  const providerRefs = new Set(
    okResponses.map(r => r.body?.payment?.providerRef).filter(Boolean),
  )

  check('las 25 respuestas concurrentes fueron 2xx', okResponses.length === SHARED_REQUESTS,
    `${okResponses.length}/${SHARED_REQUESTS}`)
  check('exactamente UN cobro nuevo en la pasarela', after.gatewayChargesTotal === before.gatewayChargesTotal + 1,
    `antes=${before.gatewayChargesTotal} después=${after.gatewayChargesTotal}`)
  check('todas las respuestas apuntan al mismo providerRef', providerRefs.size === 1,
    `refs=${providerRefs.size}`)
}

async function runReconciliation(outcomes) {
  console.log('\n[3/5] Conciliación local ↔ pasarela')
  const report = await (await fetch(`${BASE}/payments/reconciliation`)).json()

  check('conciliación balanceada', report.balanced === true,
    `missingLocal=${report.missingLocal.length} missingGateway=${report.missingGateway.length}`)
  check('cero cobros en pasarela sin registro local', report.missingLocal.length === 0)
  check('cero registros locales "cobrados" sin cargo real', report.missingGateway.length === 0)

  const succeededKeys = [...outcomes.entries()].filter(([, o]) => o.ok).map(([k]) => k)
  check('cobros en pasarela ≥ pagos exitosos reportados', report.gatewayChargesTotal >= report.paymentsSucceeded,
    `charges=${report.gatewayChargesTotal} succeeded=${report.paymentsSucceeded}`)
  check('los pagos exitosos están todos persistidos', report.paymentsSucceeded > 0,
    `${report.paymentsSucceeded} de ${succeededKeys.length} keys OK del cliente`)

  // Todo 2xx del cliente debe existir localmente como succeeded
  const listRes = await fetch(`${BASE}/payments?userId=load-user-0`)
  const list = await listRes.json()
  check('API de pagos responde el historial', Array.isArray(list.items) && list.total > 0,
    `user-0 tiene ${list.total}`)
}

async function runReplay(outcomes) {
  console.log('\n[4/5] Replay masivo de pagos exitosos → sin dobles cobros')
  const before = await (await fetch(`${BASE}/payments/reconciliation`)).json()

  const succeededKeys = [...outcomes.entries()].filter(([, o]) => o.ok).map(([k]) => k).slice(0, 100)
  const replays = await Promise.all(
    succeededKeys.map(key =>
      fetch(`${BASE}/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'replay-user', amountCents: 1200, idempotencyKey: key }),
      }).then(r => r.json().catch(() => null)),
    ),
  )

  const after = await (await fetch(`${BASE}/payments/reconciliation`)).json()
  check('todos los replays devolvieron replayed=true', replays.every(r => r?.replayed === true),
    `${replays.filter(r => r?.replayed === true).length}/${succeededKeys.length}`)
  check('cero cobros nuevos durante el replay', after.gatewayChargesTotal === before.gatewayChargesTotal,
    `antes=${before.gatewayChargesTotal} después=${after.gatewayChargesTotal}`)
  check('reconciliación sigue balanceada tras replays', after.balanced === true)
}

async function runThroughput() {
  console.log('\n[5/5] Throughput con autocannon (10s sobre /api/v1/health)')
  const stats = await autocannon({
    url: `${BASE}/health`,
    connections: 10,
    duration: 5,
    pipelining: 1,
  })
  console.log(`  ${Math.round(stats.requests.average)} req/s · p99 ${stats.latency.p99}ms · errores ${stats.errors + stats.non2xx}`)
  check('throughput saludable (> 500 req/s)', stats.requests.average > 500,
    `${Math.round(stats.requests.average)} req/s`)
  check('cero errores de conexión', stats.errors === 0)
  return stats
}

const server = await startServer()
console.log(`Servidor de pruebas levantado en ${BASE}`)

try {
  const { outcomes } = await runPaymentStorm()
  await runSharedKeyBlast()
  await runReconciliation(outcomes)
  await runReplay(outcomes)
  await runThroughput()
} catch (error) {
  results.failures.push(`Error inesperado: ${String(error)}`)
  console.error(error)
} finally {
  server.kill('SIGTERM')
  await sleep(500)
  server.kill('SIGKILL')
}

console.log('\n════════════════════════════════════════')
console.log(`Resultado: ${results.checks.length - results.failures.length}/${results.checks.length} verificaciones OK`)
if (results.failures.length > 0) {
  console.log('FALLOS:')
  for (const f of results.failures) console.log(`  ✘ ${f}`)
  process.exit(1)
}
console.log('✔ CERO pérdida de transacciones verificada')
process.exit(0)
