import { describe, it, expect } from 'vitest'
import { SendWhatsAppMessageUseCase, renderTemplate } from '../../src/application/use-cases/send-whatsapp-message.js'
import type { MessagingProviderPort, MessageTemplateRepositoryPort } from '../../src/domain/messaging/ports.js'
import type { WhatsAppSendRequest, WhatsAppSendResult, MessageTemplate } from '../../src/domain/messaging/entities.js'
import type { MessageKind, MessageLanguage } from '../../src/domain/messaging/value-objects.js'
import type { Clock, Logger, MetricsPort } from '../../src/domain/shared/ports.js'

function fakeClock(): Clock {
  return { now: () => new Date('2026-11-11T12:00:00.000Z'), monotonicMs: () => 0 }
}

function fakeLogger(): Logger {
  const logger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
  }
  return logger
}

function fakeMetrics(): MetricsPort & { increments: { name: string; labels?: Record<string, string>; value?: number }[] } {
  const increments: { name: string; labels?: Record<string, string>; value?: number }[] = []
  return {
    increments,
    increment: (name, labels, value) => increments.push({ name, labels, value }),
    observe: () => undefined,
    gauge: () => undefined,
  }
}

class FakeProvider implements MessagingProviderPort {
  readonly name = 'fake'
  readonly sent: WhatsAppSendRequest[] = []
  constructor(private readonly result: WhatsAppSendResult) {}
  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    this.sent.push(request)
    return this.result
  }
}

class FakeTemplateRepo implements MessageTemplateRepositoryPort {
  async getActive(kind: MessageKind, _language: MessageLanguage = 'es', _step?: number): Promise<MessageTemplate> {
    return { kind, language: 'es', step: null, version: '1.0.0', body: 'Hola {{name}}, llevas {{days}} días. {{link}}' }
  }
  async listVersions(): Promise<string[]> {
    return ['1.0.0']
  }
}

describe('renderTemplate', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    expect(renderTemplate('Hi {{name}}, {{missing}}', { name: 'Ana' })).toBe('Hi Ana, {{missing}}')
    expect(renderTemplate('no vars')).toBe('no vars')
  })
})

describe('SendWhatsAppMessageUseCase', () => {
  it('renders the template and sends through the provider', async () => {
    const provider = new FakeProvider({ ok: true, providerMessageSid: 'SM1', status: 'sent' })
    const metrics = fakeMetrics()
    const useCase = new SendWhatsAppMessageUseCase(provider, new FakeTemplateRepo(), fakeClock(), { next: () => 'id-1' }, fakeLogger(), metrics)

    const result = await useCase.execute({
      to: '+573001112233',
      kind: 'retention',
      context: { name: 'Ana', days: '30', link: 'https://app.vyon.io' },
    })

    expect(result.ok).toBe(true)
    expect(provider.sent).toHaveLength(1)
    expect(provider.sent[0]?.body).toContain('Ana')
    expect(provider.sent[0]?.body).toContain('30 días')
    expect(metrics.increments.some((i) => i.name === 'vyon_whatsapp_messages_total')).toBe(true)
  })

  it('fails when the provider rejects', async () => {
    const provider = new FakeProvider({ ok: false, providerMessageSid: null, status: 'failed', error: 'invalid number' })
    const useCase = new SendWhatsAppMessageUseCase(provider, new FakeTemplateRepo(), fakeClock(), { next: () => 'id-2' }, fakeLogger(), fakeMetrics())

    const result = await useCase.execute({ to: '+573001112233', kind: 'retention' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WHATSAPP_ERROR')
  })

  it('rejects an empty recipient', async () => {
    const provider = new FakeProvider({ ok: true, providerMessageSid: 'SM2', status: 'sent' })
    const useCase = new SendWhatsAppMessageUseCase(provider, new FakeTemplateRepo(), fakeClock(), { next: () => 'id-3' }, fakeLogger(), fakeMetrics())

    const result = await useCase.execute({ to: '   ', kind: 'retention' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('maps provider exceptions to WHATSAPP_ERROR', async () => {
    const provider: MessagingProviderPort = {
      name: 'throwing',
      send: async () => {
        throw new Error('boom')
      },
    }
    const useCase = new SendWhatsAppMessageUseCase(provider, new FakeTemplateRepo(), fakeClock(), { next: () => 'id-4' }, fakeLogger(), fakeMetrics())

    const result = await useCase.execute({ to: '+573001112233', kind: 'retention' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WHATSAPP_ERROR')
  })
})
