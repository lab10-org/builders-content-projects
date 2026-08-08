import { MODELS } from '../../lib/models'
import { SchemaValidationError } from '../../lib/openrouter'
import { buildScriptPrompt } from '../../lib/prompts'
import { reelScriptSchema } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

/** Writes the script in the actor's voice and produces the reel's `ok`
 *  outcome (4.1, 4.2, 4.6). */
export function generateScript(state: ReelState, deps: RunDeps): Promise<ReelState> {
  return withReelFailure('generate-script', state, async () => {
    const pending = state as Extract<ReelState, { status: 'pending' }>

    let script
    try {
      script = await deps.completion.complete({
        model: MODELS.generation,
        // The profile rides on the state — this step reads no file.
        prompt: buildScriptPrompt({
          analysis: pending.analysis!,
          profile: pending.profile!,
        }),
        schema: reelScriptSchema,
      })
    } catch (error) {
      if (error instanceof SchemaValidationError) throw new Error('invalid script response')
      throw error
    }

    const { rank, shortcode, thumbnailUrl, metrics, videoPath, audioPath } = pending
    return {
      rank,
      shortcode,
      thumbnailUrl,
      metrics,
      status: 'ok',
      analysis: pending.analysis!,
      script,
      // Carried so cleanup (T18) can still find the temp files.
      videoPath,
      audioPath,
    } as unknown as ReelState
  }, deps)
}
