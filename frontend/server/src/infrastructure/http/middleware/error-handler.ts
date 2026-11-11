import type { Request, Response, NextFunction } from 'express'
import { isAppError } from '../../../domain/shared/errors.js'

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` } })
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const logger = req.ctx?.logger
  if (isAppError(err)) {
    if (err.status >= 500) logger?.error('server error', { error: err.message, code: err.code })
    else logger?.warn('client error', { error: err.message, code: err.code })
    res.status(err.status).json(err.toJSON())
    return
  }
  const message = err instanceof Error ? err.message : 'Internal server error'
  logger?.error('unhandled error', { error: message })
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', retryable: true } })
}
