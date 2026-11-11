import pino from 'pino'
import type { Logger } from '../../domain/shared/ports.js'

export function createLogger(level: string): Logger {
  const base = pino({ level, base: { service: 'vyon-api' } })

  const wrap = (instance: pino.Logger): Logger => ({
    debug: (message, meta) => instance.debug(meta ?? {}, message),
    info: (message, meta) => instance.info(meta ?? {}, message),
    warn: (message, meta) => instance.warn(meta ?? {}, message),
    error: (message, meta) => instance.error(meta ?? {}, message),
    child: (bindings) => wrap(instance.child(bindings)),
  })

  return wrap(base)
}
