import type { OutputKind, Language, Strictness, TaskStatus, TaskPriority, FinanceType, Sentiment } from './value-objects.js'

export type TextPart = { readonly kind: 'text'; readonly text: string }
export type ImagePart = { readonly kind: 'image'; readonly mediaType: string; readonly base64: string }
export type AudioPart = { readonly kind: 'audio'; readonly mediaType: string; readonly base64: string; readonly durationSeconds?: number }
export type MultimodalPart = TextPart | ImagePart | AudioPart

export type MultimodalInput = {
  readonly parts: readonly MultimodalPart[]
  readonly language: Language
  readonly context?: string
  readonly workspaceId?: string
  readonly projectId?: string
}

export type MasterPromptRequest = {
  readonly requestId: string
  readonly outputKind: OutputKind
  readonly strictness: Strictness
  readonly input: MultimodalInput
}

export type FinanceEntry = {
  readonly description: string
  readonly amount: number
  readonly type: FinanceType
  readonly category: string
  readonly date: string
  readonly paymentMethod: string | null
  readonly confidence: number
}

export type FinanceReport = {
  readonly currency: string
  readonly entries: readonly FinanceEntry[]
  readonly totals: { readonly income: number; readonly expense: number; readonly net: number }
}

export type TaskDraft = {
  readonly title: string
  readonly description: string
  readonly priority: TaskPriority
  readonly status: TaskStatus
  readonly dueDate: string | null
  readonly assignee: string | null
  readonly project: string | null
  readonly tags: readonly string[]
  readonly estimatedHours: number | null
}

export type TaskReport = {
  readonly tasks: readonly TaskDraft[]
}

export type SummaryResult = {
  readonly title: string
  readonly summary: string
  readonly keyPoints: readonly string[]
  readonly actionItems: readonly string[]
  readonly sentiment: Sentiment
  readonly entities: readonly string[]
  readonly topics: readonly string[]
}

export type SummaryReport = SummaryResult

export type ParsedData = FinanceReport | TaskReport | SummaryReport

export type CalibrationIssue = {
  readonly code: string
  readonly severity: 'error' | 'warning'
  readonly path: string
  readonly message: string
  readonly hint?: string
}

export type CalibrationReport = {
  readonly score: number
  readonly passed: boolean
  readonly attempts: number
  readonly issues: readonly CalibrationIssue[]
  readonly repairs: readonly string[]
}

export type ParsedDocument = {
  readonly requestId: string
  readonly outputKind: OutputKind
  readonly provider: string
  readonly model: string
  readonly data: ParsedData
  readonly calibration: CalibrationReport
  readonly rawResponse: string
  readonly latencyMs: number
  readonly createdAt: string
}

export type TranscriptSegment = {
  readonly id: number
  readonly start: number
  readonly end: number
  readonly text: string
}

export type TranscriptionResult = {
  readonly text: string
  readonly language: string
  readonly durationSeconds: number
  readonly segments: readonly TranscriptSegment[]
  readonly model: string
  readonly latencyMs: number
}
