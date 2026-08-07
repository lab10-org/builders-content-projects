import type { PipelineStep } from '../lib/types'

/** shortcode → the step currently executing for that reel. */
export type RunProgress = Record<string, PipelineStep>

export interface ProgressRecorder {
  record(runId: string, shortcode: string, step: PipelineStep): void
  read(runId: string): RunProgress
}

/**
 * In-memory, keyed by runId. A run's state is not durable — "Persistence and
 * history" is out of scope — so this lives beside the process that serves the
 * poll, and 5.3 has a real source instead of depending on whether Mastra's
 * snapshot happens to expose per-item progress inside a `foreach`.
 */
export function createProgressRecorder(): ProgressRecorder {
  const runs = new Map<string, RunProgress>()

  return {
    record(runId, shortcode, step) {
      const progress = runs.get(runId) ?? {}
      // The CURRENT step, not a history: a later record overwrites.
      progress[shortcode] = step
      runs.set(runId, progress)
    },
    read(runId) {
      return { ...(runs.get(runId) ?? {}) }
    },
  }
}
