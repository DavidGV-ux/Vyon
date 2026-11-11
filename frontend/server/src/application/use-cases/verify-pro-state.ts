import type { SubscriptionRepositoryPort } from '../../domain/billing/ports.js'
import type { ProStateVerification } from '../../domain/billing/services/pro-state.js'
import { verifyProState } from '../../domain/billing/services/pro-state.js'
import type { Clock } from '../../domain/shared/ports.js'
import type { Result } from '../../domain/shared/result.js'
import { ok } from '../../domain/shared/result.js'
import type { AppError } from '../../domain/shared/errors.js'

/**
 * Verificación de estados Pro v1.2 (MECL-041).
 * Nunca falla por "no encontrado": ese es un estado válido (SUBSCRIPTION_NOT_FOUND).
 */
export class VerifyProStateUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<Result<ProStateVerification, AppError>> {
    const subscription = await this.subscriptions.findByUserId(userId)
    return ok(verifyProState(subscription, this.clock.now()))
  }
}
