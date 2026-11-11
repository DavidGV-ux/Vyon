import type { MessagingProviderPort } from '../../domain/messaging/ports.js'
import type { WhatsAppSendRequest, WhatsAppSendResult } from '../../domain/messaging/entities.js'
import { httpPostForm } from '../ai/http-client.js'

export type TwilioWhatsAppOptions = {
  readonly accountSid: string
  readonly authToken: string
  readonly from: string
  readonly messagingServiceSid?: string
  readonly apiBase?: string
  readonly timeoutMs?: number
}

/** Normaliza a E.164 (+...) y devuelve el número sin prefijo de canal. */
export function normalizeE164(phone: string): string {
  const trimmed = phone.trim()
  const plus = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed
  const digits = plus.replace(/\D/g, '')
  return `+${digits}`
}

/**
 * Adaptador Meta WhatsApp Cloud API vía Twilio.
 * POST /2010-04-01/Accounts/{sid}/Messages.json con From/To en formato
 * `whatsapp:+E164`. Usa MessagingServiceSid si está configurado (recomendado
 * para plantillas aprobadas), o `From` directo.
 */
export class TwilioWhatsAppProvider implements MessagingProviderPort {
  readonly name = 'twilio-whatsapp'
  private readonly options: Required<Pick<TwilioWhatsAppOptions, 'apiBase' | 'timeoutMs'>> & TwilioWhatsAppOptions

  constructor(options: TwilioWhatsAppOptions) {
    this.options = {
      ...options,
      apiBase: options.apiBase ?? 'https://api.twilio.com',
      timeoutMs: options.timeoutMs ?? 8000,
    }
  }

  get configured(): boolean {
    return Boolean(this.options.accountSid && this.options.authToken && (this.options.messagingServiceSid || this.options.from))
  }

  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    if (!this.configured) {
      return { ok: false, providerMessageSid: null, status: 'failed', error: 'Twilio WhatsApp is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)' }
    }

    const url = `${this.options.apiBase.replace(/\/$/, '')}/2010-04-01/Accounts/${this.options.accountSid}/Messages.json`
    const auth = Buffer.from(`${this.options.accountSid}:${this.options.authToken}`).toString('base64')

    const form = new FormData()
    form.set('To', `whatsapp:${normalizeE164(request.to)}`)
    form.set('Body', request.body)
    if (this.options.messagingServiceSid) {
      form.set('MessagingServiceSid', this.options.messagingServiceSid)
    } else {
      form.set('From', `whatsapp:${normalizeE164(this.options.from)}`)
    }

    const result = await httpPostForm(
      url,
      {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      form,
      AbortSignal.timeout(this.options.timeoutMs),
    )

    if (!result.ok) {
      return { ok: false, providerMessageSid: null, status: 'failed', error: result.error.message }
    }

    let payload: { sid?: string; status?: string; code?: number; message?: string }
    try {
      payload = JSON.parse(result.body) as typeof payload
    } catch {
      return { ok: false, providerMessageSid: null, status: 'failed', error: `Invalid Twilio response: ${result.body.slice(0, 200)}` }
    }

    if (!payload.sid) {
      return { ok: false, providerMessageSid: null, status: 'failed', error: payload.message ?? 'Twilio returned no message sid' }
    }

    return { ok: true, providerMessageSid: payload.sid, status: 'sent' }
  }
}

/** Adaptador usado cuando no hay credenciales: nunca envía, solo reporta. */
export class UnconfiguredMessagingProvider implements MessagingProviderPort {
  readonly name = 'unconfigured'

  async send(): Promise<WhatsAppSendResult> {
    return { ok: false, providerMessageSid: null, status: 'failed', error: 'Messaging provider not configured' }
  }
}
