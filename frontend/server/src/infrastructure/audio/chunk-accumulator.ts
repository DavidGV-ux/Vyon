export type AudioChunk = { readonly data: Buffer; readonly timestampMs: number }

export type ChunkAccumulatorOptions = {
  readonly partialIntervalMs: number
  readonly minPartialBytes: number
  readonly silenceRmsThreshold: number
}

export class ChunkAccumulator {
  private readonly buffers: Buffer[] = []
  private totalBytes = 0
  private lastPartialAt = 0
  private silenceStreakMs = 0

  constructor(private readonly options: ChunkAccumulatorOptions) {}

  append(chunk: AudioChunk): { shouldTranscribePartial: boolean; isSilence: boolean } {
    const rms = this.computeRms(chunk.data)
    const isSilence = rms < this.options.silenceRmsThreshold
    if (isSilence) this.silenceStreakMs += 100
    else this.silenceStreakMs = 0

    this.buffers.push(chunk.data)
    this.totalBytes += chunk.data.length

    const now = chunk.timestampMs
    const enoughBytes = this.totalBytes >= this.options.minPartialBytes
    const intervalElapsed = now - this.lastPartialAt >= this.options.partialIntervalMs
    const silenceBoundary = isSilence && this.silenceStreakMs >= 600 && this.totalBytes > 0

    const shouldTranscribePartial = (enoughBytes && intervalElapsed) || silenceBoundary
    if (shouldTranscribePartial) this.lastPartialAt = now
    return { shouldTranscribePartial, isSilence }
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.buffers)
  }

  reset(): void {
    this.buffers.length = 0
    this.totalBytes = 0
    this.lastPartialAt = 0
    this.silenceStreakMs = 0
  }

  get size(): number {
    return this.totalBytes
  }

  private computeRms(data: Buffer): number {
    if (data.length < 2) return 0
    let sum = 0
    const samples = Math.floor(data.length / 2)
    for (let i = 0; i < samples; i++) {
      const sample = data.readInt16LE(i * 2)
      sum += sample * sample
    }
    return Math.sqrt(sum / Math.max(1, samples))
  }
}
