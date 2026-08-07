import { MODELS } from '../../lib/models'
import { SchemaValidationError } from '../../lib/openrouter'
import { buildAnalysisPrompt } from '../../lib/prompts'
import { reelAnalysisSchema } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

/** Analyses the reel from its transcript and caption (3.1). The single retry
 *  demanded by 3.3 lives inside `complete`; this step only maps its give-up. */
export function analyze(state: ReelState, deps: RunDeps): Promise<ReelState> {
  return withReelFailure('analyze', state, async () => {
    const pending = state as Extract<ReelState, { status: 'pending' }>

    try {
      const analysis = await deps.completion.complete({
        model: MODELS.analysis,
        prompt: buildAnalysisPrompt({
          transcript: pending.transcript ?? '',
          caption: pending.caption ?? '',
        }),
        schema: reelAnalysisSchema,
      })

      return { ...pending, analysis }
    } catch (error) {
      // Only the client's give-up gets the fixed reason (3.4); every other
      // message survives so a transport failure stays diagnosable.
      if (error instanceof SchemaValidationError) throw new Error('invalid analysis response')
      throw error
    }
  }, deps)
}
