import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import type { Logger } from '../../../domain/shared/ports.js'

export interface RequestContext {
  requestId: string
  startedAt: number
  logger: Logger
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      ctx?: RequestContext
    }
  }
}

export function requestContextMiddleware(baseLogger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID()
    const startedAt = performance.now()
    const logger = baseLogger.child({ requestId, method: req.method, path: req.path })
    req.ctx = { requestId, startedAt, logger }
    res.setHeader('X-Request-Id', requestId)
    res.on('finish', () => {
      const durationMs = Math.round(performance.now() - startedAt)
      logger.info('request completed', { status: res.statusCode, durationMs })
    })
    next()
  }
}
