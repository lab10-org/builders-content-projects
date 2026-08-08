# Design — Reel Script Generation

**Status:** Draft
**Date:** 2026-08-06
**Requirements:** ./requirements.md

## Overview

The feature is one Mastra workflow that mirrors the requirement flow one-to-one:
discover an account's reels, rank them, then run each selected reel through its own
sub-workflow (hydrate → download → extract audio → transcribe → analyze → generate
script). A minimal Next.js page starts a run and polls its state.

Three decisions shape everything below.

**Thin steps, injected adapters.** Every workflow step orchestrates; nothing in a
step talks to the outside world directly. Instagram, ffmpeg, OpenRouter and the
filesystem each sit behind a small interface that is passed in. This is what lets
the unit suite run with no network and no API keys, and it keeps the one module
that understands Instagram's raw payload shape isolated from everything else.

**Two error classes, one rule.** A `FatalRunError` propagates and aborts the run
(requirements 1.5, 4.5, 7.2, 7.3). Everything else is *returned as a value*, not
thrown: a reel that fails becomes a `failed` outcome that later steps pass through
untouched (requirement 6.1). Isolation therefore does not depend on how the
workflow engine treats a thrown exception inside a parallel branch.

**Pure where it can be.** Ranking and prompt assembly are pure functions with no
I/O, so the two pieces of logic most likely to be wrong are also the cheapest to
test.

## Architecture

```
Next.js (app/)
  POST /api/runs ───────────► start workflow run, return { runId }        (5.1)
  GET  /api/runs/[runId] ───► read run snapshot → RunView                 (5.3–5.7)
        │
        ▼
Mastra (src/mastra/)
  generateScriptsWorkflow
    ├─ preflight ──── assertPreconditions + loadActorProfile              (7.1, 7.2, 4.5)
    ├─ discover ───── instagram.discoverReels(account, scan)              (1.1, 1.5)
    ├─ rank ───────── rankReels(reels, top)            [pure]             (1.2–1.4, 1.6)
    ├─ foreach(concurrency: 3) → processReelWorkflow                      (6.3)
    │     ├─ hydrate ───────── instagram.hydrateReel                      (2.1)
    │     ├─ downloadVideo ─── instagram.downloadVideo                    (2.2)
    │     ├─ extractAudio ──── media.extractAudio                         (2.3, 2.6)
    │     ├─ transcribe ────── openrouter.transcribe                      (2.4)
    │     ├─ analyze ───────── openrouter.complete(analysisSchema)        (3.1–3.4)
    │     ├─ generateScript ── openrouter.complete(scriptSchema)          (4.1–4.4, 4.6)
    │     └─ cleanup ───────── remove temp video + audio                  (2.5)
    └─ assemble ───── final run output                                    (5.4, 6.2)
        │
        ▼
Adapters (src/lib/)
  instagram/  media/  openrouter/  ranking/  profiles/  prompts/  preflight/
```

Directory layout:

```
src/
  lib/
    instagram/     insta-fetcher adapter — the only module that knows api/v1's shape
    media/         ffmpeg adapter
    openrouter/    transcription + schema-constrained completion
    ranking/       rankReels — pure
    prompts/       prompt builders — pure
    profiles/      actor profile loading
    preflight/     environment/binary precondition checks
    models.ts      the model IDs used per step, in one place
  mastra/
    index.ts       Mastra instance + storage
    workflows/     generate-scripts.ts, process-reel.ts
    steps/         one file per step
  app/
    page.tsx       the single page
    api/runs/      route handlers
profiles/          <actor>.md, hand-written
```

`src/lib/models.ts` centralizes which OpenRouter model backs each step
(transcription, analysis, generation) so the three IDs are swappable in one place.
The exact IDs are pinned during implementation against OpenRouter's live model
list — the analysis and generation steps use `anthropic/...` IDs, transcription
uses a model from OpenRouter's speech-to-text collection.

## Components and interfaces

### `lib/preflight`

- **Responsibility:** fail a misconfigured run before any content is downloaded.
- **Interface:**

```ts
export type FatalCode =
  | 'missing-ig-session'
  | 'missing-openrouter-key'
  | 'ffmpeg-unavailable'
  | 'unknown-actor'
  | 'account-not-found'
  | 'ig-session-expired';

export class FatalRunError extends Error {
  constructor(readonly code: FatalCode, message: string);
}

export interface BinaryProbe {
  isAvailable(binary: string): Promise<boolean>;
}

export async function assertPreconditions(
  env: { IG_SESSIONID?: string; OPENROUTER_API_KEY?: string },
  probe: BinaryProbe,
): Promise<void>;
```

- **Depends on:** nothing. `BinaryProbe` is injected so the check is testable
  without ffmpeg installed. Satisfies 7.1, 7.2.

### `lib/instagram`

- **Responsibility:** every interaction with Instagram, and the only place that
  understands `insta-fetcher`'s raw `api/v1` payloads.
- **Interface:**

```ts
export interface DiscoveredReel {
  shortcode: string;
  mediaId: string;
  views: number;
  likes: number;
  comments: number;
  thumbnailUrl: string;
  takenAt: string;         // ISO 8601
}

export interface HydratedReel {
  caption: string;
  videoUrl: string;
  durationSeconds: number;
}

export interface InstagramClient {
  /** Returns reels most-recent-first. */
  discoverReels(account: string, scan: number): Promise<DiscoveredReel[]>;
  hydrateReel(mediaId: string): Promise<HydratedReel>;
  downloadVideo(videoUrl: string, destPath: string): Promise<void>;
}

export function createInstagramClient(opts: {
  sessionId: string;
  retry?: { attempts: number; baseDelayMs: number };
}): InstagramClient;
```

- **Depends on:** `insta-fetcher@1.4.0`, pinned exact.
- **Notes:** an HTTP 403 becomes `FatalRunError('ig-session-expired')` (7.3); an
  empty or unreachable account becomes `FatalRunError('account-not-found')` (1.5);
  other transient failures are retried with exponential backoff before surfacing
  (6.4). The retry policy lives here rather than in the steps, because
  `insta-fetcher` ships none of its own.

### `lib/ranking`

- **Responsibility:** decide which reels are worth processing. Pure.
- **Interface:**

```ts
export function rankReels<T extends { views: number }>(
  reels: readonly T[],
  top: number,
): Array<T & { rank: number }>;
```

- **Depends on:** nothing.
- **Notes:** sorts by `views` descending using a **stable** sort, so reels tied on
  views keep the most-recent-first order they arrived in (1.3). Takes the first
  `top`, or all of them when fewer exist (1.4), and assigns `rank` from 1 (1.6).

### `lib/media`

- **Responsibility:** turn a downloaded video into a transcribable audio file.
- **Interface:**

```ts
export interface AudioExtractor {
  extractAudio(videoPath: string, destPath: string): Promise<{ path: string; sizeBytes: number }>;
}

export function createFfmpegExtractor(ffmpegBin?: string): AudioExtractor;
```

- **Depends on:** the `ffmpeg` binary via `child_process`.
- **Notes:** produces mono 16 kHz MP3 (2.3). Returns `sizeBytes` so the caller can
  enforce the 25 MB transcription limit without re-reading the file (2.6).

### `lib/openrouter`

- **Responsibility:** both LLM-facing calls — transcription and schema-constrained
  completion.
- **Interface:**

```ts
export interface TranscriptionClient {
  /** Rejects with AudioTooLargeError above maxBytes, before any request. */
  transcribe(audioPath: string, sizeBytes: number): Promise<string>;
}

export interface CompletionClient {
  complete<T>(args: {
    model: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
}

export function createOpenRouterClients(opts: {
  apiKey: string;
  maxAudioBytes?: number;   // default 25 * 1024 * 1024
}): { transcription: TranscriptionClient; completion: CompletionClient };
```

- **Depends on:** OpenRouter's `POST /api/v1/audio/transcriptions` (base64 audio,
  `format: 'mp3'`) for transcription, and the AI SDK's OpenRouter provider with
  schema-constrained generation for completion.
- **Notes:** `complete` retries **once** on a schema-validation failure and then
  gives up (3.3, 3.4, 4.4). The retry lives here so both LLM steps get it without
  repeating the logic.

### `lib/profiles`

- **Responsibility:** load the hand-written actor profiles.
- **Interface:**

```ts
export interface ActorProfile { name: string; markdown: string; }

export function listActors(dir: string): Promise<string[]>;
export function loadActorProfile(dir: string, name: string): Promise<ActorProfile>;
```

- **Depends on:** the filesystem.
- **Notes:** the profile is kept as **raw markdown** and handed to the prompt
  as-is. `listActors` backs the UI's actor selector (5.2); `loadActorProfile`
  throws `FatalRunError('unknown-actor')` for a missing profile (4.5).

### `lib/prompts`

- **Responsibility:** assemble the two LLM prompts. Pure.
- **Interface:**

```ts
export function buildAnalysisPrompt(input: { transcript: string; caption: string }): string;
export function buildScriptPrompt(input: { analysis: ReelAnalysis; profile: ActorProfile }): string;
```

- **Depends on:** nothing.
- **Notes:** `buildAnalysisPrompt` includes both transcript and caption (3.1).
  `buildScriptPrompt` embeds the actor's profile verbatim (4.2) and instructs
  Spanish output regardless of the source reel's language (4.6). Being pure makes
  "does the actor's profile actually reach the prompt?" a one-line assertion.

### `mastra/workflows`

- **Responsibility:** orchestration and nothing else.
- **Interface:**

```ts
export const processReelWorkflow;      // ReelInput -> ReelOutcome, never throws for isolated failures
export const generateScriptsWorkflow;  // RunInput  -> RunResult
```

- **Depends on:** every adapter above, injected through the Mastra instance's
  dependency container rather than imported inside the steps.

### `app/api/runs`

- **Responsibility:** start runs and expose their state.
- **Interface:**

```
POST /api/runs          { account, actor, top }  ->  201 { runId }
GET  /api/runs/:runId                            ->  200 RunView | 404 { error: 'run not found' }
```

- **Notes:** `POST` starts the run and returns immediately without awaiting it
  (5.1). `GET` reads the run snapshot Mastra persists in its LibSQL store and maps
  it to `RunView` (5.3, 5.4, 5.6); an unknown id is a 404 (5.7). The mapping
  snapshot → `RunView` is a pure function, tested on its own.

## Data models

```ts
// ---- run input / output -------------------------------------------------

export interface RunInput {
  account: string;
  actor: string;
  scan: number;   // default 20
  top: number;    // default 3
}

export interface ReelMetrics {
  views: number;
  likes: number;
  comments: number;
}

// ---- LLM outputs (the schemas the responses are validated against) ------

export const reelAnalysisSchema = z.object({
  objective: z.string().min(1),
  highlights: z.array(z.string().min(1)).min(1),
  targetAudience: z.string().min(1),
});
export type ReelAnalysis = z.infer<typeof reelAnalysisSchema>;

export const reelScriptSchema = z.object({
  hook: z.string().min(1),
  body: z.string().min(1),
  closing: z.string().min(1),
});
export type ReelScript = z.infer<typeof reelScriptSchema>;

// ---- per-reel outcome: failures are values, not exceptions --------------

export type PipelineStep =
  | 'hydrate' | 'download' | 'extract-audio'
  | 'transcribe' | 'analyze' | 'generate-script';

export interface ReelBase {
  rank: number;
  shortcode: string;
  thumbnailUrl: string;
  metrics: ReelMetrics;
}

export type ReelOutcome =
  | (ReelBase & { status: 'ok'; analysis: ReelAnalysis; script: ReelScript })
  | (ReelBase & { status: 'failed'; failedStep: PipelineStep; reason: string });

export interface RunResult {
  account: string;
  actor: string;
  generatedAt: string;   // ISO 8601
  reels: ReelOutcome[];  // ordered by rank
}

// ---- what the UI reads --------------------------------------------------

export type ReelView =
  | (ReelBase & { status: 'pending'; currentStep: PipelineStep })
  | ReelOutcome;

export interface RunView {
  runId: string;
  account: string;
  actor: string;
  status: 'running' | 'completed' | 'aborted';
  error?: { code: FatalCode; message: string };  // set only when aborted
  reels: ReelView[];
}
```

Invariants: `reels` is always ordered by ascending `rank`; a `failed` reel always
carries both `failedStep` and a human-readable `reason` (6.1); `error` is present
if and only if `status` is `aborted`.

## Data flow

### Scenario A — happy path

1. The user submits `{ account: "morningbrew", actor: "juanse", top: 3 }`. The
   route handler starts the workflow and returns `{ runId }` without awaiting it
   (5.1). The page begins polling `GET /api/runs/:runId` every ~2 s.
2. **preflight** verifies `IG_SESSIONID`, `OPENROUTER_API_KEY` and `ffmpeg`, then
   loads `profiles/juanse.md`. Nothing has been downloaded yet (7.1, 4.5).
3. **discover** calls `discoverReels("morningbrew", 20)` and gets 20 reels
   most-recent-first with views, likes and comments (1.1).
4. **rank** stable-sorts by views descending, keeps the first 3, and stamps
   `rank: 1..3` (1.2, 1.3, 1.6).
5. **foreach**, three at a time (6.3), each reel runs `processReelWorkflow`:
   hydrate gets caption/videoUrl/duration (2.1); the video is downloaded (2.2);
   ffmpeg produces mono 16 kHz MP3 (2.3); the audio is transcribed (2.4); the
   transcript **and caption** are analyzed into objective/highlights/audience,
   validated against `reelAnalysisSchema` (3.1, 3.2); the analysis plus the actor
   profile produce a Spanish hook/body/closing validated against
   `reelScriptSchema` (4.1–4.3, 4.6); the temp video and audio are deleted (2.5).
6. **assemble** emits `RunResult` ordered by rank. The next poll sees
   `status: 'completed'` and renders rank, metrics, analysis and a copyable script
   per reel (5.4, 5.5).

### Scenario B — one reel fails, the run does not

Same as above until step 5. The rank-2 reel's `videoUrl` returns 404. The
`downloadVideo` step catches it and returns
`{ status: 'failed', failedStep: 'download', reason: 'video not available (404)' }`.
Every later step in that sub-workflow sees a `failed` input and passes it through
without doing work. Ranks 1 and 3 finish normally. `assemble` emits all three
outcomes; the page shows two scripts and, for rank 2, its failure reason where the
script would have been (6.1, 6.2, 5.6).

### Scenario C — expired cookie

At step 3, `discoverReels` gets HTTP 403. The adapter raises
`FatalRunError('ig-session-expired')`, which is **not** converted to a reel
failure — it propagates, the run ends as `aborted`, and the page shows "the
Instagram session cookie expired and must be rotated" (7.3).

## Error handling

| Condition | Handling | Related requirement |
|---|---|---|
| `IG_SESSIONID` or `OPENROUTER_API_KEY` unset | `FatalRunError` in preflight, before any download | 7.1, 7.2 |
| `ffmpeg` not on PATH | `FatalRunError('ffmpeg-unavailable')` in preflight | 7.1, 7.2 |
| Requested actor has no profile | `FatalRunError('unknown-actor')` in preflight | 4.5 |
| Instagram returns HTTP 403 | `FatalRunError('ig-session-expired')`, run aborted with a rotate-the-cookie message | 7.3 |
| Account missing / unreachable / no reels | `FatalRunError('account-not-found')`, run aborted | 1.5 |
| Account has fewer reels than `top` | Not an error — proceed with all available | 1.4 |
| Transient Instagram failure (5xx, network) | Retried with exponential backoff inside the adapter; only a final failure surfaces | 6.4 |
| Video URL 404 / download fails | Reel `failed` at `download`, run continues | 6.1, 6.2 |
| ffmpeg fails on a corrupt mp4 | Reel `failed` at `extract-audio`, run continues | 6.1, 6.2 |
| Extracted audio > 25 MB | Reel `failed` at `extract-audio`, reason "audio too large", no request sent | 2.6 |
| Transcription times out (60 s provider limit) | Reel `failed` at `transcribe`, run continues | 6.1, 6.2 |
| Analysis response fails schema validation | Retried once; second failure → reel `failed` at `analyze`, reason "invalid analysis response" | 3.2, 3.3, 3.4 |
| Script response fails schema validation | Retried once; second failure → reel `failed` at `generate-script`, reason "invalid script response" | 4.3, 4.4 |
| Unknown `runId` requested | 404 `{ error: 'run not found' }` | 5.7 |

## Testing strategy

The unit and workflow suites must run **without network access and without API
keys** — every adapter is injected, so no test reaches Instagram or OpenRouter.

**Unit**

- `rankReels` — descending order by views; stable tie-break preserving arrival
  order (1.3); fewer reels than `top` (1.4); `rank` starting at 1 (1.6); empty
  input.
- `lib/instagram` — mapping the real `api/v1` payload shape into `DiscoveredReel`
  and `HydratedReel`, using fixtures captured from the benchmark; 403 → `FatalRunError`;
  empty listing → `account-not-found`; backoff retries a transient failure and
  gives up after the configured attempts.
- `lib/prompts` — `buildScriptPrompt` contains the actor profile's text verbatim
  (4.2) and the Spanish instruction (4.6); `buildAnalysisPrompt` contains both
  transcript and caption (3.1).
- `lib/openrouter` — `transcribe` refuses an oversized file before issuing a
  request (2.6); `complete` retries exactly once on a schema failure and then
  throws (3.3, 3.4, 4.4).
- `lib/preflight` — each missing precondition produces its own `FatalCode` (7.2).
- `lib/profiles` — `listActors` reflects the directory (5.2); a missing profile
  throws `unknown-actor` (4.5).
- Snapshot → `RunView` mapping — pending reels expose `currentStep` (5.3), failed
  reels expose their reason (5.6).

**Edge cases**

- A reel that fails at each of the six pipeline steps, verifying every later step
  passes the failure through untouched.
- A run where *every* reel fails: the run still completes rather than aborting
  (6.2).
- A `FatalRunError` raised mid-`foreach` aborts the run rather than becoming a
  reel failure.

**Workflow (Vitest, fake adapters)**

- `processReelWorkflow` runs its steps in order and produces `status: 'ok'`.
- `generateScriptsWorkflow` never processes more than 3 reels at once (6.3) and
  delivers the successful reels when one fails (6.1, 6.2).

**End to end (Playwright)**

Run at the end through the `/verify-implementation` loop: one happy path and two
failure paths against the real app.

## Design decisions and trade-offs

- **Decision:** inside the per-reel pipeline, failures are returned as values
  (`ReelOutcome`), not thrown — **Rationale:** requirement 6.1 must hold no matter
  how the workflow engine treats an exception thrown inside a parallel branch;
  returning a value also makes each step testable with plain assertions —
  **Alternative considered:** throwing and catching per branch, rejected because it
  couples the isolation guarantee to Mastra's internal semantics.
- **Decision:** `FatalRunError` is the single exception type allowed to escape a
  step — **Rationale:** gives one unambiguous rule for "abort the run" vs "fail this
  reel", instead of scattering that judgement across steps — **Alternative
  considered:** a per-step error policy, rejected as harder to reason about and to
  test.
- **Decision:** ranking is a pure function separate from the Instagram adapter —
  **Rationale:** it is the piece of logic most likely to be wrong and the cheapest
  to test in isolation — **Alternative considered:** ranking inside the adapter,
  rejected because it would force a network fixture into every ranking test.
- **Decision:** the actor profile stays raw markdown and is injected verbatim —
  **Rationale:** the people editing it are not engineers, and a parsed schema would
  make them fight a format instead of describing how they talk — **Alternative
  considered:** structured YAML frontmatter, rejected as premature for one slice.
- **Decision:** the UI polls a status endpoint instead of streaming —
  **Rationale:** a run takes minutes, and polling a persisted snapshot survives a
  page reload for free; streaming would need reconnection handling for no gain at
  this size — **Alternative considered:** SSE over Mastra's run stream, deferred.
- **Decision:** a run's state lives only in Mastra's own store; nothing is written
  to disk — **Rationale:** it is the smallest thing that satisfies 5.3–5.6, and
  durable artifacts are explicitly out of scope — **Trade-off:** clearing the store
  loses past runs.
- **Decision:** `insta-fetcher` pinned to exactly `1.4.0`, with retry and
  concurrency limits implemented on our side — **Rationale:** the library is small,
  infrequently maintained and ships no rate limiting; an automatic minor bump is a
  realistic way to break ingestion silently — **Alternative considered:** a caret
  range, rejected for that reason.
- **Decision:** the app is assumed to run as a long-lived Node process
  (`next dev` / `next start`) — **Rationale:** `POST /api/runs` returns before the
  workflow finishes, which requires the process to outlive the request; a
  serverless deployment would cut the run short — **Consequence:** if this is ever
  deployed serverless, the run must move to a worker.
