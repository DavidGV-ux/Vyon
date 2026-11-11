const MS_PER_DAY = 24 * 60 * 60 * 1000

export type RetentionEvaluation = {
  readonly send: boolean
  readonly inactivityDays: number
}

/**
 * Pure domain rule: decides whether a user is inactive enough to receive a
 * retention message. No I/O, no clock dependency beyond the `now` argument.
 */
export class RetentionPolicy {
  constructor(private readonly inactivityThresholdDays: number) {}

  get thresholdDays(): number {
    return this.inactivityThresholdDays
  }

  inactivityDays(lastActivityAt: string, now: Date): number {
    const last = Date.parse(lastActivityAt)
    if (Number.isNaN(last)) return 0
    const elapsed = now.getTime() - last
    if (elapsed <= 0) return 0
    return Math.floor(elapsed / MS_PER_DAY)
  }

  evaluate(lastActivityAt: string, now: Date): RetentionEvaluation {
    const inactivityDays = this.inactivityDays(lastActivityAt, now)
    return { send: inactivityDays >= this.inactivityThresholdDays, inactivityDays }
  }
}
