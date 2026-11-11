import type { EngagementProfile, MessageTemplate, WhatsAppSendRequest, WhatsAppSendResult } from './entities.js'
import type { MessageKind, MessageLanguage } from './value-objects.js'

export interface MessagingProviderPort {
  readonly name: string
  send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult>
}

export interface MessageTemplateRepositoryPort {
  getActive(kind: MessageKind, language?: MessageLanguage, step?: number): Promise<MessageTemplate>
  listVersions(kind: MessageKind): Promise<string[]>
}

export interface EngagementRepositoryPort {
  save(profile: EngagementProfile): Promise<void>
  findById(userId: string): Promise<EngagementProfile | null>
  findInactive(thresholdDays: number, now: Date): Promise<EngagementProfile[]>
}
