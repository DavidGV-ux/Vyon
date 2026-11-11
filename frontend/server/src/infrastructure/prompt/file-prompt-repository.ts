import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { MasterPromptRepositoryPort, MasterPromptTemplate } from '../../domain/ai/ports.js'
import type { OutputKind } from '../../domain/ai/value-objects.js'

type RawTemplate = {
  outputKind: OutputKind
  calibrationThreshold: number
  systemPrompt: string
  userPromptTemplate: string
  schema: Record<string, unknown>
}

type RawFile = { version: string; templates: RawTemplate[] }

export class FileMasterPromptRepository implements MasterPromptRepositoryPort {
  private cache: Map<OutputKind, MasterPromptTemplate> | null = null
  private readonly filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'prompts', 'master.v1.json')
  }

  private async load(): Promise<Map<OutputKind, MasterPromptTemplate>> {
    if (this.cache) return this.cache
    const raw = await readFile(this.filePath, 'utf8')
    const parsed = JSON.parse(raw) as RawFile
    const map = new Map<OutputKind, MasterPromptTemplate>()
    for (const t of parsed.templates) {
      map.set(t.outputKind, {
        version: parsed.version,
        outputKind: t.outputKind,
        systemPrompt: t.systemPrompt,
        userPromptTemplate: t.userPromptTemplate,
        schema: t.schema,
        calibrationThreshold: t.calibrationThreshold,
      })
    }
    this.cache = map
    return map
  }

  async getActive(outputKind: OutputKind): Promise<MasterPromptTemplate> {
    const map = await this.load()
    const template = map.get(outputKind)
    if (!template) throw new Error(`No prompt template for output kind: ${outputKind}`)
    return template
  }

  async listVersions(outputKind: OutputKind): Promise<string[]> {
    const map = await this.load()
    return map.has(outputKind) ? ['1.0.0'] : []
  }
}
