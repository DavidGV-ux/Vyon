import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { MessageTemplateRepositoryPort } from '../../domain/messaging/ports.js'
import type { MessageTemplate } from '../../domain/messaging/entities.js'
import type { MessageKind, MessageLanguage } from '../../domain/messaging/value-objects.js'

type RawTemplate = {
  kind: MessageKind
  language: MessageLanguage
  step: number | null
  body: string
}

type RawFile = { version: string; templates: RawTemplate[] }

export class FileMessageTemplateRepository implements MessageTemplateRepositoryPort {
  private cache: MessageTemplate[] | null = null
  private readonly filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'prompts', 'messaging.v1.json')
  }

  private async load(): Promise<MessageTemplate[]> {
    if (this.cache) return this.cache
    const raw = await readFile(this.filePath, 'utf8')
    const parsed = JSON.parse(raw) as RawFile
    this.cache = parsed.templates.map((t) => ({
      kind: t.kind,
      language: t.language,
      step: t.step,
      version: parsed.version,
      body: t.body,
    }))
    return this.cache
  }

  async getActive(kind: MessageKind, language: MessageLanguage = 'es', step?: number): Promise<MessageTemplate> {
    const templates = await this.load()
    const candidates = templates.filter((t) => t.kind === kind && t.language === language)
    if (candidates.length === 0) {
      throw new Error(`No message template for kind=${kind} language=${language}`)
    }
    if (step !== undefined) {
      const exact = candidates.find((t) => t.step === step)
      if (exact) return exact
    }
    const generic = candidates.find((t) => t.step === null)
    if (generic) return generic
    return candidates[0]!
  }

  async listVersions(kind: MessageKind): Promise<string[]> {
    const templates = await this.load()
    return templates.some((t) => t.kind === kind) ? ['1.0.0'] : []
  }
}
