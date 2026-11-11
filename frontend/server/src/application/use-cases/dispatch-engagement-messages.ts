import type { EngagementRepositoryPort } from '../../domain/messaging/ports.js'
import type { DispatchOutcome, EngagementDecision, EngagementProfile, SentMessageRecord, WhatsAppSendResult } from '../../domain/messaging/entities.js'
import type { RetentionPolicy } from '../../domain/messaging/services/retention-policy.js'
import type { ReactivationSequence } from '../../domain/messaging/services/reactivation-sequence.js'
import type { Clock, Logger, MetricsPort } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError } from '../../domain/shared/errors.js'
import type { SendWhatsAppMessageUseCase } from './send-whatsapp-message.js'

export type DispatchEngagementConfig = {
  readonly retentionEnabled: boolean
  readonly reactivationEnabled: boolean
}

export type DispatchEngagementInput = {
  readonly now?: Date
  readonly limit?: number
}

function hasSent(profile: EngagementProfile, kind: 'retention' | 'reactivation', step: number | null): boolean {
  return profile.sentMessages.some((record) => record.kind === kind && record.step === step)
}

export class DispatchEngagementMessagesUseCase {
  constructor(
    private readonly engagementRepository: EngagementRepositoryPort,
    private readonly retentionPolicy: RetentionPolicy,
    private readonly reactivationSequence: ReactivationSequence,
    private readonly sendMessage: SendWhatsAppMessageUseCase,
    private readonly config: DispatchEngagementConfig,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly metrics: MetricsPort,
  ) {}

  async execute(input: DispatchEngagementInput = {}): Promise<Result<DispatchOutcome, AppError>> {
    const now = input.now ?? this.clock.now()
    const limit = input.limit ?? 500

    const profiles = await this.engagementRepository.findInactive(this.retentionPolicy.thresholdDays, now)
    const scanned = profiles.length

    let sent = 0
    let skipped = 0
    let failed = 0
    const decisions: EngagementDecision[] = []

    for (const profile of profiles.slice(0, limit)) {
      const evaluation = this.retentionPolicy.evaluate(profile.lastActivityAt, now)
      const inactivityDays = evaluation.inactivityDays

      let decision: EngagementDecision | null = null

      if (this.config.retentionEnabled && !hasSent(profile, 'retention', null)) {
        decision = { userId: profile.userId, phone: profile.phone, kind: 'retention', step: null, inactivityDays }
      } else if (this.config.reactivationEnabled) {
        const deliveredSteps = profile.sentMessages
          .filter((record) => record.kind === 'reactivation')
          .map((record) => record.step)
          .filter((step): step is number => step !== null)
        const nextStep = this.reactivationSequence.nextUndeliveredStep(inactivityDays, deliveredSteps)
        if (nextStep) {
          decision = { userId: profile.userId, phone: profile.phone, kind: 'reactivation', step: nextStep.step, inactivityDays }
        }
      }

      if (!decision) {
        skipped += 1
        continue
      }

      decisions.push(decision)
      const context: Record<string, string> = {
        name: profile.name ?? 'equipo',
        days: String(inactivityDays),
        link: profile.link ?? 'https://app.vyon.io',
      }

      const result = await this.sendMessage.execute({
        to: profile.phone,
        kind: decision.kind,
        step: decision.step ?? undefined,
        language: profile.language,
        context,
        referenceId: `${profile.userId}:${decision.kind}:${String(decision.step ?? 'single')}`,
      })

      if (!result.ok) {
        failed += 1
        this.logger.warn('engagement dispatch send failed', { userId: profile.userId, kind: decision.kind, step: decision.step, error: result.error.message })
        continue
      }

      sent += 1
      const record: SentMessageRecord = { kind: decision.kind, step: decision.step, at: now.toISOString() }
      const updated: EngagementProfile = { ...profile, sentMessages: [...profile.sentMessages, record] }
      await this.engagementRepository.save(updated)
      this.logger.info('engagement message dispatched', { userId: profile.userId, kind: decision.kind, step: decision.step, sid: (result.value as WhatsAppSendResult).providerMessageSid })
    }

    this.metrics.increment('vyon_engagement_dispatch_total', { status: sent > 0 ? 'sent' : 'skipped' })
    this.metrics.increment('vyon_engagement_profiles_scanned', {}, scanned)
    this.metrics.increment('vyon_engagement_messages_sent', {}, sent)

    const outcome: DispatchOutcome = { scanned, sent, skipped, failed, decisions }
    this.logger.info('engagement dispatch finished', { scanned, sent, skipped, failed })

    if (failed > 0 && sent === 0 && scanned > 0) {
      return err(new AppError({ code: 'WHATSAPP_ERROR', message: `All ${failed} engagement sends failed`, details: outcome, retryable: true }))
    }
    return ok(outcome)
  }
}
