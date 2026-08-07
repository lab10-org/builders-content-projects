import type { RunProgress } from '../../../src/mastra/progress'
import type { FatalCode, ReelBase, ReelView, RunInput, RunResult, RunView } from '../../../src/lib/types'

/**
 * The narrow shape this mapper needs. Deliberately not Mastra's record type:
 * extracting this from the real run record is the route's job, which keeps the
 * mapper pure and testable against hand-written values.
 */
export interface RunSnapshot {
  status: 'running' | 'completed' | 'failed'
  /** The reels the run selected; present once `rank` has finished. */
  ranked?: ReelBase[]
  /** Present once the run completed. */
  result?: RunResult
  /** Present when the run died. */
  error?: { code: FatalCode; message: string }
}

export interface ToRunViewArgs {
  runId: string
  input: Pick<RunInput, 'account' | 'actor'>
  snapshot: RunSnapshot
  progress: RunProgress
}

/** Pure: no I/O, no Mastra import, no clock. Everything reported comes from the
 *  arguments. */
export function toRunView({ runId, input, snapshot, progress }: ToRunViewArgs): RunView {
  const head = { runId, account: input.account, actor: input.actor }

  if (snapshot.status === 'failed') {
    const error = snapshot.error ?? {
      code: 'unexpected-error' as FatalCode,
      message: 'The run ended unexpectedly.',
    }
    // `error` is present if and only if status is 'aborted'.
    return { ...head, status: 'aborted', error, reels: [] }
  }

  if (snapshot.status === 'completed' && snapshot.result) {
    return {
      ...head,
      status: 'completed',
      reels: [...snapshot.result.reels].sort((a, b) => a.rank - b.rank),
    }
  }

  // Running: every selected reel shows up, each with the step in flight for it.
  const reels: ReelView[] = (snapshot.ranked ?? [])
    .map((reel) => ({
      ...reel,
      status: 'pending' as const,
      // Before the first step reports, the reel is about to be hydrated.
      currentStep: progress[reel.shortcode] ?? ('hydrate' as const),
    }))
    .sort((a, b) => a.rank - b.rank)

  return { ...head, status: 'running', reels }
}
