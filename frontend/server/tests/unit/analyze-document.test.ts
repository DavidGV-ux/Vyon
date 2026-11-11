import { describe, it, expect } from 'vitest'
import { AnalyzeDocumentUseCase } from '../../src/application/use-cases/analyze-document.js'
import { DeterministicProvider } from '../../src/infrastructure/ai/deterministic-provider.js'
import { FileMasterPromptRepository } from '../../src/infrastructure/prompt/file-prompt-repository.js'
import { InMemoryAnalysisRepository } from '../../src/infrastructure/persistence/in-memory-analysis-repository.js'
import { ZodOutputParser } from '../../src/infrastructure/ai/output-parser.js'
import { SystemClock } from '../../src/infrastructure/observability/clock.js'
import { UuidIdGenerator } from '../../src/infrastructure/observability/id-generator.js'
import { createMetricsRegistry } from '../../src/infrastructure/observability/metrics.js'
import { createLogger } from '../../src/infrastructure/observability/logger.js'

describe('AnalyzeDocumentUseCase', () => {
  it('produces a valid finance report with deterministic provider', async () => {
    const clock = new SystemClock()
    const useCase = new AnalyzeDocumentUseCase(
      new FileMasterPromptRepository(),
      new DeterministicProvider(),
      new InMemoryAnalysisRepository(),
      new ZodOutputParser(),
      clock,
      new UuidIdGenerator(),
      createLogger('silent'),
      createMetricsRegistry(false).metrics,
    )
    const result = await useCase.execute({
      outputKind: 'finanzas',
      input: { parts: [{ kind: 'text', text: 'Paid $250 for hosting' }], language: 'en' },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outputKind).toBe('finanzas')
      expect(result.value.calibration.passed).toBe(true)
    }
  })

  it('produces tasks', async () => {
    const clock = new SystemClock()
    const useCase = new AnalyzeDocumentUseCase(
      new FileMasterPromptRepository(),
      new DeterministicProvider(),
      new InMemoryAnalysisRepository(),
      new ZodOutputParser(),
      clock,
      new UuidIdGenerator(),
      createLogger('silent'),
      createMetricsRegistry(false).metrics,
    )
    const result = await useCase.execute({
      outputKind: 'tareas',
      input: { parts: [{ kind: 'text', text: 'Set up CI\nWrite README\nDeploy to prod' }], language: 'en' },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const data = result.value.data as { tasks: unknown[] }
      expect(data.tasks.length).toBeGreaterThan(0)
    }
  })

  it('produces a summary', async () => {
    const clock = new SystemClock()
    const useCase = new AnalyzeDocumentUseCase(
      new FileMasterPromptRepository(),
      new DeterministicProvider(),
      new InMemoryAnalysisRepository(),
      new ZodOutputParser(),
      clock,
      new UuidIdGenerator(),
      createLogger('silent'),
      createMetricsRegistry(false).metrics,
    )
    const result = await useCase.execute({
      outputKind: 'resumenes',
      input: { parts: [{ kind: 'text', text: 'VYON is a productivity tool. It has kanban boards.' }], language: 'en' },
    })
    expect(result.ok).toBe(true)
  })
})
