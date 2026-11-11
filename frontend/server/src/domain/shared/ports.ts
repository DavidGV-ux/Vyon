export interface Clock {
  now(): Date
  monotonicMs(): number
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
  child(bindings: Record<string, unknown>): Logger
}

export interface IdGenerator {
  next(): string
}

export interface MetricsPort {
  increment(name: string, labels?: Record<string, string>, value?: number): void
  observe(name: string, value: number, labels?: Record<string, string>): void
  gauge(name: string, value: number, labels?: Record<string, string>): void
}
