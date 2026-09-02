import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import VyonLogo from './VyonLogo'
import {
  LayoutGrid,
  FolderKanban,
  CheckSquare,
  Settings,
  ChevronDown,
  Plus,
  LogOut,
  Bell,
  Search,
  User as UserIcon,
} from 'lucide-react'
import { mockWorkspaces, mockProjects } from '../data/mockData'

type Props = { children: ReactNode }

const navItems = [
  { to: '/dashboard', label: 'Espacios', icon: LayoutGrid, end: true },
  { to: '/dashboard/projects', label: 'Proyectos', icon: FolderKanban, end: false },
  { to: '/dashboard/tasks', label: 'Tareas', icon: CheckSquare, end: false },
  { to: '/dashboard/settings', label: 'Configuración', icon: Settings, end: false },
]

export default function DashboardLayout({ children }: Props) {
  const { user, signOut } = useAuth()
  const displayName =
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] ||
    'Usuario'
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-vyon-dark text-white flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-vyon-navy/40 backdrop-blur flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="p-5 border-b border-white/5">
          <VyonLogo size="md" />
        </div>

        {/* Workspace selector */}
        <div className="p-4 border-b border-white/5">
          <button className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-vyon-slate/60 hover:bg-vyon-slate transition border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-vyon-gradient flex items-center justify-center text-vyon-dark font-bold text-sm">
                {mockWorkspaces[0].name[0]}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">{mockWorkspaces[0].name}</p>
                <p className="text-xs text-white/40">
                  {mockWorkspaces[0].role}
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-vyon-gradient-soft text-white border border-vyon-yellow/30 shadow-vyon-glow'
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Projects list */}
        <div className="p-4 border-t border-white/5 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Proyectos
            </span>
            <button className="w-6 h-6 rounded-md bg-vyon-slate hover:bg-vyon-yellow/20 flex items-center justify-center text-white/50 hover:text-vyon-yellow transition">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {mockProjects.map(p => (
              <a
                key={p.id}
                href="#"
                onClick={e => e.preventDefault()}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/5 transition group"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: p.color }}
                />
                <span className="text-sm text-white/70 group-hover:text-white flex-1 truncate">
                  {p.name}
                </span>
                <span className="text-xs text-white/30">{p.tasks}</span>
              </a>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-vyon-gradient flex items-center justify-center text-vyon-dark font-bold text-sm">
              {initials || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              title="Cerrar sesión"
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-white/40 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-white/5 bg-vyon-dark/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6 gap-4">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                placeholder="Buscar tareas, proyectos, miembros..."
                className="vyon-input pl-12 py-2 h-10 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-10 h-10 rounded-xl bg-vyon-slate/60 hover:bg-vyon-slate transition flex items-center justify-center text-white/70 border border-white/5">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-vyon-gradient" />
            </button>
            <button className="w-10 h-10 rounded-full bg-vyon-gradient flex items-center justify-center text-vyon-dark font-bold text-sm shadow-vyon-glow">
              <UserIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
