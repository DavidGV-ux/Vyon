import { loadConfig } from '../infrastructure/config/config.js'
import { createLogger } from '../infrastructure/observability/logger.js'
import { SystemClock } from '../infrastructure/observability/clock.js'
import { UuidIdGenerator } from '../infrastructure/observability/id-generator.js'
import { createMetricsRegistry } from '../infrastructure/observability/metrics.js'
import { FileMasterPromptRepository } from '../infrastructure/prompt/file-prompt-repository.js'
import { InMemoryAnalysisRepository } from '../infrastructure/persistence/in-memory-analysis-repository.js'
import { DeterministicProvider } from '../infrastructure/ai/deterministic-provider.js'
import { AnthropicProvider } from '../infrastructure/ai/anthropic-provider.js'
import { OpenAICompatibleProvider } from '../infrastructure/ai/openai-compatible-provider.js'
import { InMemoryAnalysisCache } from '../infrastructure/ai/in-memory-analysis-cache.js'
import { WhisperTranscriber } from '../infrastructure/audio/whisper-transcriber.js'
import { SupabaseAuthAdapter, NoopAuthAdapter } from '../infrastructure/auth/supabase-auth.js'
import { TwilioWhatsAppProvider, UnconfiguredMessagingProvider } from '../infrastructure/messaging/twilio-whatsapp-provider.js'
import { FileMessageTemplateRepository } from '../infrastructure/messaging/file-message-template-repository.js'
import { InMemoryEngagementRepository } from '../infrastructure/messaging/in-memory-engagement-repository.js'
import { SendWhatsAppMessageUseCase } from '../application/use-cases/send-whatsapp-message.js'
import { DispatchEngagementMessagesUseCase } from '../application/use-cases/dispatch-engagement-messages.js'
import { RetentionPolicy } from '../domain/messaging/services/retention-policy.js'
import { ReactivationSequence } from '../domain/messaging/services/reactivation-sequence.js'
import { TokenCostService } from '../domain/ai/services/token-cost.js'
import type { AiProviderPort } from '../domain/ai/ports.js'
import type { TranscriptionPort } from '../domain/ai/ports.js'
import type { AnalysisCachePort } from '../domain/ai/ports.js'
import type { MessagingProviderPort } from '../domain/messaging/ports.js'
import type { AuthPort } from '../infrastructure/auth/supabase-auth.js'
import type { AppConfig } from '../infrastructure/config/config.js'

export type Container = {
  readonly config: AppConfig
  readonly logger: ReturnType<typeof createLogger>
  readonly clock: SystemClock
  readonly idGenerator: UuidIdGenerator
  readonly metricsRegistry: ReturnType<typeof createMetricsRegistry>
  readonly promptRepository: FileMasterPromptRepository
  readonly aiProvider: AiProviderPort
  readonly transcription: TranscriptionPort
  readonly analysisRepository: InMemoryAnalysisRepository
  readonly analysisCache: AnalysisCachePort
  readonly tokenCost: TokenCostService
  readonly auth: AuthPort
  readonly messagingProvider: MessagingProviderPort
  readonly messageTemplateRepository: FileMessageTemplateRepository
  readonly engagementRepository: InMemoryEngagementRepository
  readonly retentionPolicy: RetentionPolicy
  readonly reactivationSequence: ReactivationSequence
  readonly sendWhatsAppMessage: SendWhatsAppMessageUseCase
  readonly dispatchEngagementMessages: DispatchEngagementMessagesUseCase
}

export function buildContainer(): Container {
  const config = loadConfig()
  const logger = createLogger(config.logLevel)
  const clock = new SystemClock()
  const idGenerator = new UuidIdGenerator()
  const metricsRegistry = createMetricsRegistry(config.metricsEnabled)

  const promptRepository = new FileMasterPromptRepository()

  let aiProvider: AiProviderPort
  if (config.ai.provider === 'anthropic') {
    aiProvider = new AnthropicProvider({ apiKey: config.ai.anthropic.apiKey, model: config.ai.anthropic.model })
  } else if (config.ai.provider === 'openai') {
    aiProvider = new OpenAICompatibleProvider({ apiKey: config.ai.openai.apiKey, baseUrl: config.ai.openai.baseUrl, model: config.ai.openai.model })
  } else {
    aiProvider = new DeterministicProvider()
  }

  const transcription: TranscriptionPort = new WhisperTranscriber({
    apiBase: config.whisper.apiBase,
    apiKey: config.whisper.apiKey || config.ai.openai.apiKey,
    model: config.whisper.model,
    language: config.whisper.language,
  })

  const analysisRepository = new InMemoryAnalysisRepository()
  const analysisCache = new InMemoryAnalysisCache({ maxEntries: config.ai.cacheMaxEntries, ttlMs: config.ai.cacheTtlMs })
  const tokenCost = new TokenCostService()

  const auth: AuthPort = config.supabase.url
    ? new SupabaseAuthAdapter(config.supabase.url, config.supabase.anonKey, logger)
    : new NoopAuthAdapter()

  const messageTemplateRepository = new FileMessageTemplateRepository()

  let messagingProvider: MessagingProviderPort
  if (config.whatsapp.provider === 'twilio' && (config.whatsapp.twilio.accountSid || config.whatsapp.twilio.messagingServiceSid)) {
    messagingProvider = new TwilioWhatsAppProvider({
      accountSid: config.whatsapp.twilio.accountSid,
      authToken: config.whatsapp.twilio.authToken,
      from: config.whatsapp.twilio.from,
      messagingServiceSid: config.whatsapp.twilio.messagingServiceSid || undefined,
      apiBase: config.whatsapp.twilio.apiBase,
      timeoutMs: config.whatsapp.twilio.timeoutMs,
    })
  } else {
    messagingProvider = new UnconfiguredMessagingProvider()
  }

  const engagementRepository = new InMemoryEngagementRepository()

  const retentionPolicy = new RetentionPolicy(config.whatsapp.retention.inactivityThresholdDays)
  const reactivationSequence = new ReactivationSequence(
    config.whatsapp.reactivation.delaysDays.map((delayDays, index) => ({ step: index + 1, kind: 'reactivation' as const, delayDays })),
  )

  const sendWhatsAppMessage = new SendWhatsAppMessageUseCase(
    messagingProvider,
    messageTemplateRepository,
    clock,
    idGenerator,
    logger,
    metricsRegistry.metrics,
  )

  const dispatchEngagementMessages = new DispatchEngagementMessagesUseCase(
    engagementRepository,
    retentionPolicy,
    reactivationSequence,
    sendWhatsAppMessage,
    { retentionEnabled: config.whatsapp.retention.enabled, reactivationEnabled: config.whatsapp.reactivation.enabled },
    clock,
    logger,
    metricsRegistry.metrics,
  )

  logger.info('container built', { provider: aiProvider.name, messaging: messagingProvider.name, authRequired: config.authRequired })

  return {
    config,
    logger,
    clock,
    idGenerator,
    metricsRegistry,
    promptRepository,
    aiProvider,
    transcription,
    analysisRepository,
    analysisCache,
    tokenCost,
    auth,
    messagingProvider,
    messageTemplateRepository,
    engagementRepository,
    retentionPolicy,
    reactivationSequence,
    sendWhatsAppMessage,
    dispatchEngagementMessages,
  }
}
