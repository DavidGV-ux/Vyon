import { z } from 'zod'
import type { OutputParserPort } from '../../application/ports/output-parser.js'
import type { ParsedData } from '../../domain/ai/entities.js'
import type { OutputKind } from '../../domain/ai/value-objects.js'
import { AppError, ValidationError } from '../../domain/shared/errors.js'
import type { Result } from '../../domain/shared/result.js'
import { ok, err } from '../../domain/shared/result.js'

const financeEntrySchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.string().nullable().optional().transform((v) => v ?? null),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
})

const financeSchema = z.object({
  currency: z.string().min(1).default('USD'),
  entries: z.array(financeEntrySchema).default([]),
  totals: z.object({
    income: z.coerce.number().default(0),
    expense: z.coerce.number().default(0),
    net: z.coerce.number().default(0),
  }).default({ income: 0, expense: 0, net: 0 }),
}).transform((data) => {
  const income = data.entries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0)
  const expense = data.entries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0)
  return { ...data, totals: { income, expense, net: income - expense } }
})

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  dueDate: z.string().nullable().optional().transform((v) => v ?? null),
  assignee: z.string().nullable().optional().transform((v) => v ?? null),
  project: z.string().nullable().optional().transform((v) => v ?? null),
  tags: z.array(z.string()).default([]),
  estimatedHours: z.coerce.number().nullable().optional().transform((v) => v ?? null),
})

const tasksSchema = z.object({
  tasks: z.array(taskSchema).default([]),
})

const summarySchema = z.object({
  title: z.string().min(1).default('Resumen'),
  summary: z.string().default(''),
  keyPoints: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  entities: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
})

export class ZodOutputParser implements OutputParserPort {
  parse(outputKind: OutputKind, raw: unknown): Result<ParsedData, AppError> {
    try {
      if (outputKind === 'finanzas') {
        const data = financeSchema.parse(raw)
        return ok(data as ParsedData)
      }
      if (outputKind === 'tareas') {
        const data = tasksSchema.parse(raw)
        return ok(data as ParsedData)
      }
      const data = summarySchema.parse(raw)
      return ok(data as ParsedData)
    } catch (error) {
      return err(new ValidationError('Output failed schema validation', { issues: error instanceof z.ZodError ? error.issues : String(error) }))
    }
  }
}
