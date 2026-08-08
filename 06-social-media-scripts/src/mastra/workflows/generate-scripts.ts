import { join } from 'node:path'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { FatalRunError } from '../../lib/preflight'
import type { ReelOutcome, RunInput, RunResult } from '../../lib/types'
import { type RunDeps, getRunDeps, withRunDeps } from '../deps'
import type { ReelState } from '../state'
import { type DiscoveredState, type RankedState, discover, rank } from '../steps/discover-rank'
import { type PreflightState, preflight } from '../steps/preflight'
import { processReelWorkflow } from './process-reel'

/** One named place for the limit the design fixes at three (6.3). */
export const MAX_REEL_CONCURRENCY = 3

const FATAL_KEY = 'fatalRunError'

const reelState = z.custom<ReelState>()
const reelOutcome = z.custom<ReelOutcome>()
const runResult = z.custom<RunResult>()

/**
 * Run-level steps: a FatalRunError aborts the run, so nothing wraps them the
 * way per-reel steps are wrapped. The stash survives Mastra serializing the
 * error on the way out.
 *
 * Each step declares its precise input and output types — a shared
 * `Record<string, unknown>` schema loses the chain's type information and
 * `.then()` stops type-checking against the previous step.
 */
const runStep = <I, O>(
  id: string,
  inputSchema: z.ZodType<I>,
  outputSchema: z.ZodType<O>,
  fn: (input: I, deps: RunDeps) => Promise<O>,
) =>
  createStep({
    id,
    inputSchema,
    outputSchema,
    execute: async ({ inputData, runtimeContext }): Promise<O> => {
      try {
        return await fn(inputData, getRunDeps(runtimeContext))
      } catch (error) {
        if (error instanceof FatalRunError) runtimeContext.set(FATAL_KEY, error)
        throw error
      }
    },
  })

/** Turns the ranked selection into the array `foreach` iterates, attaching the
 *  run's actor profile so `generate-script` reads it off its own input. */
const toReelStates = createStep({
  id: 'to-reel-states',
  inputSchema: z.custom<RankedState>(),
  outputSchema: z.array(reelState),
  execute: async ({ inputData }): Promise<ReelState[]> =>
    inputData.ranked.map((reel) => ({ ...reel, status: 'pending' as const, profile: inputData.profile })),
})

/**
 * Runs the per-reel workflow for one reel. `foreach` takes a Step, not a
 * Workflow, so the nested workflow is invoked here — through the engine, with
 * the same runtime context, so the injected adapters and the fatal-error stash
 * both carry across the boundary.
 */
const processReelStep = createStep({
  id: 'process-reel',
  inputSchema: reelState,
  outputSchema: reelOutcome,
  execute: async ({ inputData, runtimeContext }): Promise<ReelOutcome> => {
    const run = await processReelWorkflow.createRunAsync()
    const result = await run.start({ inputData, runtimeContext })

    if (result.status === 'failed') throw result.error
    if (result.status === 'suspended') throw new Error('process-reel suspended unexpectedly')
    return result.result
  },
})

const assemble = createStep({
  id: 'assemble',
  inputSchema: z.array(reelOutcome),
  outputSchema: runResult,
  execute: async ({ inputData, getInitData }): Promise<RunResult> => {
    const input = getInitData() as RunInput
    return {
      account: input.account,
      actor: input.actor,
      generatedAt: new Date().toISOString(),
      // Under foreach concurrency the arrival order is not guaranteed; the
      // design's invariant is "always ordered by ascending rank".
      reels: [...inputData].sort((a, b) => a.rank - b.rank),
    }
  },
})

export const generateScriptsWorkflow = createWorkflow({
  id: 'generate-scripts',
  inputSchema: z.custom<RunInput>(),
  outputSchema: runResult,
})
  .then(runStep('preflight', z.custom<RunInput>(), z.custom<PreflightState>(), preflight))
  .then(runStep('discover', z.custom<PreflightState>(), z.custom<DiscoveredState>(), discover))
  .then(runStep('rank', z.custom<DiscoveredState>(), z.custom<RankedState>(), rank))
  .then(toReelStates)
  .foreach(processReelStep, { concurrency: MAX_REEL_CONCURRENCY })
  .then(assemble)
  .commit()

/**
 * Starts a run and gives the design's contract: a `RunResult` for anything
 * reel-level, a rejection carrying the original `FatalRunError` otherwise.
 *
 * The run-scoped temp directory is derived from the run id here — `download`,
 * `extract-audio` and `cleanup` all assume one directory per run, and this is
 * where it is established.
 */
export async function runGenerateScripts(input: RunInput, deps: RunDeps): Promise<RunResult> {
  const run = await generateScriptsWorkflow.createRunAsync()
  const runtimeContext = new RuntimeContext()
  withRunDeps(runtimeContext, { ...deps, tmpDir: deps.tmpDir ?? join('tmp', run.runId) })

  const result = await run.start({ inputData: input, runtimeContext })

  // Mastra hands back a serialized copy of the error, so prefer the stashed
  // instance — T24b needs the real `code`.
  const fatal = runtimeContext.get(FATAL_KEY) as FatalRunError | undefined
  if (fatal instanceof FatalRunError) throw fatal

  if (result.status === 'failed') throw result.error
  if (result.status === 'suspended') throw new Error('generate-scripts suspended unexpectedly')
  return result.result
}
