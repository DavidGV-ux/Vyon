import type { ReactivationStep } from '../entities.js'

/**
 * Pure domain rule: defines the reactivation drip (message sequence) and which
 * step becomes due for a given inactivity window. Steps are cumulative: a step
 * is due when `inactivityDays >= delayDays`.
 */
export class ReactivationSequence {
  constructor(private readonly steps: readonly ReactivationStep[]) {
    if (steps.length === 0) throw new Error('ReactivationSequence requires at least one step')
  }

  get allSteps(): readonly ReactivationStep[] {
    return this.steps
  }

  /** Steps whose delay has been reached, ordered from earliest to latest. */
  dueSteps(inactivityDays: number): readonly ReactivationStep[] {
    return this.steps.filter((step) => inactivityDays >= step.delayDays)
  }

  /** The latest due step (used to pick the message body for the next send). */
  latestDueStep(inactivityDays: number): ReactivationStep | null {
    const due = this.dueSteps(inactivityDays)
    return due.length > 0 ? (due[due.length - 1] ?? null) : null
  }

  /** The next step that is due but has not been delivered yet. */
  nextUndeliveredStep(inactivityDays: number, deliveredSteps: readonly number[]): ReactivationStep | null {
    return (
      this.dueSteps(inactivityDays).find((step) => !deliveredSteps.includes(step.step)) ?? null
    )
  }
}
