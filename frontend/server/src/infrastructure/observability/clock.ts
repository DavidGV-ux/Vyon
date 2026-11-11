import type { Clock } from '../../domain/shared/ports.js'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
  monotonicMs(): number {
    return performance.now()
  }
}
