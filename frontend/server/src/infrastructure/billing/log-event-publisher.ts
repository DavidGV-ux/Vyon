import type { BillingEvent, BillingEventPublisherPort } from '../../domain/billing/ports.js'
import type { Logger } from '../../domain/shared/ports.js'

export class LogEventPublisher implements BillingEventPublisherPort {
  constructor(private readonly logger: Logger) {}

  async publish(event: BillingEvent): Promise<void> {
    this.logger.info('billing event', { type: event.type, userId: event.userId, ...event.data })
  }
}
