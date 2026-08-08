import type { ActorProfile } from '../lib/profiles'
import type { ReelAnalysis, ReelBase, ReelOutcome, ReelScript } from '../lib/types'

/**
 * The in-flight per-reel state. `src/lib/types.ts` models only the finished
 * `ReelOutcome`; this is the working shape each step widens as it goes, so it
 * lives next to its only consumer — the step layer.
 *
 * Every field a later step adds is optional, which is what lets one type carry
 * a reel from `hydrate` through `generate-script` without a cast per step.
 */
export interface ReelWorkingState extends ReelBase {
  status: 'pending'
  mediaId: string
  // hydrate (T14)
  caption?: string
  videoUrl?: string
  durationSeconds?: number
  // download (T14)
  videoPath?: string
  // extract-audio (T15)
  audioPath?: string
  audioSizeBytes?: number
  // transcribe (T15)
  transcript?: string
  // analyze (T16)
  analysis?: ReelAnalysis
  // generate-script (T17) — the run-scoped actor profile rides on the state so
  // the step reads no file of its own.
  profile?: ActorProfile
  script?: ReelScript
}

/** What every per-reel step takes and returns. */
export type ReelState = ReelWorkingState | ReelOutcome

/** The temp-file paths a reel may have recorded, readable whatever its status —
 *  cleanup needs them on failed outcomes too (2.5). */
export type ReelTempPaths = { videoPath?: string; audioPath?: string }
