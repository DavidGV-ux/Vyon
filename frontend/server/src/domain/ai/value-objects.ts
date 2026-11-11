export const OUTPUT_KINDS = ['finanzas', 'tareas', 'resumenes'] as const
export type OutputKind = (typeof OUTPUT_KINDS)[number]

export function isOutputKind(value: unknown): value is OutputKind {
  return typeof value === 'string' && (OUTPUT_KINDS as readonly string[]).includes(value)
}

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export type AiProviderName = 'anthropic' | 'openai' | 'deterministic'

export type Strictness = 'relaxed' | 'balanced' | 'strict'

export type SourceModality = 'text' | 'image' | 'audio' | 'document'

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const FINANCE_TYPES = ['income', 'expense'] as const
export type FinanceType = (typeof FINANCE_TYPES)[number]

export const SENTIMENTS = ['positive', 'neutral', 'negative'] as const
export type Sentiment = (typeof SENTIMENTS)[number]
