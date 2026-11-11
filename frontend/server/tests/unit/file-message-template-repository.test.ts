import { describe, it, expect } from 'vitest'
import { FileMessageTemplateRepository } from '../../src/infrastructure/messaging/file-message-template-repository.js'

describe('FileMessageTemplateRepository', () => {
  const repo = new FileMessageTemplateRepository()

  it('returns the retention template in spanish', async () => {
    const template = await repo.getActive('retention', 'es')
    expect(template.body).toContain('VYON')
    expect(template.body).toContain('{{days}}')
    expect(template.step).toBeNull()
  })

  it('returns the english variant when requested', async () => {
    const template = await repo.getActive('retention', 'en')
    expect(template.body).toContain('VYON')
    expect(template.body).toContain('days')
  })

  it('returns the step-specific reactivation template with fallback', async () => {
    const step2 = await repo.getActive('reactivation', 'es', 2)
    expect(step2.step).toBe(2)
    expect(step2.body).toContain('tip rápido')

    const generic = await repo.getActive('reactivation', 'es', 99)
    expect(generic.body).toContain('VYON')
  })

  it('throws for unknown kind/language', async () => {
    await expect(repo.getActive('retention', 'fr' as never)).rejects.toThrow()
  })
})
