import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

/** Fetches the reel's caption, video URL and duration (2.1). */
export function hydrate(state: ReelState, deps: RunDeps): Promise<ReelState> {
  return withReelFailure('hydrate', state, async () => {
    // Narrowed by withReelFailure: only a pending reel reaches here.
    const pending = state as Extract<ReelState, { status: 'pending' }>
    const { caption, videoUrl, durationSeconds } = await deps.instagram.hydrateReel(pending.mediaId)

    return { ...pending, caption, videoUrl, durationSeconds }
  }, deps)
}
