export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYWALL_DENIED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_RESPONSE'
  | 'TRANSCRIPTION_ERROR'
  | 'WHATSAPP_ERROR'
  | 'MESSAGE_TEMPLATE_NOT_FOUND'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_DECLINED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVOICE_ERROR'
  | 'DEADLINE_EXCEEDED'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR'

export interface AppErrorInit {
  code: ErrorCode
  message: string
  status?: number
  details?: unknown
  retryable?: boolean
  cause?: unknown
}

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_PROVIDER_ERROR: 502,
  AI_TIMEOUT: 504,
  AI_INVALID_RESPONSE: 502,
  TRANSCRIPTION_ERROR: 502,
  WHATSAPP_ERROR: 502,
  MESSAGE_TEMPLATE_NOT_FOUND: 404,
  PAYWALL_DENIED: 402,
  PAYMENT_FAILED: 402,
  PAYMENT_DECLINED: 400,
  IDEMPOTENCY_CONFLICT: 409,
  INVOICE_ERROR: 500,
  DEADLINE_EXCEEDED: 504,
  CONFIGURATION_ERROR: 500,
  INTERNAL_ERROR: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: unknown
  readonly retryable: boolean

  constructor(init: AppErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined)
    this.name = 'AppError'
    this.code = init.code
    this.status = init.status ?? DEFAULT_STATUS[init.code]
    this.details = init.details
    this.retryable = init.retryable ?? false
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        status: this.status,
        retryable: this.retryable,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    }
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: 'VALIDATION_ERROR', message, details })
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: 'NOT_FOUND', message, details })
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super({ code: 'UNAUTHORIZED', message, details })
    this.name = 'UnauthorizedError'
  }
}

export class AiProviderError extends AppError {
  constructor(message: string, details?: unknown, retryable = true) {
    super({ code: 'AI_PROVIDER_ERROR', message, details, retryable })
    this.name = 'AiProviderError'
  }
}

export class AiTimeoutError extends AppError {
  constructor(message = 'AI provider timed out', details?: unknown) {
    super({ code: 'AI_TIMEOUT', message, details, retryable: true })
    this.name = 'AiTimeoutError'
  }
}

export class DeadlineExceededError extends AppError {
  constructor(message = 'Request deadline exceeded', details?: unknown) {
    super({ code: 'DEADLINE_EXCEEDED', message, details, retryable: true })
    this.name = 'DeadlineExceededError'
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: 'CONFIGURATION_ERROR', message, details, retryable: false })
    this.name = 'ConfigurationError'
  }
}

export class WhatsappProviderError extends AppError {
  constructor(message: string, details?: unknown, retryable = true) {
    super({ code: 'WHATSAPP_ERROR', message, details, retryable })
    this.name = 'WhatsappProviderError'
  }
}

export class MessageTemplateNotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: 'MESSAGE_TEMPLATE_NOT_FOUND', message, details, retryable: false })
    this.name = 'MessageTemplateNotFoundError'
  }
}
