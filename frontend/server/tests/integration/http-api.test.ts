import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { buildContainer } from '../../src/composition/container.js'
import { createHttpApp } from '../../src/infrastructure/http/http-app.js'

describe('HTTP API', () => {
  let app: ReturnType<typeof createHttpApp>

  beforeAll(() => {
    const c = buildContainer()
    app = createHttpApp({
      config: c.config,
      logger: c.logger,
      clock: c.clock,
      idGenerator: c.idGenerator,
      metrics: c.metricsRegistry.metrics,
      metricsRegistry: c.metricsRegistry,
      promptRepository: c.promptRepository,
      aiProvider: c.aiProvider,
      transcription: c.transcription,
      analysisRepository: c.analysisRepository,
      analysisCache: c.analysisCache,
      tokenCost: c.tokenCost,
      auth: c.auth,
      version: c.config.version,
    })
  })

  it('health endpoint returns ok', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('metrics endpoint returns prometheus format', async () => {
    const res = await request(app).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.text).toContain('process_cpu')
  })

  it('analysis endpoint returns a parsed document', async () => {
    const res = await request(app).post('/api/v1/analysis').send({
      outputKind: 'resumenes',
      text: 'VYON helps teams manage tasks and projects efficiently.',
      language: 'en',
    })
    expect(res.status).toBe(200)
    expect(res.body.outputKind).toBe('resumenes')
    expect(res.body.calibration.passed).toBe(true)
  })

  it('analyses list endpoint works', async () => {
    const res = await request(app).get('/api/v1/analyses')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/api/v1/nope')
    expect(res.status).toBe(404)
  })

  it('rejects analysis without input', async () => {
    const res = await request(app).post('/api/v1/analysis').send({ outputKind: 'tareas' })
    expect(res.status).toBe(400)
  })
})
