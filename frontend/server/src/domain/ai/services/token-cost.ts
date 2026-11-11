type ModelPricing = {
  readonly inputPerMillion: number
  readonly outputPerMillion: number
}

/** Precios USD por 1M de tokens (input/output). Actualizar al cambiar de modelo. */
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'claude-3-5-sonnet-latest': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-3-5-haiku-latest': { inputPerMillion: 0.8, outputPerMillion: 4 },
  deterministic: { inputPerMillion: 0, outputPerMillion: 0 },
}

/**
 * Estima el costo USD de una llamada a la API de IA. Alimenta las métricas
 * `vyon_ai_cost_usd_total` para poder medir el margen bruto objetivo (>85%).
 */
export class TokenCostService {
  constructor(private readonly pricing: Record<string, ModelPricing> = DEFAULT_PRICING) {}

  costUsd(model: string, inputTokens: number, outputTokens: number): number {
    const rates = this.pricing[model] ?? this.pricing['gpt-4o-mini']!
    const cost = (inputTokens * rates.inputPerMillion + outputTokens * rates.outputPerMillion) / 1_000_000
    return Number(cost.toFixed(6))
  }
}
