import type { MasterPromptTemplate } from '../ports.js'
import type { Strictness } from '../value-objects.js'
import type { MultimodalInput } from '../entities.js'

export type MasterPrompt = {
  readonly systemPrompt: string
  readonly userPrompt: string
}

const STRICTNESS_RULES: Record<Strictness, string> = {
  relaxed: 'Be flexible about missing fields; fill sensible defaults and mark low confidence.',
  balanced: 'Extract every field you can confidently. Use null for genuinely unknown values.',
  strict: 'Only emit fields supported by the source. Never invent values; set confidence accordingly.',
}

export class MasterPromptBuilder {
  build(template: MasterPromptTemplate, input: MultimodalInput, strictness: Strictness): MasterPrompt {
    const schemaJson = JSON.stringify(template.schema, null, 2)
    const systemPrompt = template.systemPrompt
      .replace('{{SCHEMA}}', schemaJson)
      .replace('{{LANGUAGE}}', input.language)
      .replace('{{STRICTNESS}}', STRICTNESS_RULES[strictness])
      .replace('{{CONTEXT}}', input.context ?? 'No additional context provided.')

    const userPrompt = this.buildUserPrompt(template, input)
    return { systemPrompt, userPrompt }
  }

  private buildUserPrompt(template: MasterPromptTemplate, input: MultimodalInput): string {
    const parts: string[] = []
    const textParts = input.parts.filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
    for (const part of textParts) {
      parts.push(part.text)
    }
    if (input.context) {
      parts.push(`Context: ${input.context}`)
    }
    parts.push(`Respond in ${input.language === 'es' ? 'Spanish' : 'English'}.`)
    parts.push('Return ONLY a single valid JSON object. No markdown, no prose.')
    const base = parts.join('\n\n')
    return template.userPromptTemplate.replace('{{INPUT}}', base)
  }
}
