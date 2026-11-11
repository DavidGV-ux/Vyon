import { describe, it, expect } from 'vitest'
import { MasterPromptBuilder } from '../../src/domain/ai/services/master-prompt-builder.js'
import { FileMasterPromptRepository } from '../../src/infrastructure/prompt/file-prompt-repository.js'

describe('MasterPromptBuilder', () => {
  it('injects schema and strictness into system prompt', async () => {
    const repo = new FileMasterPromptRepository()
    const template = await repo.getActive('finanzas')
    const builder = new MasterPromptBuilder()
    const prompt = builder.build(template, { parts: [{ kind: 'text', text: 'hello' }], language: 'es' }, 'strict')
    expect(prompt.systemPrompt).toContain('entries')
    expect(prompt.systemPrompt).toContain('Strictness')
    expect(prompt.userPrompt).toContain('hello')
    expect(prompt.userPrompt).toContain('JSON')
  })
})
