// ============================================================================
// VYON — Prompt Maestro (CommonJS para backend serverless)
// MECL-025: v1.1 desplegado como versión activa por defecto
// ============================================================================

const PROMPT_V1_0 = {
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

const PROMPT_V1_1 = {
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

const PROMPTS = { 'v1.0': PROMPT_V1_0, 'v1.1': PROMPT_V1_1 }

function getPromptDefinition(version) {
  const prompt = PROMPTS[version]
  if (!prompt) throw new Error(`Prompt version '${version}' no encontrada`)
  return prompt
}

function getActivePromptVersion() {
  const envVersion = process.env && process.env.PROMPT_MAESTRO_VERSION
  if (envVersion === 'v1.0' || envVersion === 'v1.1') return envVersion
  return 'v1.1' // versión activa tras despliegue v1.1 (MECL-025)
}

function getActivePrompt() {
  return getPromptDefinition(getActivePromptVersion())
}

module.exports = {
  PROMPT_V1_0,
  PROMPT_V1_1,
  getPromptDefinition,
  getActivePromptVersion,
  getActivePrompt,
}
