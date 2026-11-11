import type { CalibrationIssue, CalibrationReport, ParsedData } from '../entities.js'
import type { OutputKind } from '../value-objects.js'

const PASS_THRESHOLD = 0.7

export type CalibrationInput = {
  readonly outputKind: OutputKind
  readonly data: ParsedData
}

export class CalibrationService {
  calibrate(input: CalibrationInput): CalibrationReport {
    const issues: CalibrationIssue[] = []
    let score = 1

    if (input.outputKind === 'finanzas') {
      const data = input.data as unknown as { currency: string; entries: { amount: number; confidence: number; type: string }[]; totals: { income: number; expense: number; net: number } }
      if (!data.currency) {
        issues.push({ code: 'MISSING_CURRENCY', severity: 'warning', path: 'currency', message: 'Currency missing; defaulted to USD', hint: 'Specify currency in the prompt' })
        score -= 0.1
      }
      if (!Array.isArray(data.entries) || data.entries.length === 0) {
        issues.push({ code: 'EMPTY_ENTRIES', severity: 'error', path: 'entries', message: 'No finance entries extracted', hint: 'Provide more detail in the source text' })
        score -= 0.4
      }
      for (const [i, entry] of data.entries.entries()) {
        if (typeof entry.amount !== 'number' || !Number.isFinite(entry.amount) || entry.amount < 0) {
          issues.push({ code: 'INVALID_AMOUNT', severity: 'error', path: `entries[${i}].amount`, message: 'Amount must be a non-negative number' })
          score -= 0.15
        }
        if (typeof entry.confidence !== 'number' || entry.confidence < 0 || entry.confidence > 1) {
          issues.push({ code: 'INVALID_CONFIDENCE', severity: 'warning', path: `entries[${i}].confidence`, message: 'Confidence out of range [0,1]' })
          score -= 0.05
        }
      }
      const computedIncome = data.entries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0)
      const computedExpense = data.entries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0)
      const expectedNet = computedIncome - computedExpense
      if (Math.abs(data.totals.net - expectedNet) > 0.01) {
        issues.push({ code: 'TOTALS_MISMATCH', severity: 'warning', path: 'totals.net', message: `Totals.net (${data.totals.net}) does not match computed (${expectedNet})`, hint: 'Recompute totals from entries' })
        score -= 0.1
      }
    } else if (input.outputKind === 'tareas') {
      const data = input.data as unknown as { tasks: { title: string; priority: string; status: string }[] }
      if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
        issues.push({ code: 'EMPTY_TASKS', severity: 'error', path: 'tasks', message: 'No tasks extracted', hint: 'Provide actionable items in the source' })
        score -= 0.4
      }
      for (const [i, task] of data.tasks.entries()) {
        if (!task.title || task.title.trim().length < 3) {
          issues.push({ code: 'WEAK_TITLE', severity: 'warning', path: `tasks[${i}].title`, message: 'Task title too short or empty' })
          score -= 0.1
        }
        if (!['low', 'medium', 'high'].includes(task.priority)) {
          issues.push({ code: 'INVALID_PRIORITY', severity: 'error', path: `tasks[${i}].priority`, message: 'Invalid priority value' })
          score -= 0.15
        }
        if (!['todo', 'in_progress', 'done'].includes(task.status)) {
          issues.push({ code: 'INVALID_STATUS', severity: 'error', path: `tasks[${i}].status`, message: 'Invalid status value' })
          score -= 0.15
        }
      }
    } else {
      const data = input.data as unknown as { summary: string; keyPoints: readonly string[]; actionItems: readonly string[] }
      if (!data.summary || data.summary.trim().length < 20) {
        issues.push({ code: 'WEAK_SUMMARY', severity: 'warning', path: 'summary', message: 'Summary too short to be useful' })
        score -= 0.2
      }
      if (!Array.isArray(data.keyPoints) || data.keyPoints.length === 0) {
        issues.push({ code: 'NO_KEY_POINTS', severity: 'warning', path: 'keyPoints', message: 'No key points extracted' })
        score -= 0.1
      }
    }

    score = Math.max(0, Math.min(1, score))
    return {
      score,
      passed: score >= PASS_THRESHOLD,
      attempts: 1,
      issues,
      repairs: [],
    }
  }
}
