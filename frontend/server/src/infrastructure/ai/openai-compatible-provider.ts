import type { AiProviderPort, AiGenerationRequest, AiGenerationResult } from '../../domain/ai/ports.js'
import { httpPostJson } from './http-client.js'

export type OpenAIProviderOptions = {
  readonly apiKey: string
  readonly baseUrl: string
  readonly model: string
}

export class OpenAICompatibleProvider implements AiProviderPort {
  readonly name = 'openai'
  constructor(private readonly options: OpenAIProviderOptions) {}

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    if (!this.options.apiKey) throw new Error('OPENAI_API_KEY not configured')
    const startedAt = performance.now()
    const content: unknown[] = []
    for (const part of request.parts) {
      if (part.kind === 'text') content.push({ type: 'text', text: part.text })
      else if (part.kind === 'image') content.push({ type: 'image_url', image_url: { url: `data:${part.mediaType};base64,${part.base64}` } })
    }
    content.push({ type: 'text', text: request.userPrompt })

    const result = await httpPostJson(
      `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
      { Authorization: `Bearer ${this.options.apiKey}` },
      {
        model: this.options.model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content },
        ],
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      },
      request.signal,
    )
    if (!result.ok) throw result.error

    const data = JSON.parse(result.body) as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      model?: string
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    return {
      text,
      model: data.model ?? this.options.model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}
