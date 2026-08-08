import { join } from 'node:path'
import { MAX_AUDIO_BYTES } from '../../lib/openrouter'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

/** One literal, shared with the transcription client's own AudioTooLargeError. */
const TOO_LARGE = 'audio too large'

/** Extracts a mono 16 kHz MP3 and refuses anything over the transcription
 *  provider's limit before a request is ever built (2.3, 2.6). */
export function extractAudio(state: ReelState, deps: RunDeps): Promise<ReelState> {
  return withReelFailure('extract-audio', state, async () => {
    const pending = state as Extract<ReelState, { status: 'pending' }>

    const destPath = join(deps.tmpDir, `${pending.shortcode}.mp3`)
    const { path, sizeBytes } = await deps.media.extractAudio(pending.videoPath ?? '', destPath)

    // Extend the state FIRST, so the failure below still carries audioPath and
    // cleanup can delete the very file the guard refused to send (2.5).
    const extended = { ...pending, audioPath: path, audioSizeBytes: sizeBytes }

    // "Exceeds" — a file exactly at the limit passes through.
    if (sizeBytes > MAX_AUDIO_BYTES) {
      // Returned, not thrown: throwing would make withReelFailure rebuild the
      // outcome from the INPUT state, dropping audioPath and leaking the file.
      return {
        ...extended,
        status: 'failed',
        failedStep: 'extract-audio',
        reason: TOO_LARGE,
      } as unknown as ReelState
    }

    return extended
  }, deps)
}
