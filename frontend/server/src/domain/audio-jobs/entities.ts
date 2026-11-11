import type { PlanId } from '../billing/entities.js'

export type AudioJobStatus = 'queued' | 'running' | 'done' | 'failed'

export type AudioJobPriority = 'normal' | 'high'

export type AudioJob = {
  readonly id: string
  readonly userId: string
  readonly plan: PlanId
  readonly priority: AudioJobPriority
  readonly status: AudioJobStatus
  readonly mediaType: string
  readonly fileName: string
  readonly enqueuedAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly transcript: string | null
  readonly error: string | null
}

export function newAudioJob(init: {
  id: string
  userId: string
  plan: PlanId
  priority: AudioJobPriority
  mediaType: string
  fileName: string
  now: string
}): AudioJob {
  return {
    id: init.id,
    userId: init.userId,
    plan: init.plan,
    priority: init.priority,
    status: 'queued',
    mediaType: init.mediaType,
    fileName: init.fileName,
    enqueuedAt: init.now,
    startedAt: null,
    finishedAt: null,
    transcript: null,
    error: null,
  }
}
