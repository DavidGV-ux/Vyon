export const WHATSAPP_CHANNELS = ['whatsapp'] as const
export type WhatsAppChannel = (typeof WHATSAPP_CHANNELS)[number]

export const MESSAGE_KINDS = ['retention', 'reactivation'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export function isMessageKind(value: unknown): value is MessageKind {
  return typeof value === 'string' && (MESSAGE_KINDS as readonly string[]).includes(value)
}

export const MESSAGE_STATUSES = ['queued', 'sent', 'failed'] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export const SUPPORTED_MESSAGE_LANGUAGES = ['es', 'en'] as const
export type MessageLanguage = (typeof SUPPORTED_MESSAGE_LANGUAGES)[number]

export function isMessageLanguage(value: unknown): value is MessageLanguage {
  return typeof value === 'string' && (SUPPORTED_MESSAGE_LANGUAGES as readonly string[]).includes(value)
}
