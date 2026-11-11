import { buildContainer } from './container.js'
import { createFullApp } from './create-full-app.js'

const container = buildContainer()
const { app } = createFullApp({
  config: container.config,
  logger: container.logger,
  clock: container.clock,
  idGenerator: container.idGenerator,
  metrics: container.metricsRegistry.metrics,
  metricsRegistry: container.metricsRegistry,
  promptRepository: container.promptRepository,
  aiProvider: container.aiProvider,
  transcription: container.transcription,
  analysisRepository: container.analysisRepository,
  analysisCache: container.analysisCache,
  tokenCost: container.tokenCost,
  auth: container.auth,
  version: container.config.version,
})

const port = container.config.port
const server = app.listen(port, () => {
  container.logger.info('vyon-api listening', { port, env: container.config.nodeEnv })
})

const shutdown = (signal: string): void => {
  container.logger.info('shutdown signal received', { signal })
  server.close(() => {
    container.logger.info('http server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (error) => {
  container.logger.error('uncaught exception', { error: String(error) })
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  container.logger.error('unhandled rejection', { reason: String(reason) })
})
