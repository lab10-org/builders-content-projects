import { z } from 'zod'

// This module is a LEAF: it imports nothing from the rest of the app, so every
// other module can depend on it without risking a cycle. That is why
// `FatalCode` is defined here rather than in lib/preflight — `RunView.error`
// needs it, and preflight re-exports it to keep the design's published
// interface (`import { FatalCode, FatalRunError } from '.../preflight'`) intact.

// ---- run input / output -------------------------------------------------

export interface RunInput {
  account: string
  actor: string
  /** How many recent reels to inspect before ranking. */
  scan: number
  /** How many of the highest-ranked reels to process. */
  top: number
}

export interface ReelMetrics {
  views: number
  likes: number
  comments: number
}

// ---- LLM outputs --------------------------------------------------------
// The single shared definition of "conforms to the schema" (3.2, 4.3).

export const reelAnalysisSchema = z.object({
  objective: z.string().min(1),
  highlights: z.array(z.string().min(1)).min(1),
  targetAudience: z.string().min(1),
})
export type ReelAnalysis = z.infer<typeof reelAnalysisSchema>

export const reelScriptSchema = z.object({
  hook: z.string().min(1),
  body: z.string().min(1),
  closing: z.string().min(1),
})
export type ReelScript = z.infer<typeof reelScriptSchema>

// ---- per-reel outcome ---------------------------------------------------
// Failures are values, not exceptions: a step that fails returns a `failed`
// outcome and every later step passes it through untouched, so requirement 6.1
// holds regardless of how the workflow engine treats a thrown exception inside
// a parallel branch.

export type PipelineStep =
  | 'hydrate'
  | 'download'
  | 'extract-audio'
  | 'transcribe'
  | 'analyze'
  | 'generate-script'

export interface ReelBase {
  rank: number
  shortcode: string
  thumbnailUrl: string
  metrics: ReelMetrics
}

export type ReelOutcome =
  | (ReelBase & { status: 'ok'; analysis: ReelAnalysis; script: ReelScript })
  | (ReelBase & { status: 'failed'; failedStep: PipelineStep; reason: string })

/**
 * What the per-reel workflow consumes. The design names this type but never
 * defines it, and `ReelBase` carries no `mediaId` — which `hydrate` needs.
 */
export type ReelInput = ReelBase & { mediaId: string }

export interface RunResult {
  account: string
  actor: string
  /** ISO 8601. */
  generatedAt: string
  /** Ordered by ascending rank. */
  reels: ReelOutcome[]
}

// ---- fatal codes --------------------------------------------------------
// The one error class allowed to escape a step and abort the whole run.

export type FatalCode =
  | 'missing-ig-session'
  | 'missing-openrouter-key'
  | 'ffmpeg-unavailable'
  | 'unknown-actor'
  | 'account-not-found'
  | 'ig-session-expired'
  // Not raised by any adapter: the catch-all for a run that died on something
  // unforeseen. `RunView.error.code` is typed by this union, and without it an
  // unexpected crash would have no code to report and the page would keep
  // polling a run that is never coming back.
  | 'unexpected-error'

// ---- what the UI reads --------------------------------------------------

export type ReelView =
  | (ReelBase & { status: 'pending'; currentStep: PipelineStep })
  | ReelOutcome

export interface RunView {
  runId: string
  account: string
  actor: string
  status: 'running' | 'completed' | 'aborted'
  /** Present if and only if `status` is 'aborted'. */
  error?: { code: FatalCode; message: string }
  /** Ordered by ascending rank. */
  reels: ReelView[]
}
