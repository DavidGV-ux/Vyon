import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import VyonLogo from '../components/VyonLogo'
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signUp(fullName, email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-vyon-dark flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-10 right-1/4 w-[400px] h-[400px] rounded-full bg-vyon-orange/5 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-vyon-yellow/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <VyonLogo size="lg" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Crea tu cuenta</h1>
          <p className="text-white/50">Empieza gratis en menos de 60 segundos</p>
        </div>

        <form onSubmit={handleSubmit} className="vyon-card p-8 space-y-5">
          {success && (
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-4 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                ¡Cuenta creada! Revisa tu correo para confirmar (si aplica) o inicia sesión.
                Redirigiendo al dashboard...
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Nombre completo
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Tu nombre"
                className="vyon-input pl-12"
              />
            </div>
          </div>

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
              Contraseña <span className="text-white/40 font-normal">(mín. 6 caracteres)</span>
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
            disabled={loading || success}
            className="vyon-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
          </button>

          <p className="text-xs text-white/40 text-center leading-relaxed">
            Al registrarte aceptas nuestros Términos de Servicio y Política de Privacidad.
          </p>

          <div className="text-sm text-center text-white/50 pt-2 border-t border-white/5">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-vyon-yellow font-semibold hover:underline">
              Inicia sesión
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
