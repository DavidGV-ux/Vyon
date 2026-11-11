import type { Clock, IdGenerator, Logger, MetricsPort } from '../../src/domain/shared/ports.js'

export class FakeClock implements Clock {
  private monotonic = 0
  private wall: Date

  constructor(startIso = '2026-11-11T12:00:00.000Z') {
    this.wall = new Date(startIso)
  }

  now(): Date {
    return new Date(this.wall.getTime())
  }

  monotonicMs(): number {
    return this.monotonic
  }

  advance(ms: number): void {
    this.monotonic += ms
    this.wall = new Date(this.wall.getTime() + ms)
  }
}

export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
}

export const noopMetrics: MetricsPort = {
  increment: () => undefined,
  observe: () => undefined,
  gauge: () => undefined,
}

export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0
  return {
    next: () => `${prefix}-${++n}`,
  }
}

/** Espera a que las promesas en fire-and-forget del scheduler se asienten. */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}
