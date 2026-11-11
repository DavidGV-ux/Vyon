import type { Clock, IdGenerator, Logger, MetricsPort } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'
import { AppError, ValidationError } from '../../domain/shared/errors.js'
import type { Payment, PaymentAttempt } from '../../domain/payments/entities.js'
import { newPayment } from '../../domain/payments/entities.js'
import type { ChargeRequest, PaymentGatewayPort, PaymentRepositoryPort } from '../../domain/payments/ports.js'

export type ProcessPaymentInput = {
  readonly idempotencyKey: string
  readonly userId: string
  readonly amountCents: number
  readonly currency?: string
  readonly method?: string
}

export type ProcessPaymentOutput = {
  readonly payment: Payment
  readonly replayed: boolean
}

export type ProcessPaymentDeps = {
  readonly repository: PaymentRepositoryPort
  readonly gateway: PaymentGatewayPort
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly logger: Logger
  readonly metrics: MetricsPort
  readonly maxAttempts?: number
  readonly retryDelayMs?: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Procesamiento idempotente con garantía de cero pérdida (MECL-044):
 *
 * 1. Todo intento se persiste ANTES de llamar a la pasarela (registro durable).
 * 2. Misma llave de idempotencia => jamás se cobra dos veces (la pasarela
 *    también deduplica por si la respuesta se pierde a mitad de camino).
 * 3. Fallos reintentables => reintentos con backoff, registrando cada intento.
 * 4. Si el proceso muere tras cobrar, el replay con la misma llave devuelve
 *    el resultado registrado sin volver a cobrar.
 */
export class ProcessPaymentUseCase {
  private readonly maxAttempts: number
  private readonly retryDelayMs: number

  constructor(private readonly deps: ProcessPaymentDeps) {
    this.maxAttempts = deps.maxAttempts ?? 3
    this.retryDelayMs = deps.retryDelayMs ?? 25
  }

  async execute(input: ProcessPaymentInput): Promise<Result<ProcessPaymentOutput, AppError>> {
    const { repository, gateway, clock, idGenerator, logger, metrics } = this.deps

    if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
      return err(new ValidationError('idempotencyKey requerido (mínimo 8 caracteres).'))
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      return err(new ValidationError('amountCents debe ser un entero positivo.'))
    }

    const existing = await repository.findByIdempotencyKey(input.idempotencyKey)
    if (existing && existing.status === 'succeeded') {
      metrics.increment('vyon_payment_total', { outcome: 'replay' })
      logger.info('payment replayed', { idempotencyKey: input.idempotencyKey, paymentId: existing.id })
      return ok({ payment: existing, replayed: true })
    }

    const nowIso = clock.now().toISOString()
    const payment: Payment = existing
      ? { ...existing, updatedAt: nowIso }
      : newPayment({
          id: idGenerator.next(),
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
          amountCents: input.amountCents,
          currency: input.currency ?? 'USD',
          now: nowIso,
        })

    await repository.save(payment)

    const chargeRequest: ChargeRequest = {
      idempotencyKey: payment.idempotencyKey,
      amountCents: payment.amountCents,
      currency: payment.currency,
      userId: payment.userId,
      method: input.method ?? 'card',
    }

    let lastCode = 'UNKNOWN'
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const startedAt = clock.monotonicMs()
      let outcome: PaymentAttempt['outcome']
      let providerRef: string | null = null
      let code: string | null = null

      try {
        const result = await gateway.charge(chargeRequest)
        if (result.status === 'succeeded') {
          outcome = 'succeeded'
          providerRef = result.providerRef
          code = null
        } else {
          outcome = result.retryable ? 'retryable_failure' : 'definitive_failure'
          code = result.code
          lastCode = result.code
        }
      } catch (error) {
        outcome = 'retryable_failure'
        code = 'NETWORK_ERROR'
        lastCode = 'NETWORK_ERROR'
        logger.warn('gateway threw', { error: String(error), attempt })
      }

      const record: PaymentAttempt = {
        attempt,
        attemptedAt: clock.now().toISOString(),
        outcome,
        providerRef,
        code,
        latencyMs: clock.monotonicMs() - startedAt,
      }
      const updated: Payment = {
        ...payment,
        status: outcome === 'succeeded' ? 'succeeded' : 'pending',
        providerRef: outcome === 'succeeded' ? providerRef : payment.providerRef,
        failureCode: null,
        attempts: [...payment.attempts, record],
        updatedAt: clock.now().toISOString(),
      }
      await repository.save(updated)
      Object.assign(payment, updated)

      if (outcome === 'succeeded') {
        metrics.increment('vyon_payment_total', { outcome: 'success' })
        metrics.observe('vyon_payment_latency_ms', record.latencyMs, { outcome: 'success' })
        logger.info('payment succeeded', { paymentId: payment.id, providerRef, attempt })
        return ok({ payment, replayed: false })
      }

      metrics.increment('vyon_payment_total', { outcome: outcome === 'retryable_failure' ? 'retry' : 'failed' })
      metrics.observe('vyon_payment_latency_ms', record.latencyMs, { outcome: 'failure' })

      if (outcome === 'definitive_failure') {
        const failed: Payment = {
          ...payment,
          status: 'failed',
          failureCode: code,
          attempts: payment.attempts,
          updatedAt: clock.now().toISOString(),
        }
        await repository.save(failed)
        logger.warn('payment failed definitively', { paymentId: failed.id, code })
        return err(
          new AppError({
            code: 'PAYMENT_DECLINED',
            message: `Pago rechazado: ${code}`,
            details: { paymentId: failed.id, code },
          }),
        )
      }

      if (attempt < this.maxAttempts) await sleep(this.retryDelayMs * attempt)
    }

    const exhausted: Payment = {
      ...payment,
      status: 'failed',
      failureCode: lastCode,
      attempts: payment.attempts,
      updatedAt: clock.now().toISOString(),
    }
    await repository.save(exhausted)
    metrics.increment('vyon_payment_total', { outcome: 'exhausted' })
    logger.error('payment retries exhausted', { paymentId: exhausted.id, code: lastCode })
    return err(
      new AppError({
        code: 'PAYMENT_FAILED',
        message: `Pago fallido tras ${this.maxAttempts} intentos: ${lastCode}`,
        details: { paymentId: exhausted.id, code: lastCode },
        retryable: true,
      }),
    )
  }
}
