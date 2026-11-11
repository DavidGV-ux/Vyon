import type { MessageKind, MessageStatus, MessageLanguage, WhatsAppChannel } from './value-objects.js'

export type MessageTemplate = {
  readonly kind: MessageKind
  readonly language: MessageLanguage
  readonly step: number | null
  readonly version: string
  readonly body: string
}

export type WhatsAppSendRequest = {
  readonly to: string
  readonly kind: MessageKind
  readonly body: string
  readonly referenceId?: string
}

export type WhatsAppSendResult = {
  readonly ok: boolean
  readonly providerMessageSid: string | null
  readonly status: MessageStatus
  readonly error?: string
}

export type SentMessageRecord = {
  readonly kind: MessageKind
  readonly step: number | null
  readonly at: string
}

export type EngagementProfile = {
  readonly userId: string
  readonly channel: WhatsAppChannel
  readonly phone: string
  readonly lastActivityAt: string
  readonly language: MessageLanguage
  readonly name?: string
  readonly link?: string
  readonly workspaceId?: string
  readonly sentMessages: readonly SentMessageRecord[]
}

export type ReactivationStep = {
  readonly step: number
  readonly kind: MessageKind
  readonly delayDays: number
}

export type EngagementDecision = {
  readonly userId: string
  readonly phone: string
  readonly kind: MessageKind
  readonly step: number | null
  readonly inactivityDays: number
}

export type DispatchOutcome = {
  readonly scanned: number
  readonly sent: number
  readonly skipped: number
  readonly failed: number
  readonly decisions: readonly EngagementDecision[]
}
