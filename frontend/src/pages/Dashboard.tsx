import { useMemo, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import TaskCard from '../components/TaskCard'
import { mockTasks, mockProjects, MockTask } from '../data/mockData'
import { useBilling } from '../context/BillingContext'
import {
  Plus,
  Filter,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  ListTodo,
  GripVertical,
  TrendingUp,
  Users,
  Target,
  CalendarCheck,
} from 'lucide-react'

type ColumnDef = {
  key: MockTask['status']
  title: string
  color: string
  icon: typeof ListTodo
  accent: string
}

const columns: ColumnDef[] = [
  { key: 'todo', title: 'Por hacer', color: '#94A3B8', icon: ListTodo, accent: 'from-slate-500/20' },
  { key: 'in_progress', title: 'En progreso', color: '#FFC837', icon: Clock, accent: 'from-vyon-yellow/20' },
  { key: 'done', title: 'Hecho', color: '#34D399', icon: CheckCircle2, accent: 'from-emerald-500/20' },
]

export default function Dashboard() {
  const [activeProject, setActiveProject] = useState<string>('todos')
  const { can, openPaywall } = useBilling()

  const handleNewTask = () => {
    // Paywall automatizado (MECL-041): sin plan Pro se bloquea la acción
    if (!can('unlimited_projects')) {
      openPaywall('unlimited_projects')
      return
    }
    // Con plan Pro habilitado: crear tarea (demo)
    window.alert('Nueva tarea — disponible con tu plan Pro ✅')
  }

  const filteredTasks = useMemo(() => {
    if (activeProject === 'todos') return mockTasks
    return mockTasks.filter(t => t.project === activeProject)
  }, [activeProject])

  const totalTasks = filteredTasks.length
  const doneTasks = filteredTasks.filter(t => t.status === 'done').length
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0

  const stats = [
    {
      label: 'Progreso global',
      value: `${progress}%`,
      icon: <TrendingUp className="w-5 h-5" />,
      hint: `${doneTasks}/${totalTasks} completadas`,
      gradient: 'from-vyon-yellow/20 to-vyon-orange/20',
      bar: progress,
    },
    {
      label: 'Proyectos activos',
      value: `${mockProjects.length}`,
      icon: <Target className="w-5 h-5" />,
      hint: '+2 esta semana',
      gradient: 'from-cyan-500/20 to-blue-500/20',
      bar: 72,
    },
    {
      label: 'Miembros',
      value: '12',
      icon: <Users className="w-5 h-5" />,
      hint: '3 conectados ahora',
      gradient: 'from-violet-500/20 to-pink-500/20',
      bar: 48,
    },
    {
      label: 'Vencen esta semana',
      value: '7',
      icon: <CalendarCheck className="w-5 h-5" />,
      hint: '2 para hoy',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      bar: 30,
    },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/40 mb-1">Dashboard / Tablero principal</p>
            <h1 className="text-3xl font-black tracking-tight">
              Hola, <span className="vyon-gradient-text">bienvenido de vuelta</span> 👋
            </h1>
            <p className="mt-2 text-white/60">
              Aquí tienes una vista rápida de lo que está pasando hoy en tu equipo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="vyon-btn-secondary py-2.5 px-4 flex items-center gap-2 text-sm">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button
              onClick={handleNewTask}
              className="vyon-btn-primary py-2.5 px-5 flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva tarea
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="vyon-card p-5 relative overflow-hidden">
              <div
                className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} blur-2xl pointer-events-none`}
              />
              <div className="relative z-10 flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-vyon-slate flex items-center justify-center text-vyon-yellow">
                  {s.icon}
                </div>
                <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/40">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-white/50">{s.label}</p>
              <p className="text-3xl font-black tracking-tight mt-1">{s.value}</p>
              <p className="text-xs text-white/40 mt-1">{s.hint}</p>
              <div className="mt-4 h-1.5 rounded-full bg-vyon-slate overflow-hidden">
                <div
                  className="h-full bg-vyon-gradient rounded-full transition-all duration-700"
                  style={{ width: `${s.bar}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Project filter tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-2">
          <button
            onClick={() => setActiveProject('todos')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeProject === 'todos'
                ? 'bg-vyon-gradient-soft text-white border border-vyon-yellow/40'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos los proyectos
          </button>
          {mockProjects.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProject(p.name)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                activeProject === p.name
                  ? 'bg-vyon-gradient-soft text-white border border-vyon-yellow/40'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
              {p.name}
              <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full">
                {p.tasks}
              </span>
            </button>
          ))}
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {columns.map(col => {
            const tasks = filteredTasks.filter(t => t.status === col.key)
            return (
              <section key={col.key} className="vyon-kanban-col flex flex-col">
                {/* Col header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${col.color}15`, color: col.color }}
                    >
                      <col.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        {col.title}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-semibold">
                          {tasks.length}
                        </span>
                      </h3>
                      <p className="text-xs text-white/40">
                        {col.key === 'todo' && 'Pendientes de empezar'}
                        {col.key === 'in_progress' && 'En ejecución'}
                        {col.key === 'done' && 'Completadas'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-vyon-yellow transition">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 transition">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-3">
                  {tasks.length === 0 ? (
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center text-sm text-white/30">
                      <GripVertical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Arrastra tareas aquí
                    </div>
                  ) : (
                    tasks.map(task => <TaskCard key={task.id} task={task} />)
                  )}
                </div>

                {/* Add task */}
                <button className="mt-4 w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-vyon-yellow/40 text-white/40 hover:text-vyon-yellow text-sm font-medium transition flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Añadir tarea
                </button>
              </section>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
