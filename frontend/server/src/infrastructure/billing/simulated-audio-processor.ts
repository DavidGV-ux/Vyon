import type { AudioJob } from '../../domain/audio-jobs/entities.js'
import type { AudioProcessResult, AudioProcessorPort } from '../../domain/audio-jobs/ports.js'

export type SimulatedAudioProcessorOptions = {
  readonly provider?: string
  /** Latencia simulada de transcripción (ms). */
  readonly delayMs?: number
  /** Probabilidad [0..1] de fallo simulado. */
  readonly failureRate?: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Procesador de audio simulado. Puede sustituirse por un adapter del
 * TranscribeAudioUseCase (dominio AI) sin tocar el scheduler:
 * implementa AudioProcessorPort y listo.
 */
export class SimulatedAudioProcessor implements AudioProcessorPort {
  readonly name: string

  constructor(private readonly options: SimulatedAudioProcessorOptions = {}) {
    this.name = options.provider ?? 'simulated'
  }

  async process(job: AudioJob): Promise<AudioProcessResult> {
    if (this.options.delayMs) await sleep(this.options.delayMs)
    if (this.options.failureRate && Math.random() < this.options.failureRate) {
      throw new Error('transcripción simulada fallida')
    }
    return {
      text: `[${job.fileName}] Transcripción simulada de ${job.mediaType} para ${job.userId}.`,
      provider: this.name,
    }
  }
}
