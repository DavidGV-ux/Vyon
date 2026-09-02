import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import VyonLogo from '../components/VyonLogo'
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-vyon-dark flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/3 w-[400px] h-[400px] rounded-full bg-vyon-yellow/5 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-vyon-orange/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <VyonLogo size="lg" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Bienvenido de vuelta</h1>
          <p className="text-white/50">Inicia sesión para continuar en tu workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="vyon-card p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="vyon-input pl-12"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="vyon-input pl-12"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="vyon-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>

          <div className="text-sm text-center text-white/50">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/register" className="text-vyon-yellow font-semibold hover:underline">
              Regístrate gratis
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-white/30 mt-8">
          ← <Link to="/" className="hover:text-white/60">Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}
