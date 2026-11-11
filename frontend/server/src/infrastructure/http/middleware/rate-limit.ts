import type { Request, Response, NextFunction } from 'express'

export type RateLimitOptions = {
  readonly windowMs: number
  readonly max: number
  readonly keyFn?: (req: Request) => string
}

type Bucket = { count: number; resetAt: number }

/**
 * Rate limiter en memoria (fijo por ventana). Sin dependencias externas:
 * suficiente para el mockup y alineado con la auditoría de seguridad
 * (MECL-057) contra abuso de endpoints de IA.
 */
export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>()
  const keyFn = options.keyFn ?? ((req: Request): string => req.ip ?? 'unknown')

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    const key = keyFn(req)
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs }
      buckets.set(key, bucket)
    }

    if (bucket.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests', retryable: true } })
      return
    }

    bucket.count += 1

    if (buckets.size > 10_000) {
      for (const [mapKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(mapKey)
      }
    }

    next()
  }
}
