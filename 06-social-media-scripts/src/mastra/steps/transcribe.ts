import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

/** Stores the transcript against the reel (2.4). */
export function transcribe(state: ReelState, deps: RunDeps): Promise<ReelState> {
  return withReelFailure('transcribe', state, async () => {
    const pending = state as Extract<ReelState, { status: 'pending' }>

    const transcript = await deps.transcription.transcribe(
      pending.audioPath ?? '',
      pending.audioSizeBytes ?? 0,
    )

    return { ...pending, transcript }
  }, deps)
}
