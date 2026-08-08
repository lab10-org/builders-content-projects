import { join } from 'node:path'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

/** Downloads the mp4 into the run-scoped temp directory (2.2). */
export function download(state: ReelState, deps: RunDeps): Promise<ReelState> {
  return withReelFailure('download', state, async () => {
    const pending = state as Extract<ReelState, { status: 'pending' }>

    // tmpDir is read from the run state, never recomputed here, so T18's
    // cleanup removes the file that was actually written.
    const videoPath = join(deps.tmpDir, `${pending.shortcode}.mp4`)
    await deps.instagram.downloadVideo(pending.videoUrl ?? '', videoPath)

    return { ...pending, videoPath }
  }, deps)
}
