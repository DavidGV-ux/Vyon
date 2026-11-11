// ============================================================================
// VYON — Prompt Maestro (versiones)
// MECL-025: Calibración y despliegue v1.1 para corregir interpretaciones
//
// Buenas prácticas:
// - Cada versión es inmutable (solo lectura).
// - La versión activa se controla por variable de entorno PROMPT_MAESTRO_VERSION.
// - Se expone una función getActivePrompt() para usarse en el backend serverless.
// - Nunca se exponen prompts al frontend; este archivo solo se importa en el
//   backend (server.js / lambda) o en scripts de despliegue.
// ============================================================================

export type PromptVersion = 'v1.0' | 'v1.1'

export interface PromptDefinition {
  version: PromptVersion
  name: string
  description: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  calibratedAt: string
  calibratedBy: string
  fixes: string[]
}

// v1.0 — Prompt original (base). Se conserva para auditoría/rollback.
const PROMPT_V1_0: PromptDefinition = {
  version: 'v1.0',
  name: 'Prompt Maestro base',
  description: 'Versión inicial del prompt maestro del bot de Vyon.',
  systemPrompt: `Eres el asistente de Vyon, una plataforma de gestión de tareas y proyectos.
Ayudas al usuario a crear tareas, consultar su tablero Kanban y responder dudas sobre el producto.
Responde siempre en español, de forma concisa y amable.`,
  temperature: 0.7,
  maxTokens: 512,
  calibratedAt: '2026-10-01',
  calibratedBy: 'Equipo Tecnología',
  fixes: [],
}

// v1.1 — Versión calibrada (MECL-025). Corrige interpretaciones erróneas:
// - Evita alucinar fechas de vencimiento cuando el usuario no las especifica.
// - No asume que "crear tarea" implica asignarla automáticamente al usuario sin confirmar.
// - Distingue claramente entre acción de voz y acción de texto.
// - Rechaza peticiones de transacciones financieras sin confirmación explícita del monto.
const PROMPT_V1_1: PromptDefinition = {
  version: 'v1.1',
  name: 'Prompt Maestro v1.1',
  description:
    'Versión calibrada para corregir interpretaciones del bot (MECL-025). Añade guardrails de fechas, asignación y pagos.',
  systemPrompt: `Eres el asistente de Vyon, plataforma de gestión de tareas y proyectos.

REGLAS OBLIGATORIAS:
1. Nunca inventes fechas de vencimiento. Si el usuario no especifica una fecha, deja el campo sin asignar y pregúntale.
2. No asignes una tarea al usuario automáticamente. Si dice "crear una tarea", pregúntale a quién asignarla o déjala sin asignar hasta confirmar.
3. Distingue acciones de voz (audio) de acciones de texto (chat). No asumas que un comando de voz implica ejecución inmediata sin confirmación.
4. No procese transacciones financieras (ingresos/gastos/facturas) sin que el usuario confirme explícitamente el monto y el concepto. Si falta alguno, solicítelo.
5. Responde siempre en español, de forma concisa y amable. Máximo 3 oraciones por respuesta salvo que se pida detalle.
6. Si el usuario pide algo fuera del alcance de Vyon (finanzas personales ajenas, código, temas no relacionados), redirígele amablemente a las funciones del producto.

Funciones disponibles: crear tarea, listar tareas por estado, cambiar estado de tarea, crear proyecto, consultar saldo de billetera (solo lectura).`,
  temperature: 0.4,
  maxTokens: 768,
  calibratedAt: '2026-10-12',
  calibratedBy: 'Equipo Tecnología (MECL-025)',
  fixes: [
    'No alucinar fechas de vencimiento no especificadas',
    'No asignar tareas automáticamente sin confirmación',
    'Distingue acción de voz vs texto',
    'Requiere confirmación explícita de monto y concepto para transacciones financieras',
    'Límite de 3 oraciones por respuesta por defecto',
  ],
}

const PROMPTS: Record<PromptVersion, PromptDefinition> = {
  'v1.0': PROMPT_V1_0,
  'v1.1': PROMPT_V1_1,
}

export function getPromptDefinition(version: PromptVersion): PromptDefinition {
  const prompt = PROMPTS[version]
  if (!prompt) throw new Error(`Prompt version '${version}' no encontrada`)
  return prompt
}

export function getActivePromptVersion(): PromptVersion {
  return 'v1.1' // versión activa tras despliegue v1.1 (MECL-025). Sobrescrito por PROMPT_MAESTRO_VERSION en el backend.
}

export function getActivePrompt(): PromptDefinition {
  return getPromptDefinition(getActivePromptVersion())
}

export { PROMPT_V1_0, PROMPT_V1_1 }
