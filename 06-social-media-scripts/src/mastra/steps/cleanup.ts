import type { RunDeps } from '../deps'
import type { ReelState, ReelTempPaths } from '../state'

/**
 * Deletes the reel's temp files (2.5).
 *
 * Deliberately does NOT use `withReelFailure`: its pass-through rule would skip
 * a failed reel, leaving that reel's downloaded video on disk forever. Cleanup
 * runs whatever the outcome, and is best-effort — `'cleanup'` is not a member of
 * `PipelineStep`, so a removal error can never turn a good reel into a bad one.
 */
export async function cleanup(state: ReelState, deps: RunDeps): Promise<ReelState> {
  const { videoPath, audioPath } = state as ReelState & ReelTempPaths

  for (const path of [videoPath, audioPath]) {
    if (!path) continue
    try {
      await deps.files.remove(path)
    } catch {
      // Already gone, or not ours to delete. Never surfaced.
    }
  }

  return state
}
