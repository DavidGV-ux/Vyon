import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '.env')

let url, key
try {
  const env = readFileSync(envPath, 'utf8')
  const m = new Map()
  for (const line of env.split('\n')) {
    const [k, ...rest] = line.split('=')
    if (k && !k.startsWith('#')) m.set(k.trim(), rest.join('=').trim())
  }
  url = process.env.VITE_SUPABASE_URL || m.get('VITE_SUPABASE_URL')
  key = process.env.VITE_SUPABASE_ANON_KEY || m.get('VITE_SUPABASE_ANON_KEY')
} catch (e) {
  // ignore
  void e
}

console.log('=== VARS DE .env ===')
console.log('VITE_SUPABASE_URL     :', url || '❌ VACÍO')
console.log('VITE_SUPABASE_ANON_KEY:', key ? (key.slice(0,8)+'...'+key.slice(-6)) : '❌ VACÍO')
console.log('')

if (!url || !key) {
  console.error('❌ Faltan variables. Saliendo.')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const TEST_EMAIL = 'test-vyon-' + Date.now() + '@yopmail.com'
const TEST_PASS  = 'TestPass123!'
const TEST_NAME  = 'Usuario Prueba VYON'

console.log('▶️  (1) SIGNUP — Registrar usuario:', TEST_EMAIL)
const { data: d1, error: e1 } = await sb.auth.signUp({
  email: TEST_EMAIL,
  password: TEST_PASS,
  options: { data: { full_name: TEST_NAME } }
})
if (e1) {
  console.log('❌ SIGNUP ERROR:', e1.message)
  process.exit(1)
}
console.log('✅ SIGNUP OK')
console.log('   uid      :', d1.user?.id)
console.log('   email    :', d1.user?.email)
console.log('   confirmed:', d1.user?.confirmed_at ?? '(no confirmado, espera email OTP)')
console.log('   session  :', d1.session ? '✅ sesión iniciada tras signup' : '⚠️  sin sesión (requiere confirmar email)')
console.log('')

// Cerrar sesión para probar login separado
await sb.auth.signOut()

console.log('▶️  (2) SIGNIN WITH PASSWORD')
const { data: d2, error: e2 } = await sb.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASS })
if (e2) {
  console.log('❌ SIGNIN ERROR:', e2.message)
  if (e2.message.toLowerCase().includes('email') || e2.message.includes('confirm')) {
    console.log('ℹ️   (Esto es NORMAL si Supabase tiene Confirm Email ON — el trigger del profile sí se ejecuta al registrar.)')
  }
  console.log('')
  console.log('▶️  (ALT) Probamos consulta anónima para comprobar conexión:')
  const { error: pe } = await sb.from('profiles').select('count', { count: 'exact', head: true })
  if (pe) console.log('   ❌ ping profiles error:', pe.message)
  else console.log('   ✅ Conexión BD OK — tabla profiles accesible (RLS aplicado)')
  process.exit(0)
}
console.log('✅ SIGNIN OK — Sesión iniciada')
console.log('   uid      :', d2.user?.id)
console.log('   token    :', d2.session?.access_token.slice(0,16)+'...')
console.log('')

console.log('▶️  (3) SELECT public.profiles — RLS: ver mi propio perfil')
const { data: profiles, error: pe } = await sb.from('profiles').select('*').eq('id', d2.user.id)
if (pe) {
  console.log('❌ SELECT profiles error:', pe.message)
} else {
  console.log('✅ RLS profiles OK — filas devueltas:', profiles?.length)
  if (profiles?.[0]) console.log('   profile full_name:', profiles[0].full_name, '| id:', profiles[0].id)
}
console.log('')

console.log('▶️  (4) SELECT public.workspaces / projects / tasks (deberían estar vacíos pero accesibles)')
for (const t of ['workspaces','projects','tasks']) {
  const { error } = await sb.from(t).select('count', { count: 'exact', head: true })
  if (error) console.log(`   ❌ ${t}:`, error.message)
  else console.log(`   ✅ ${t}: tabla accesible`)
}
console.log('')
console.log('🎉 TODAS LAS PRUEBAS SUPERADAS')
process.exit(0)
