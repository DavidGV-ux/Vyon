import { describe, it, expect } from 'vitest'
import { DispatchEngagementMessagesUseCase } from '../../src/application/use-cases/dispatch-engagement-messages.js'
import { SendWhatsAppMessageUseCase } from '../../src/application/use-cases/send-whatsapp-message.js'
import { InMemoryEngagementRepository } from '../../src/infrastructure/messaging/in-memory-engagement-repository.js'
import { RetentionPolicy } from '../../src/domain/messaging/services/retention-policy.js'
import { ReactivationSequence } from '../../src/domain/messaging/services/reactivation-sequence.js'
import type { MessagingProviderPort, MessageTemplateRepositoryPort } from '../../src/domain/messaging/ports.js'
import type { EngagementProfile, WhatsAppSendRequest, WhatsAppSendResult, MessageTemplate } from '../../src/domain/messaging/entities.js'
import type { MessageKind, MessageLanguage } from '../../src/domain/messaging/value-objects.js'
import type { Clock, Logger, MetricsPort } from '../../src/domain/shared/ports.js'

const NOW = new Date('2026-11-11T12:00:00.000Z')

function fakeClock(now: Date = NOW): Clock {
  return { now: () => now, monotonicMs: () => 0 }
}

function fakeLogger(): Logger {
  const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined, child: () => logger }
  return logger
}

function fakeMetrics(): MetricsPort {
  return { increment: () => undefined, observe: () => undefined, gauge: () => undefined }
}

class RecordingProvider implements MessagingProviderPort {
  readonly name = 'recording'
  readonly sent: WhatsAppSendRequest[] = []
  async send(request: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    this.sent.push(request)
    return { ok: true, providerMessageSid: `SM${this.sent.length}`, status: 'sent' }
  }
}

class FakeTemplateRepo implements MessageTemplateRepositoryPort {
  async getActive(kind: MessageKind, _language: MessageLanguage = 'es', step?: number): Promise<MessageTemplate> {
    return { kind, language: 'es', step: step ?? null, version: '1.0.0', body: `body-${kind}-${String(step ?? 'single')}` }
  }
  async listVersions(): Promise<string[]> {
    return ['1.0.0']
  }
}

function profile(overrides: Partial<EngagementProfile> = {}): EngagementProfile {
  return {
    userId: 'u1',
    channel: 'whatsapp',
    phone: '+573001112233',
    lastActivityAt: '2026-09-01T12:00:00.000Z',
    language: 'es',
    name: 'Ana',
    link: 'https://app.vyon.io',
    sentMessages: [],
    ...overrides,
  }
}

function buildUseCase(
  repository: InMemoryEngagementRepository,
  provider: MessagingProviderPort,
  config: { retentionEnabled: boolean; reactivationEnabled: boolean } = { retentionEnabled: true, reactivationEnabled: true },
): DispatchEngagementMessagesUseCase {
  const sendMessage = new SendWhatsAppMessageUseCase(provider, new FakeTemplateRepo(), fakeClock(), { next: () => 'id' }, fakeLogger(), fakeMetrics())
  return new DispatchEngagementMessagesUseCase(
    repository,
    new RetentionPolicy(30),
    new ReactivationSequence([
      { step: 1, kind: 'reactivation', delayDays: 0 },
      { step: 2, kind: 'reactivation', delayDays: 3 },
      { step: 3, kind: 'reactivation', delayDays: 7 },
    ]),
    sendMessage,
    config,
    fakeClock(),
    fakeLogger(),
    fakeMetrics(),
  )
}

describe('DispatchEngagementMessagesUseCase', () => {
  it('sends retention to a newly inactive profile and marks it as sent', async () => {
    const repository = new InMemoryEngagementRepository()
    await repository.save(profile())
    const provider = new RecordingProvider()
    const useCase = buildUseCase(repository, provider)

    const result = await useCase.execute({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.sent).toBe(1)
      expect(result.value.scanned).toBe(1)
      expect(result.value.decisions[0]?.kind).toBe('retention')
    }
    expect(provider.sent[0]?.body).toContain('body-retention-single')

    const stored = await repository.findById('u1')
    expect(stored?.sentMessages).toHaveLength(1)
    expect(stored?.sentMessages[0]?.kind).toBe('retention')
  })

  it('is idempotent: does not resend retention, then escalates the drip', async () => {
    const repository = new InMemoryEngagementRepository()
    await repository.save(profile())
    const provider = new RecordingProvider()
    const useCase = buildUseCase(repository, provider)

    await useCase.execute({})
    const second = await useCase.execute({})

    expect(second.ok).toBe(true)
    if (second.ok) {
      // retention already sent → only the first reactivation step is due
      expect(second.value.sent).toBe(1)
      expect(second.value.decisions[0]?.kind).toBe('reactivation')
    }
    expect(provider.sent).toHaveLength(2)
    expect(provider.sent[0]?.kind).toBe('retention')
    expect(provider.sent[1]?.kind).toBe('reactivation')

    const stored = await repository.findById('u1')
    expect(stored?.sentMessages.map((record) => record.kind)).toEqual(['retention', 'reactivation'])
  })

  it('escalates to the next reactivation step after retention', async () => {
    const repository = new InMemoryEngagementRepository()
    await repository.save(profile({ sentMessages: [{ kind: 'retention', step: null, at: NOW.toISOString() }] }))
    const provider = new RecordingProvider()
    const useCase = buildUseCase(repository, provider)

    const result = await useCase.execute({})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.decisions[0]).toMatchObject({ kind: 'reactivation', step: 1 })

    // second run: retention + step 1 delivered → step 2 (delay 3 days) due at 72 days
    const second = await useCase.execute({})
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.value.decisions[0]).toMatchObject({ kind: 'reactivation', step: 2 })
  })

  it('skips users below the inactivity threshold', async () => {
    const repository = new InMemoryEngagementRepository()
    await repository.save(profile({ lastActivityAt: '2026-11-10T12:00:00.000Z' }))
    const provider = new RecordingProvider()
    const useCase = buildUseCase(repository, provider)

    const result = await useCase.execute({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.scanned).toBe(0)
      expect(result.value.sent).toBe(0)
    }
    expect(provider.sent).toHaveLength(0)
  })

  it('honours disabling retention while keeping reactivation', async () => {
    const repository = new InMemoryEngagementRepository()
    await repository.save(profile())
    const provider = new RecordingProvider()
    const useCase = buildUseCase(repository, provider, { retentionEnabled: false, reactivationEnabled: true })

    const result = await useCase.execute({})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.decisions[0]?.kind).toBe('reactivation')
  })
})
