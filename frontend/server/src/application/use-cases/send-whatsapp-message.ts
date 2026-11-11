import type { MessageTemplateRepositoryPort, MessagingProviderPort } from '../../domain/messaging/ports.js'
import type { MessageTemplate, WhatsAppSendResult } from '../../domain/messaging/entities.js'
import type { MessageKind, MessageLanguage } from '../../domain/messaging/value-objects.js'
import type { Clock, IdGenerator, Logger, MetricsPort } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { ValidationError, MessageTemplateNotFoundError, WhatsappProviderError } from '../../domain/shared/errors.js'

export type SendWhatsAppMessageInput = {
  readonly to: string
  readonly kind: MessageKind
  readonly context?: Record<string, string>
  readonly language?: MessageLanguage
  readonly step?: number
  readonly referenceId?: string
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export function renderTemplate(body: string, context?: Record<string, string>): string {
  if (!context) return body
  return body.replace(PLACEHOLDER, (match, key: string) => context[key] ?? match)
}

export class SendWhatsAppMessageUseCase {
  constructor(
    private readonly provider: MessagingProviderPort,
    private readonly templates: MessageTemplateRepositoryPort,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly logger: Logger,
    private readonly metrics: MetricsPort,
  ) {}

  async execute(input: SendWhatsAppMessageInput): Promise<Result<WhatsAppSendResult, MessageTemplateNotFoundError | ValidationError | WhatsappProviderError>> {
    if (!input.to || input.to.trim().length === 0) {
      return err(new ValidationError('Recipient phone number is required'))
    }

    let template: MessageTemplate
    try {
      template = await this.templates.getActive(input.kind, input.language ?? 'es', input.step)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn('message template not found', { kind: input.kind, step: input.step, error: message })
      return err(new MessageTemplateNotFoundError(message, { kind: input.kind, step: input.step }))
    }
    if (!template) {
      return err(new MessageTemplateNotFoundError(`No template for kind=${input.kind} step=${String(input.step)}`))
    }

    const body = renderTemplate(template.body, input.context)
    const referenceId = input.referenceId ?? this.idGenerator.next()

    this.logger.info('sending whatsapp message', { kind: input.kind, step: input.step, provider: this.provider.name, referenceId })
    const startedAt = this.clock.monotonicMs()

    let result: WhatsAppSendResult
    try {
      result = await this.provider.send({ to: input.to, kind: input.kind, body, referenceId })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.metrics.increment('vyon_whatsapp_messages_total', { kind: input.kind, status: 'failed' })
      this.logger.warn('whatsapp send failed', { kind: input.kind, error: message })
      return err(new WhatsappProviderError(`WhatsApp send failed: ${message}`, { kind: input.kind }))
    }

    this.metrics.increment('vyon_whatsapp_messages_total', { kind: input.kind, status: result.status })
    this.metrics.observe('vyon_whatsapp_send_latency_ms', this.clock.monotonicMs() - startedAt, { kind: input.kind })

    if (!result.ok) {
      this.logger.warn('whatsapp provider rejected message', { kind: input.kind, error: result.error })
      return err(new WhatsappProviderError(result.error ?? 'WhatsApp provider rejected the message', { kind: input.kind }))
    }

    this.logger.info('whatsapp message accepted', { kind: input.kind, status: result.status, sid: result.providerMessageSid })
    return ok(result)
  }
}
