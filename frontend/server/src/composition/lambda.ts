import serverless from 'serverless-http'
import { buildContainer } from './container.js'
import { createFullApp } from './create-full-app.js'

const container = buildContainer()
const fullApp = createFullApp({
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

export const handler = serverless(fullApp.app)
