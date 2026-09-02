export type MockTask = {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  assignee: string
  avatar: string
  dueDate: string
  tags: string[]
  project: string
}

export type MockProject = {
  id: string
  name: string
  color: string
  tasks: number
  progress: number
}

export type MockWorkspace = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

export const mockWorkspaces: MockWorkspace[] = [
  { id: 'w1', name: 'Vyon HQ', role: 'owner' },
  { id: 'w2', name: 'Marketing', role: 'admin' },
  { id: 'w3', name: 'Producto', role: 'member' },
]

export const mockProjects: MockProject[] = [
  { id: 'p1', name: 'Rediseño Web', color: '#FFC837', tasks: 24, progress: 65 },
  { id: 'p2', name: 'Lanzamiento App', color: '#FF8008', tasks: 18, progress: 40 },
  { id: 'p3', name: 'Q3 Campaña', color: '#22D3EE', tasks: 12, progress: 80 },
  { id: 'p4', name: 'Onboarding', color: '#A78BFA', tasks: 9, progress: 20 },
]

export const mockTasks: MockTask[] = [
  {
    id: 't1',
    title: 'Diseñar landing page principal',
    description: 'Crear wireframes y mockups de la nueva página de inicio con enfoque en conversiones.',
    status: 'todo',
    priority: 'high',
    assignee: 'María González',
    avatar: 'MG',
    dueDate: '15 Sep',
    tags: ['Diseño', 'UX'],
    project: 'Rediseño Web',
  },
  {
    id: 't2',
    title: 'Configurar dominio y DNS',
    description: 'Mover el dominio principal a Cloudflare y configurar registros DNS adecuados.',
    status: 'todo',
    priority: 'medium',
    assignee: 'Carlos Ruiz',
    avatar: 'CR',
    dueDate: '10 Sep',
    tags: ['DevOps'],
    project: 'Rediseño Web',
  },
  {
    id: 't3',
    title: 'Entrevistar 5 usuarios beta',
    description: 'Realizar entrevistas de usabilidad con clientes del plan piloto.',
    status: 'todo',
    priority: 'low',
    assignee: 'Ana Torres',
    avatar: 'AT',
    dueDate: '22 Sep',
    tags: ['Investigación'],
    project: 'Onboarding',
  },
  {
    id: 't4',
    title: 'Integrar pasarela de pagos Stripe',
    description: 'Conectar Stripe para suscripciones mensuales y anuales con prueba de 14 días.',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Diego Pérez',
    avatar: 'DP',
    dueDate: '12 Sep',
    tags: ['Backend', 'Pagos'],
    project: 'Lanzamiento App',
  },
  {
    id: 't5',
    title: 'Crear dashboard analítico',
    description: 'Panel de métricas con usuarios activos, MRR, churn y cohortes.',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'Sofía López',
    avatar: 'SL',
    dueDate: '18 Sep',
    tags: ['Frontend', 'Charts'],
    project: 'Lanzamiento App',
  },
  {
    id: 't6',
    title: 'Campaña email lanzamiento',
    description: 'Secuencia de 5 emails para lista de espera previa al lanzamiento.',
    status: 'in_progress',
    priority: 'high',
    assignee: 'María González',
    avatar: 'MG',
    dueDate: '20 Sep',
    tags: ['Marketing'],
    project: 'Q3 Campaña',
  },
  {
    id: 't7',
    title: 'Setup entorno staging',
    description: 'Ambiente aislado para pruebas con datos de ejemplo.',
    status: 'done',
    priority: 'medium',
    assignee: 'Carlos Ruiz',
    avatar: 'CR',
    dueDate: '05 Sep',
    tags: ['DevOps'],
    project: 'Lanzamiento App',
  },
  {
    id: 't8',
    title: 'Logotipo e identidad visual',
    description: 'Entregar brandbook completo con paletas, tipografías y usos.',
    status: 'done',
    priority: 'high',
    assignee: 'Ana Torres',
    avatar: 'AT',
    dueDate: '01 Sep',
    tags: ['Diseño', 'Branding'],
    project: 'Rediseño Web',
  },
  {
    id: 't9',
    title: 'Guía de estilo componentes',
    description: 'Documentación de componentes UI para Design System.',
    status: 'done',
    priority: 'low',
    assignee: 'Sofía López',
    avatar: 'SL',
    dueDate: '03 Sep',
    tags: ['Docs'],
    project: 'Rediseño Web',
  },
]
