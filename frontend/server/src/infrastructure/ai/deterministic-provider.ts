import type { AiProviderPort, AiGenerationRequest, AiGenerationResult } from '../../domain/ai/ports.js'
import type { OutputKind } from '../../domain/ai/value-objects.js'

function detectKind(systemPrompt: string): OutputKind {
  if (systemPrompt.includes('"entries"')) return 'finanzas'
  if (systemPrompt.includes('"tasks"')) return 'tareas'
  return 'resumenes'
}

export class DeterministicProvider implements AiProviderPort {
  readonly name = 'deterministic'

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    const startedAt = performance.now()
    const kind = detectKind(request.systemPrompt)
    const text = this.build(kind, request.userPrompt)
    return {
      text,
      model: 'deterministic-1',
      inputTokens: request.userPrompt.length,
      outputTokens: text.length,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }

  private build(kind: OutputKind, input: string): string {
    const today = new Date().toISOString().slice(0, 10)
    if (kind === 'finanzas') {
      const amount = (input.match(/\$?\s?(\d+(?:[.,]\d{1,2})?)/)?.[1] ?? '100').replace(',', '.')
      return JSON.stringify({
        currency: 'USD',
        entries: [
          { description: 'Ingreso detectado automáticamente', amount: Number(amount) || 100, type: 'income', category: 'general', date: today, paymentMethod: null, confidence: 0.6 },
        ],
        totals: { income: Number(amount) || 100, expense: 0, net: Number(amount) || 100 },
      })
    }
    if (kind === 'tareas') {
      const lines = input.split(/\n+/).filter((l) => l.trim().length > 8).slice(0, 5)
      const tasks = (lines.length ? lines : ['Tarea generada automáticamente']).map((line) => ({
        title: line.trim().slice(0, 80),
        description: line.trim(),
        priority: 'medium',
        status: 'todo',
        dueDate: null,
        assignee: null,
        project: null,
        tags: ['auto'],
        estimatedHours: null,
      }))
      return JSON.stringify({ tasks })
    }
    return JSON.stringify({
      title: 'Resumen automático',
      summary: input.slice(0, 400) || 'Sin contenido suficiente para resumir.',
      keyPoints: input.split(/[.!?]/).map((s) => s.trim()).filter(Boolean).slice(0, 5),
      actionItems: [],
      sentiment: 'neutral',
      entities: [],
      topics: [],
    })
  }
}
