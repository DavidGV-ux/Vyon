import { Link } from 'react-router-dom'
import VyonLogo from '../components/VyonLogo'
import {
  Sparkles,
  CheckCircle2,
  BarChart3,
  Users,
  CalendarCheck,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react'

const features = [
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Tableros Kanban',
    desc: 'Visualiza el flujo de trabajo y arrastra tareas entre columnas en segundos.',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Colaboración en equipo',
    desc: 'Asigna responsables, comenta y mantén a todos sincronizados en tiempo real.',
  },
  {
    icon: <CalendarCheck className="w-6 h-6" />,
    title: 'Plazos inteligentes',
    desc: 'Fechas de vencimiento, recordatorios y vistas de calendario para no perder nada.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Automatizaciones',
    desc: 'Flujos automáticos que ahorran horas de trabajo repetitivo cada semana.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Permisos por roles',
    desc: 'Owner, admin o miembro: controla exactamente quién puede ver o editar cada cosa.',
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Reportes en un clic',
    desc: 'Métricas, gráficas y exportaciones PDF para analizar el progreso del equipo.',
  },
]

const testimonials = [
  {
    name: 'Laura Martínez',
    role: 'CEO, StartUp Latam',
    quote:
      'VYON transformó cómo organizamos sprints. Redujimos el tiempo de planificación en un 60%.',
  },
  {
    name: 'Andrés Felipe',
    role: 'CTO, FintechXYZ',
    quote:
      'El tablero Kanban es la mejor UX que he probado. Mi equipo lo adoptó sin capacitación.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-vyon-dark relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-vyon-yellow/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-vyon-orange/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <VyonLogo size="md" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition">Características</a>
            <a href="#pricing" className="hover:text-white transition">Precios</a>
            <a href="#about" className="hover:text-white transition">Nosotros</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-white/80 hover:text-white transition">
              Iniciar sesión
            </Link>
            <Link to="/register" className="vyon-btn-primary text-sm py-2 px-5">
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-vyon-gradient-soft border border-vyon-yellow/20 rounded-full px-4 py-1.5 mb-8">
          <Sparkles className="w-4 h-4 text-vyon-yellow" />
          <span className="text-sm font-medium text-white/90">
            Nuevo: automatizaciones y reportes avanzados
          </span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] max-w-5xl mx-auto">
          Gestiona proyectos y tareas{' '}
          <span className="vyon-gradient-text">sin el caos.</span>
        </h1>
        <p className="mt-8 text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
          VYON es la plataforma de productividad para equipos que quieren
          enfocarse en lo importante. Tableros Kanban, tareas, proyectos y
          reportes, todo en un solo lugar.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register" className="vyon-btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
            Empezar gratis
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/login" className="vyon-btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center">
            Ya tengo cuenta
          </Link>
        </div>

        {/* Social proof */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/40 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-vyon-yellow" />
            Sin tarjeta de crédito
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-vyon-yellow" />
            14 días de prueba gratuita
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-vyon-yellow" />
            Cancela cuando quieras
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            Todo lo que necesitas para <span className="vyon-gradient-text">entregar resultados.</span>
          </h2>
          <p className="mt-4 text-white/60 text-lg">
            Características pensadas para equipos de todos los tamaños, desde startups hasta empresas.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="vyon-card p-8 hover:border-vyon-yellow/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-vyon-gradient flex items-center justify-center text-vyon-dark mb-5 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-white/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="vyon-card p-8">
              <div className="flex items-center gap-1 mb-5 text-vyon-yellow">
                {'★★★★★'.split('').map((s, j) => (
                  <span key={j}>{s}</span>
                ))}
              </div>
              <p className="text-white/80 text-lg leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-vyon-gradient flex items-center justify-center text-vyon-dark font-bold">
                  {t.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-sm text-white/50">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        <div className="vyon-card bg-vyon-gradient-soft border-vyon-yellow/20 p-12 md:p-16 text-center rounded-3xl">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            ¿Listo para <span className="vyon-gradient-text">multiplicar tu productividad?</span>
          </h2>
          <p className="mt-4 text-white/70 text-lg max-w-xl mx-auto">
            Únete a los miles de equipos que ya trabajan mejor con VYON.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="vyon-btn-primary text-lg w-full sm:w-auto">
              Crear cuenta gratuita
            </Link>
            <Link to="/login" className="vyon-btn-secondary w-full sm:w-auto">
              Ver demo (iniciar sesión)
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <VyonLogo size="sm" />
          <p className="text-sm text-white/40">
            © {new Date().getFullYear()} VYON. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <a href="#" className="hover:text-white transition">Privacidad</a>
            <a href="#" className="hover:text-white transition">Términos</a>
            <a href="#" className="hover:text-white transition">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
