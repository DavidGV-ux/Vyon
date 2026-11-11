import type { AudioJob } from './entities.js'

export interface AudioJobRepositoryPort {
  save(job: AudioJob): Promise<void>
  findById(id: string): Promise<AudioJob | null>
  listByUser(userId: string, limit?: number): Promise<AudioJob[]>
}

export type AudioProcessResult = {
  readonly text: string
  readonly provider: string
}

/** Adapter hacia el caso de uso de transcripción (TranscribeAudioUseCase). */
export interface AudioProcessorPort {
  readonly name: string
  process(job: AudioJob): Promise<AudioProcessResult>
}

export type AudioSchedulerSnapshot = {
  readonly queueDepth: number
  readonly running: number
  readonly maxConcurrency: number
  readonly processed: number
  readonly failed: number
  readonly avgWaitMs: { readonly pro: number; readonly free: number }
  readonly jobsByPriority: { readonly high: number; readonly normal: number }
}
