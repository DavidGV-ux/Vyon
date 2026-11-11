import { describe, it, expect } from 'vitest'
import { ZodOutputParser } from '../../src/infrastructure/ai/output-parser.js'

describe('ZodOutputParser', () => {
  const parser = new ZodOutputParser()

  it('parses valid finance report and recomputes totals', () => {
    const r = parser.parse('finanzas', {
      currency: 'USD',
      entries: [{ description: 'Salary', amount: 1000, type: 'income', category: 'salary', date: '2026-01-01', paymentMethod: null, confidence: 0.9 }],
      totals: { income: 0, expense: 0, net: 0 },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const data = r.value as { totals: { income: number; net: number } }
      expect(data.totals.income).toBe(1000)
      expect(data.totals.net).toBe(1000)
    }
  })

  it('coerces amount strings to numbers', () => {
    const r = parser.parse('finanzas', {
      currency: 'USD',
      entries: [{ description: 'Coffee', amount: '4.5', type: 'expense', category: 'food', date: '2026-01-02' }],
      totals: { income: 0, expense: 0, net: 0 },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const data = r.value as { entries: { amount: number }[] }
      expect(data.entries[0]?.amount).toBe(4.5)
    }
  })

  it('rejects invalid date format', () => {
    const r = parser.parse('finanzas', {
      currency: 'USD',
      entries: [{ description: 'X', amount: 1, type: 'income', category: 'c', date: '01/01/2026' }],
      totals: { income: 0, expense: 0, net: 0 },
    })
    expect(r.ok).toBe(false)
  })

  it('parses tasks', () => {
    const r = parser.parse('tareas', {
      tasks: [{ title: 'Write tests', priority: 'high', status: 'todo' }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const data = r.value as { tasks: { title: string; priority: string; status: string }[] }
      expect(data.tasks[0]?.title).toBe('Write tests')
      expect(data.tasks[0]?.priority).toBe('high')
    }
  })

  it('parses summary with defaults', () => {
    const r = parser.parse('resumenes', { summary: 'Short summary text here for testing purposes.' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const data = r.value as { sentiment: string; keyPoints: unknown[] }
      expect(data.sentiment).toBe('neutral')
      expect(Array.isArray(data.keyPoints)).toBe(true)
    }
  })
})
