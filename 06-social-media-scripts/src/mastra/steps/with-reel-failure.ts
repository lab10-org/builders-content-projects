import { FatalRunError } from '../../lib/preflight'
import type { PipelineStep } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { ReelState, ReelTempPaths } from '../state'

const describe = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  const text = String(error ?? '')
  // 6.1 requires a reason; it must never degrade to an empty string.
  return text.trim() === '' ? 'unknown error' : text
}

/**
 * The rule that makes requirement 6.1 hold regardless of how the workflow
 * engine treats a thrown exception inside a parallel branch:
 *
 *   - an already-failed reel passes through untouched, and `fn` never runs;
 *   - any other throw becomes a `failed` outcome labelled with this step;
 *   - a `FatalRunError` propagates — the one exception allowed to abort a run.
 */
export async function withReelFailure(
  step: PipelineStep,
  state: ReelState,
  fn: () => Promise<ReelState>,
  deps?: Pick<RunDeps, 'progress' | 'runId'>,
): Promise<ReelState> {
  // An already-failed reel passes through, so nothing is recorded for it and
  // its last real step stays visible.
  if (state.status === 'failed') return state

  // The one place progress is recorded (5.3): every per-reel step goes through
  // here, so no step body has to remember to do it.
  deps?.progress?.record(deps.runId ?? '', state.shortcode, step)

  try {
    return await fn()
  } catch (error) {
    if (error instanceof FatalRunError) throw error

    const { rank, shortcode, thumbnailUrl, metrics } = state
    // The temp paths ride along on the failed outcome. Without them, cleanup
    // (2.5) has nothing to delete for any reel that fails after `download`,
    // and every failed run leaks its video files.
    const { videoPath, audioPath } = state as ReelState & ReelTempPaths
    return {
      status: 'failed',
      failedStep: step,
      reason: describe(error),
      rank,
      shortcode,
      thumbnailUrl,
      metrics,
      ...(videoPath ? { videoPath } : {}),
      ...(audioPath ? { audioPath } : {}),
    } as ReelState
  }
}
