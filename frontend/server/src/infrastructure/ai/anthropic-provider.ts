import type { AiProviderPort, AiGenerationRequest, AiGenerationResult } from '../../domain/ai/ports.js'
import { httpPostJson } from './http-client.js'

export type AnthropicProviderOptions = {
  readonly apiKey: string
  readonly model: string
}

export class AnthropicProvider implements AiProviderPort {
  readonly name = 'anthropic'
  constructor(private readonly options: AnthropicProviderOptions) {}

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.options.apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
    const startedAt = performance.now()
    const content: unknown[] = []
    for (const part of request.parts) {
      if (part.kind === 'text') content.push({ type: 'text', text: part.text })
      else if (part.kind === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } })
    }
    content.push({ type: 'text', text: request.userPrompt })

    const result = await httpPostJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: this.options.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content }],
      },
      request.signal,
    )
    if (!result.ok) throw result.error

    const data = JSON.parse(result.body) as {
      content: { type: string; text?: string }[]
      usage?: { input_tokens?: number; output_tokens?: number }
      model?: string
    }
    const text = data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
    return {
      text,
      model: data.model ?? this.options.model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}
