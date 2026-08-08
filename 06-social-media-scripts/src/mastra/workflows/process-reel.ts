import { RuntimeContext } from '@mastra/core/runtime-context'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { FatalRunError } from '../../lib/preflight'
import type { ReelOutcome } from '../../lib/types'
import { type RunDeps, getRunDeps, withRunDeps } from '../deps'
import type { ReelState } from '../state'
import { analyze } from '../steps/analyze'
import { cleanup } from '../steps/cleanup'
import { download } from '../steps/download'
import { extractAudio } from '../steps/extract-audio'
import { generateScript } from '../steps/generate-script'
import { hydrate } from '../steps/hydrate'
import { transcribe } from '../steps/transcribe'

// The reel state is a discriminated union our own types already govern; the
// engine only needs a pass-through schema, so `z.custom` keeps one definition
// of the shape instead of maintaining a parallel zod mirror of it.
const reelState = z.custom<ReelState>()
const reelOutcome = z.custom<ReelOutcome>()

type StepFn = (state: ReelState, deps: RunDeps) => Promise<ReelState>

/**
 * Mastra reports a thrown step error as a `failed` result and does not hand the
 * original instance back, so a `FatalRunError` would arrive as a plain
 * string/Error and lose its `code`. Stash the real instance on the way out and
 * rethrow it verbatim after the run.
 */
const FATAL_KEY = 'fatalRunError'

const step = (id: string, fn: StepFn) =>
  createStep({
    id,
    inputSchema: reelState,
    outputSchema: reelState,
    // Adapters come off the runtime context — steps never import a client.
    execute: async ({ inputData, runtimeContext }) => {
      try {
        return await fn(inputData, getRunDeps(runtimeContext))
      } catch (error) {
        if (error instanceof FatalRunError) runtimeContext.set(FATAL_KEY, error)
        throw error
      }
    },
  })

/** Projects the working state onto the published outcome, dropping the
 *  intermediate fields (videoPath, audioPath, transcript, profile…). */
const project = createStep({
  id: 'outcome',
  inputSchema: reelState,
  outputSchema: reelOutcome,
  execute: async ({ inputData }): Promise<ReelOutcome> => {
    const { rank, shortcode, thumbnailUrl, metrics } = inputData
    const base = { rank, shortcode, thumbnailUrl, metrics }

    if (inputData.status === 'failed') {
      const { failedStep, reason } = inputData
      return { ...base, status: 'failed', failedStep, reason }
    }

    const ok = inputData as Extract<ReelState, { status: 'ok' }>
    return { ...base, status: 'ok', analysis: ok.analysis, script: ok.script }
  },
})

export const processReelWorkflow = createWorkflow({
  id: 'process-reel',
  inputSchema: reelState,
  outputSchema: reelOutcome,
})
  .then(step('hydrate', hydrate))
  .then(step('download', download))
  .then(step('extract-audio', extractAudio))
  .then(step('transcribe', transcribe))
  .then(step('analyze', analyze))
  .then(step('generate-script', generateScript))
  .then(step('cleanup', cleanup))
  .then(project)
  .commit()

/**
 * Runs one reel through the engine and gives the contract the design asks for:
 * a `ReelOutcome` for anything reel-level, and a rejection only when a
 * `FatalRunError` escaped (7.3). Mastra reports a thrown step error as a
 * `failed` result rather than rejecting, so the rethrow happens here.
 */
export async function runProcessReel(reel: ReelState, deps: RunDeps): Promise<ReelOutcome> {
  const run = await processReelWorkflow.createRunAsync()
  const runtimeContext = new RuntimeContext()
  withRunDeps(runtimeContext, deps)

  const result = await run.start({ inputData: reel, runtimeContext })

  // Prefer the stashed instance over Mastra's serialized copy, so the caller
  // still gets a real FatalRunError with its `code` intact.
  const fatal = runtimeContext.get(FATAL_KEY) as FatalRunError | undefined
  if (fatal instanceof FatalRunError) throw fatal

  if (result.status === 'failed') throw result.error
  if (result.status === 'suspended') throw new Error('process-reel suspended unexpectedly')
  return result.result
}
