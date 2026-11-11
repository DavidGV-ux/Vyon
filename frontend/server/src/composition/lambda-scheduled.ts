import { buildContainer } from './container.js'

export type EngagementDispatchSummary = {
  readonly ok: boolean
  readonly scanned: number
  readonly sent: number
  readonly skipped: number
  readonly failed: number
}

/**
 * Handler programado (EventBridge/SQS) que ejecuta el dispatcher de mensajes
 * de retención y reactivación por WhatsApp (MECL-056). Se invoca por cron
 * diario configurado en serverless.yml.
 */
export async function handler(): Promise<EngagementDispatchSummary> {
  const container = buildContainer()
  container.logger.info('engagement dispatch started', {
    retentionEnabled: container.config.whatsapp.retention.enabled,
    reactivationEnabled: container.config.whatsapp.reactivation.enabled,
    provider: container.messagingProvider.name,
  })

  const result = await container.dispatchEngagementMessages.execute({})

  if (!result.ok) {
    container.logger.error('engagement dispatch failed', { error: result.error.message })
    throw new Error(result.error.message)
  }

  const { scanned, sent, skipped, failed } = result.value
  container.logger.info('engagement dispatch completed', { scanned, sent, skipped, failed })
  return { ok: true, scanned, sent, skipped, failed }
}
