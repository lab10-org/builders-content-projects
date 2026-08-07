import { spawn } from 'node:child_process'
import type { FatalCode } from '../types'

// `FatalCode` is DEFINED in ../types (a leaf module with no imports) because
// `RunView.error.code` references it. Re-exporting it here keeps the design's
// published interface — `import { FatalCode, FatalRunError } from '.../preflight'`
// — intact, with no runtime cycle and no task depending on a later one.
export type { FatalCode }

/**
 * The single exception type allowed to escape a step and abort a whole run.
 * Anything else that goes wrong inside the per-reel pipeline is returned as a
 * `failed` ReelOutcome instead, so one bad reel never costs the batch (6.1).
 */
export class FatalRunError extends Error {
  constructor(
    readonly code: FatalCode,
    message: string,
  ) {
    super(message)
    // Set explicitly so the name survives transpilation and `instanceof` is not
    // the only way to tell this apart after a throw/catch round trip.
    this.name = 'FatalRunError'
  }
}

export interface BinaryProbe {
  isAvailable(binary: string): Promise<boolean>
}

export interface PreflightEnv {
  IG_SESSIONID?: string
  OPENROUTER_API_KEY?: string
}

const isBlank = (value: string | undefined): boolean => (value ?? '').trim() === ''

/**
 * Verifies the run's preconditions before any content is downloaded (7.1) and
 * rejects naming the single unmet one (7.2). Ordered cheapest-first: the two
 * env vars are pure reads, the probe spawns a process.
 */
export async function assertPreconditions(env: PreflightEnv, probe: BinaryProbe): Promise<void> {
  if (isBlank(env.IG_SESSIONID)) {
    throw new FatalRunError(
      'missing-ig-session',
      'IG_SESSIONID is not set. Copy .env.local.example to .env.local and fill it in with the session cookie of a disposable Instagram account.',
    )
  }

  if (isBlank(env.OPENROUTER_API_KEY)) {
    throw new FatalRunError(
      'missing-openrouter-key',
      'OPENROUTER_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.',
    )
  }

  if (!(await probe.isAvailable('ffmpeg'))) {
    throw new FatalRunError(
      'ffmpeg-unavailable',
      'ffmpeg was not found on PATH. Install it (macOS: `brew install ffmpeg`) before starting a run.',
    )
  }
}

/**
 * Default probe over child_process. Not part of the design's published
 * interface — added so `assertPreconditions` has a real implementation to be
 * called with in production while staying injectable in tests.
 */
export function createBinaryProbe(): BinaryProbe {
  return {
    isAvailable: (binary: string) =>
      new Promise<boolean>((resolve) => {
        const child = spawn(binary, ['-version'], { stdio: 'ignore' })
        // A missing binary emits 'error' (ENOENT) rather than exiting non-zero,
        // so this path must resolve false, never reject.
        child.once('error', () => resolve(false))
        child.once('close', (code) => resolve(code === 0))
      }),
  }
}
