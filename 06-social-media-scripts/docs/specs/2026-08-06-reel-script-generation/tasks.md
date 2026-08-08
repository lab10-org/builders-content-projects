# Tasks — Reel Script Generation

**Status:** Draft
**Date:** 2026-08-06
**Requirements:** ./requirements.md
**Design:** ./design.md

## Purpose

This document breaks the approved design into an ordered list of implementation
tasks and doubles as the execution log. Each task traces back to the design and
requirements, and records the decisions made while implementing it — so this
file becomes the durable record of *why* the code ended up the way it did, not
just *what* was built.

## How to use this document

- Work **one task at a time, top to bottom**. Don't start a task until its
  dependencies are `Done`.
- Follow **TDD**: write the failing test, implement until it passes, then verify.
- As you execute a task, append to its **Decision log** — every non-obvious
  choice, discovery, or deviation from the design. This is the point of the
  file: a future reader should understand the reasoning without re-reading the
  diff.
- When the design turns out to be wrong or incomplete, update `design.md` (and
  `requirements.md` if needed) and note it in the task's Decision log.

## Status legend

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Pending — not started |
| `[~]`  | In progress |
| `[x]`  | Done — tests pass, verified |
| `[!]`  | Blocked — see Decision log |

## Task overview

- [x] **T1** — Scaffold the Next.js + TypeScript + Vitest project
- [x] **T2** — Data models and LLM response schemas
- [x] **T3** — `lib/preflight`: `FatalRunError` and `assertPreconditions`
- [x] **T4** — `lib/ranking`: `rankReels`
- [x] **T5** — `lib/instagram`: `discoverReels`
- [x] **T6** — `lib/instagram`: `hydrateReel` and `downloadVideo`
- [x] **T7** — `lib/instagram`: request policy (403 fatal, backoff retries)
- [x] **T8** — `lib/media`: ffmpeg audio extractor
- [x] **T9** — `lib/openrouter`: transcription client and `models.ts`
- [x] **T10** — `lib/openrouter`: schema-constrained completion with one retry
- [x] **T11** — `lib/prompts`: analysis and script prompt builders
- [x] **T12** — `lib/profiles`: actor profiles and the `profiles/` directory
- [x] **T13** — Mastra instance, run dependencies and the per-reel failure helper
- [x] **T14** — Reel steps: `hydrate` and `download`
- [x] **T15** — Reel steps: `extract-audio` (25 MB guard) and `transcribe`
- [x] **T16** — Reel step: `analyze`
- [x] **T17** — Reel step: `generate-script`
- [x] **T18** — Reel step: `cleanup`
- [x] **T19** — `processReelWorkflow` composition
- [x] **T20** — Run step: `preflight` (preconditions + actor profile)
- [x] **T21** — Run steps: `discover` and `rank`
- [x] **T22** — `generateScriptsWorkflow` and `assemble`
- [x] **T23** — Cap the per-run concurrency at 3 reels
- [x] **T24a** — Record each reel's current pipeline step
- [x] **T24b** — Map a run snapshot to `RunView`
- [x] **T25** — `POST /api/runs`
- [x] **T26** — `GET /api/runs/[runId]`
- [x] **T27** — Page: start-a-run form with the actor selector
- [x] **T28** — Page: poll the run and show each reel's current step
- [x] **T29** — Page: render the finished reels
- [x] **T30** — Page: copy a script in one action
- [x] **T31** — README: run the app and rotate the Instagram cookie safely

## Requirements coverage

| Requirement criterion | Task(s) |
|-----------------------|---------|
| 1.1 | T5, T21 |
| 1.2 | T4, T21 |
| 1.3 | T4, T21 |
| 1.4 | T4, T21 |
| 1.5 | T5, T21, T22, T24b, T28 |
| 1.6 | T4, T21 |
| 2.1 | T6, T14 |
| 2.2 | T6, T14 |
| 2.3 | T8, T15 |
| 2.4 | T9, T15 |
| 2.5 | T18, T19 |
| 2.6 | T9, T15 |
| 3.1 | T11, T16 |
| 3.2 | T2, T10 |
| 3.3 | T10 |
| 3.4 | T10, T16 |
| 4.1 | T2, T17 |
| 4.2 | T11, T17, T22 |
| 4.3 | T2, T10 |
| 4.4 | T10, T17 |
| 4.5 | T12, T20, T22, T24b, T28 |
| 4.6 | T11, T17 |
| 5.1 | T25, T27 |
| 5.2 | T12, T27 |
| 5.3 | T24a, T24b, T26, T28 |
| 5.4 | T22, T24b, T26, T29 |
| 5.5 | T30 |
| 5.6 | T24b, T26, T29 |
| 5.7 | T26 |
| 6.1 | T13, T14, T15, T16, T17, T19, T22 |
| 6.2 | T22 |
| 6.3 | T23 |
| 6.4 | T7 |
| 7.1 | T3, T20 |
| 7.2 | T3, T20, T22, T24b, T28 |
| 7.3 | T7, T19, T22, T24b, T28 |
| 7.4 | T31 |

---

## Tasks

### T1 — Scaffold the Next.js + TypeScript + Vitest project

- **Status:** `[x]` Done
- **Traces to:** Design → Architecture / directory layout (no acceptance
  criterion directly; foundation for every other task — this folder currently
  holds only `CLAUDE.md`, `docs/`, `.claude/` and the `.agents` symlink, with no
  `package.json`, no `.gitignore`, no source and no tests)
- **Depends on:** none

**Objective:** A runnable Next.js (App Router) + TypeScript project exists in
this folder, with `npm test` running Vitest and `npm run typecheck` running
`tsc --noEmit`, so every later task can follow red→green→verify.

**TDD plan:**

1. **Test (red):** Vitest has to exist before anything can fail, so bring the
   runner up first and then write a test that fails on the scaffold's own
   contract. Write the files by hand and install with plain `npm install` — do
   **not** use `create-next-app`: it is interactive, refuses a non-empty
   directory (this one already holds `CLAUDE.md`, `docs/`, `.claude/`) and pulls
   in ESLint/Tailwind that no requirement asks for.
   - Minimal `package.json` — `name`, `version`, `"private": true`; devDeps
     `typescript`, `vitest`, `@types/node`; scripts `dev: next dev`,
     `typecheck: tsc --noEmit`, `test: vitest run`. Run `npm install`.
   - `scaffold.test.ts` at the project root (Vitest's default include glob picks
     up root-level suites — T31's `readme.test.ts` relies on the same thing),
     reading the files with `fs` and asserting the contract the rest of the plan
     depends on:
     - `package.json` is `private`, its `scripts.typecheck` is exactly
       `tsc --noEmit` and its `scripts.test` is exactly `vitest run` (the two
       commands every task verifies with), and it lists `next`, `react` and
       `react-dom` as dependencies;
     - `tsconfig.json` has `compilerOptions.strict === true` and
       `noEmit === true`, and its `include` covers `src/**`, `app/**` and
       root-level `*.test.ts`, so test files are type-checked too;
     - the project-local `.gitignore` ignores `node_modules`, `.next`,
       `.mastra`, `.env*.local`, `next-env.d.ts` and `tmp/`, and does **not**
       ignore `profiles/` — T12 commits a real actor profile there, and the git
       root is the parent folder whose `.gitignore` only covers Python
       artifacts, so a project-local file is the only thing standing between
       `.mastra/` and the repo;
     - `.env.local.example` names `IG_SESSIONID` and `OPENROUTER_API_KEY` (the
       two preconditions T3 asserts) with empty placeholder values.
     Assert **presence**, never exhaustiveness, so T2/T5/T9/T13/T27 can add
     dependencies without touching this test. Keep `package.json` and
     `tsconfig.json` comment-free so `JSON.parse` reads them.
     Run `npm test`: Vitest executes and the assertions fail — proving the runner
     discovers tests before anything else exists.
2. **Implement (green):** Complete the scaffold until that contract holds.
   - `package.json` — add deps `next`, `react`, `react-dom` and devDeps
     `@types/react`, `@types/react-dom`. Take the versions from the sibling
     project in this repo (`../01-mis-finanzas/package.json`: Next 15 / React 19
     / Vitest 2, no `"type": "module"`) rather than inventing them. Feature
     dependencies arrive with the task that needs them (`zod` in T2,
     `insta-fetcher` in T5, the AI SDK in T9/T10, `@mastra/*` in T13, `jsdom` +
     `@testing-library/react` in T27), per the project rule "no dependencies
     without need"; `@playwright/test` and a `test:e2e` script are deliberately
     **not** added here — the `/verify-implementation` loop introduces them once
     every task is `Done`.
   - `tsconfig.json` — `strict: true`, `noEmit: true`, `jsx: "preserve"`,
     `module: "esnext"` + `moduleResolution: "bundler"`, `skipLibCheck: true`,
     `esModuleInterop`, `resolveJsonModule` (the Instagram fixtures in T5/T6 are
     JSON), `isolatedModules`, `target: "ES2022"`,
     `lib: ["ES2022", "DOM", "DOM.Iterable"]`, and an `include` of
     `next-env.d.ts`, `*.test.ts`, `src/**` and `app/**`.
   - `vitest.config.ts` — `test.environment: "node"` (T27 opts its UI files into
     jsdom with a per-file `// @vitest-environment jsdom` docblock, as the
     sibling project does), `esbuild: { jsx: "automatic" }` (esbuild cannot run
     the `jsx: "preserve"` Next needs, so T27's `.tsx` tests would otherwise
     fail to transform), and `test.exclude` extended with `e2e/**` (the
     verification loop writes Playwright specs there and Vitest must not try to
     run them).
   - The `.gitignore`, `.env.local.example` and an empty `.env.local` the test
     describes.
   - `next-env.d.ts` written by hand — `/// <reference types="next" />` and
     `/// <reference types="next/image-types/global" />` — so `tsc` sees Next's
     ambient types without booting a dev server mid-cycle. It stays git-ignored
     and Next rewrites it on first `next dev`.
   - Minimal `app/layout.tsx` (it must render `<html>` and `<body>` around
     `children`, or Next throws at runtime) and an `app/page.tsx` placeholder,
     which T27 replaces with the real form.
3. **Verify:** `npm run typecheck` && `npm test` both clean. If `tsc --noEmit`
   still complains about missing Next ambient types, run `npx next dev` once to
   let Next regenerate `next-env.d.ts` rather than loosening `strict`. Run
   `npm run dev` once and load `/` to confirm the app boots.

**Decision log:**

- Versions taken from `../01-mis-finanzas/package.json` as planned: Next ^15.1.0, React ^19.0.0, Vitest ^2.1.0, TypeScript ^5.7.0. No `create-next-app` (interactive, refuses a non-empty directory).
- `npm audit` reports 8 vulnerabilities (1 critical) — all transitive dev/build deps of the pinned Next 15.1 and Vitest 2.1: `@vitest/mocker` (only reachable with the Vitest UI server, which we never start), `postcss`/`sharp` via next, `vite` via vitest. None affect the production runtime. Deferred deliberately: the sibling project pins the same versions and both should move together.
- Added `build`/`start` scripts beyond the plan's list so `next build` is available without editing package.json later.

**Outcome:** Scaffold in place. `npm test` 14/14 and `npm run typecheck` clean; `next dev` served `/` with HTTP 200. Red was 12 failed / 2 passed — the 2 passing were the `private`+scripts assertions the minimal package.json already satisfied.

### T2 — Data models and LLM response schemas

- **Status:** `[x]` Done
- **Traces to:** 3.2, 4.1, 4.3 → Design → Data models
- **Depends on:** T1

**Objective:** `src/lib/types.ts` exports the shared data model (`RunInput`,
`ReelMetrics`, `ReelBase`, `PipelineStep`, `ReelOutcome`, `RunResult`,
`ReelView`, `RunView`, `FatalCode`) together with `reelAnalysisSchema`,
`reelScriptSchema` and their inferred `ReelAnalysis` and `ReelScript` types, so
every later module validates LLM output against one shared definition of
"conforms to the schema".

**TDD plan:**

1. **Test (red):** `src/lib/types.test.ts` —
   - `reelAnalysisSchema` accepts
     `{ objective: 'x', highlights: ['a'], targetAudience: 'y' }`; rejects a
     missing `targetAudience`, an empty-string `objective`, an empty
     `highlights` array, and a `highlights` entry that is an empty string
     (3.2's "does not conform" cases).
   - `reelScriptSchema` accepts `{ hook, body, closing }` all non-empty; rejects
     a missing `hook` and an empty-string `closing` (4.1's three parts, 4.3).
   - Type-level assertions, enforced by `npm run typecheck` and **not** by the
     runtime suite (Vitest transpiles without type-checking): a `failed`
     `ReelOutcome` literal without `failedStep` is a `@ts-expect-error`, an `ok`
     literal without `script` likewise, and an `ok` outcome carrying both
     `analysis` and `script` compiles clean. These are real assertions because
     `tsc` reports an *unused* `@ts-expect-error` (TS2578) the moment the union
     stops rejecting them.
   Before `src/lib/types.ts` exists the test file cannot resolve the module, so
   `npm test` fails — that is the red.
2. **Implement (green):** Add `zod` as a dependency — pin the major and record
   it in the Decision log, because `ai` + `@openrouter/ai-sdk-provider` (T10)
   and `@mastra/core` (T13) must accept that same zod major; a conflict is
   cheaper to find here than three tasks later. Write `src/lib/types.ts` with
   the design's data-model block verbatim, plus the `FatalCode` union. Two
   placement choices to record in the Decision log:
   - the design's directory layout names no module for the data models; they go
     in `src/lib/types.ts`, next to `src/lib/models.ts` (model IDs, T9);
   - the design publishes `FatalCode` from `lib/preflight`, but `RunView.error`
     needs it here and `types.ts` must stay a leaf module with no imports. So
     `FatalCode` is **defined** here, and `lib/preflight` (T3) imports it as a
     type and re-exports it — the design's published interface
     (`import { FatalCode, FatalRunError } from '.../preflight'`) still holds,
     with no runtime cycle, and no task ends up depending on a later one.
3. **Verify:** `npm run typecheck` && `npm test` — typecheck is the step that
   actually enforces the `@ts-expect-error` assertions.

**Decision log:**

- zod pinned to major 3 (installed 3.25.76). v3 is what `ai` + `@openrouter/ai-sdk-provider` (T10) and `@mastra/core` (T13) accept; picking v4 here would surface as a peer conflict three tasks later.
- Data models live in `src/lib/types.ts` — the design's directory layout names no module for them, and this sits next to `src/lib/models.ts` (T9).
- `FatalCode` is DEFINED here, not in `lib/preflight`: `RunView.error.code` needs it and `types.ts` must stay a leaf module with no imports. T3 imports it as a type and re-exports it, so the design's published interface still holds with no runtime cycle.

**Outcome:** `src/lib/types.ts` exports the full data model plus `reelAnalysisSchema`/`reelScriptSchema`. `npm test` 23/23, `npm run typecheck` clean — typecheck is what actually enforces the three `@ts-expect-error` assertions (an unused one is TS2578).

### T3 — `lib/preflight`: `FatalRunError` and `assertPreconditions`

- **Status:** `[x]` Done
- **Traces to:** 7.1, 7.2 → Design → `lib/preflight`
- **Depends on:** T1, T2

**Objective:** `src/lib/preflight/index.ts` re-exports `FatalCode` (defined in
`src/lib/types.ts`, T2, so `RunView.error.code` can reference it while
`types.ts` stays a leaf module with no imports) and exports `FatalRunError` and
`assertPreconditions(env, probe)`, which rejects naming the single unmet
precondition — the one error type allowed to abort a run, and the shared
vocabulary every later fatal code reuses (T5, T7, T12, T24b).

**TDD plan:**

1. **Test (red):** `src/lib/preflight/preflight.test.ts` —
   - with `IG_SESSIONID` and `OPENROUTER_API_KEY` set and a `BinaryProbe` that
     reports availability, it resolves, and the probe was consulted with exactly
     `'ffmpeg'` — 7.1 names that binary, so assert the argument, not just the
     call;
   - a missing, empty or whitespace-only `IG_SESSIONID` rejects with a
     `FatalRunError` whose `code` is `'missing-ig-session'` and whose message
     names the variable (7.2 — "report which one is unmet");
   - the same three shapes of `OPENROUTER_API_KEY` reject with
     `'missing-openrouter-key'` naming that variable;
   - `probe.isAvailable('ffmpeg')` returning `false` rejects with
     `'ffmpeg-unavailable'` and the message says ffmpeg must be on PATH;
   - when both env vars are missing, the error names the Instagram cookie (the
     first check) and the probe was never consulted — the check is ordered and
     cheap-first, and exactly one unmet precondition is reported;
   - `FatalRunError` is an `instanceof Error`, keeps `code` readable after a
     `throw`/`catch` round trip, and its `name` is `'FatalRunError'` so the
     later `instanceof` checks (T13, T19, T22) are not the only way to tell it
     apart;
   - the shipped default probe:
     `createBinaryProbe().isAvailable('definitely-not-a-binary-xyz')` resolves
     `false` and does **not** reject — spawning a missing binary emits an
     `error` event (`ENOENT`) rather than a non-zero exit, so this is the one
     assertion that exercises the real `child_process` path, and it needs
     nothing installed. No test asserts that ffmpeg *is* present, so the suite
     stays green on a machine without it.
2. **Implement (green):** Import `FatalCode` as a **type** from
   `src/lib/types.ts` (T2 defines the six-member union there; this module
   re-exports it so the design's published interface —
   `import { FatalCode, FatalRunError } from '.../preflight'` — still holds,
   with no runtime cycle and no task depending on a later one; record this
   placement choice in the Decision log instead of declaring a second copy of
   the union here): `missing-ig-session`, `missing-openrouter-key`,
   `ffmpeg-unavailable`, `unknown-actor`, `account-not-found`,
   `ig-session-expired` — all six, even though only the first three are raised
   here: `account-not-found` (T5), `ig-session-expired` (T7) and
   `unknown-actor` (T12) raise the rest, and `RunView.error.code` is typed by
   this same union. Then implement the error class and `assertPreconditions`,
   checking the two env vars first (cheapest, no process spawn) and the probe
   last. Ship a default `createBinaryProbe()` over
   `child_process` whose `isAvailable` handles the spawn `error` event as
   `false`; `createBinaryProbe` is not in the design's published interface —
   record that addition in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Re-exports `FatalCode` from `../types` as a type instead of declaring a second copy — see T2's log for why the union lives there.
- `createBinaryProbe()` added beyond the design's published interface, so `assertPreconditions` has a real probe in production while staying injectable in tests. Its `isAvailable` translates the spawn `error` event (ENOENT) to `false` rather than rejecting — a missing binary never exits non-zero.
- Checks are ordered cheapest-first (two env reads, then the process spawn); the test asserts the probe is never consulted when an env var is already missing, so exactly one unmet precondition is reported (7.2).

**Outcome:** `src/lib/preflight/index.ts` exports `FatalRunError`, `assertPreconditions` and `createBinaryProbe`, and re-exports `FatalCode`. `npm test` 34/34, `npm run typecheck` clean.

### T4 — `lib/ranking`: `rankReels`

- **Status:** `[x]` Done
- **Traces to:** 1.2, 1.3, 1.4, 1.6 → Design → `lib/ranking`
- **Depends on:** T1

**Objective:** `rankReels<T extends { views: number }>(reels, top)` selects the
highest-viewed reels, preserving arrival order on ties, stamping `rank` from 1
and carrying every other field of each input reel through untouched — the pure
function the whole selection rests on.

**TDD plan:**

1. **Test (red):** Replace T1's stub assertion in
   `src/lib/ranking/rank-reels.test.ts`. Fixtures are plain objects carrying
   `views` plus a `shortcode` and a `thumbnailUrl`, so the generic contract is
   observable without depending on T2's types —
   - five reels with distinct view counts and `top: 3` returns exactly three,
     ordered by `views` descending, with `rank` 1, 2, 3 (1.2, 1.6);
   - each returned entry keeps its input's other fields unchanged (`shortcode`,
     `thumbnailUrl`) next to the new `rank`, so T21 can build `ReelBase` from the
     result (1.6);
   - three reels tied on `views`, arriving most-recent-first and bracketed by one
     higher-viewed and one lower-viewed reel, come back in that same relative
     order — assert all five shortcodes by position, which a
     sort-ascending-then-`reverse()` implementation would fail (1.3);
   - two reels with `top: 5` returns both, ranked 1 and 2, without throwing
     (1.4);
   - an empty input returns `[]`, and `top: 0` returns `[]`;
   - the input array is not mutated and the result is a new array (compare a
     snapshot of the original order, and assert the returned array is not the
     input reference).
2. **Implement (green):** Copy the array before sorting (`Array#sort` is stable
   per ES2019, which is what gives 1.3), sort by `views` descending, `slice(0,
   top)`, then `map` in the `rank` with a spread so the input objects are never
   touched.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- The plan said to replace a T1 stub at `src/lib/ranking/rank-reels.test.ts`, but T1's own plan only creates a root-level `scaffold.test.ts` — no stub existed, so the file was created fresh. No behaviour change.
- My first tie-break fixture assertion was wrong (expected `d`=20 third when `c`=30 outranks it); the implementation was right and the test was corrected. Worth noting because it is exactly the kind of ordering slip the 1.3 test exists to catch.

**Outcome:** `rankReels` in `src/lib/ranking/index.ts`; 7 tests green, suite 41/41, typecheck clean.

### T5 — `lib/instagram`: `discoverReels`

- **Status:** `[x]` Done
- **Traces to:** 1.1, 1.5 → Design → `lib/instagram`
- **Depends on:** T3

**Objective:** `createInstagramClient(...).discoverReels(account, scan)` turns
`insta-fetcher`'s clips listing into `DiscoveredReel[]` — most-recent-first, at
most `scan` entries, carrying view, like and comment counts and a thumbnail —
and raises `FatalRunError('account-not-found')` when the account yields no reels.

**TDD plan:**

1. **Test (red):** `src/lib/instagram/instagram.test.ts`, with a fake `igApi`
   injected through a test seam on the factory: `createInstagramClient(opts, deps?)`
   with `deps = { api?, sleep? }`. T5 only uses `api`; T7 fills in `sleep`, so the
   signature is fixed once. Log this deviation from the design's published
   one-argument factory. Fixture
   `src/lib/instagram/__fixtures__/clips-listing.json`, hand-written from
   `insta-fetcher@1.4.0`'s own types
   (`dist/types/UserReel.d.ts` → `ProfileReel.xdt_api__v1__clips__user__connection_v2.edges[].node.media`,
   whose `media` is the `Media` interface in `dist/types/PostFeedResult.d.ts`) and
   from the fields `docs/research/ig-tools-bench/e2e.mjs` reads: `code`, `pk`,
   `like_count`, `comment_count`, `play_count`, `taken_at` and
   `image_versions2.candidates[0].url` (the benchmark archived only derived
   fields, so the raw payload has to be reconstructed).
   - a three-edge fixture maps to three `DiscoveredReel` with `shortcode` ←
     `code`, `mediaId` ← `pk`, `views` ← `play_count` (**not** `view_count`,
     which this payload returns `null`), `likes` ← `like_count`, `comments` ←
     `comment_count`, `thumbnailUrl` ← `image_versions2.candidates[0].url` (1.1);
   - the output order equals the listing order and the mapper never sorts — this
     is the most-recent-first contract `rankReels` relies on for its stable
     tie-break (verified in T4 against 1.3);
   - `takenAt` is an ISO-8601 string derived from the unix `taken_at` seconds;
   - a media whose `image_versions2.candidates` is empty yields
     `thumbnailUrl: ''`, never `undefined` (T29 renders it);
   - `discoverReels('nasa', 20)` calls the api once with the account and a limit
     of 20 (`fetchUserReel('nasa', null, 20)`), and a fixture holding more edges
     than `scan` returns at most `scan` reels — "within the scan window" (1.1);
   - an empty `edges` array rejects with `FatalRunError('account-not-found')`
     whose message names the account and says no reels were found (1.5) — the
     real `anthropicai` case archived in
     `docs/research/ig-tools-bench/results/reliability_instafetcher.json`;
   - a payload with no `xdt_api__v1__clips__user__connection_v2` at all (the api
     resolves `undefined` when the graphql response is unusable) also rejects
     with `'account-not-found'` instead of throwing a `TypeError` (1.5,
     "not reachable");
   - an api rejection that reads as not found / HTTP 404 becomes
     `'account-not-found'` too, not a generic error (1.5).
2. **Implement (green):** Add `insta-fetcher` pinned to exactly `1.4.0` (no
   caret — the design's rationale), and implement the module as the only place
   that understands the `api/v1` payload shape. The default api is an `igApi`
   constructed with the cookie string `sessionid=<sessionId>;` — the exact format
   the benchmark proved works, since `insta-fetcher` refuses anonymous access.
3. **Verify:** `npm run typecheck` && `npm test`; the suite must pass with no
   network and no `IG_SESSIONID` in the environment (no test constructs the
   default api).

**Decision log:**

- RESOLVED the open conflict between T5's and T7's planners over `fetchUserReel`'s call shape. The vendored `dist/index.d.ts` declares `fetchUserReel: (username: string, end_cursor?: string | null | undefined, count?: number)`, so T5's `fetchUserReel(account, null, scan)` is type-valid and correct; T7's planner read the JS default (`''`) and inferred a mismatch that does not exist. No change needed to either task.
- Confirmed against the vendored types that `view_count` is `null` on this payload and `play_count` carries the real number — the mapper reads `play_count`, and the fixture encodes both so a regression is visible.
- `InstagramClient` declares only `discoverReels` here; T6 widens it with `hydrateReel`/`downloadVideo` rather than shipping unimplemented members now.
- Test seam `createInstagramClient(opts, deps?)` with `deps = { api?, sleep? }` added beyond the design's one-argument factory. `sleep` is unused until T7's retry policy, but is declared now so the signature is fixed once.

**Outcome:** `createInstagramClient(...).discoverReels` maps the clips listing to `DiscoveredReel[]`; 8 tests green, suite 49/49, typecheck clean. Suite needs no network and no `IG_SESSIONID` — no test constructs the default api.

### T6 — `lib/instagram`: `hydrateReel` and `downloadVideo`

- **Status:** `[x]` Done
- **Traces to:** 2.1, 2.2 → Design → `lib/instagram`
- **Depends on:** T5

**Objective:** `hydrateReel(mediaId)` returns the reel's caption, video URL and
duration, and `downloadVideo(videoUrl, destPath)` writes the mp4 to disk — the
two per-reel fetches the pipeline needs.

**TDD plan:**

1. **Test (red):** Extend `src/lib/instagram/instagram.test.ts` with a fixture
   `src/lib/instagram/__fixtures__/post-by-media-id.json`, hand-written from the
   shape `docs/research/ig-tools-bench/e2e.mjs` reads off `fetchPostByMediaId`:
   `items[0].caption.text`, `items[0].video_versions[0].url`,
   `items[0].video_duration`. `downloadVideo` needs a second seam: the same
   internal seam object T5 added to `createInstagramClient` also carries an
   optional `fetch` alongside the fake `igApi` — one seam, two collaborators, so
   T5's and T6's tests inject the same way (log it with T5's deviation).
   - `hydrateReel('123')` calls `fetchPostByMediaId` with that media id and
     returns `{ caption, videoUrl, durationSeconds }` mapped from the fixture
     (2.1);
   - a post whose `caption` is absent yields `''` and a post with no
     `video_duration` yields `0` — `HydratedReel` is typed all-required, so no
     `undefined` may leak downstream;
   - an empty `items` array, or an item with no `video_versions`, rejects with a
     plain `Error` (**not** `FatalRunError`) whose message says the video URL is
     missing, so it becomes a single reel's failure later;
   - `downloadVideo(url, destPath)` with a fake `fetch` returning a body stream
     writes exactly those bytes to `destPath` (read the file back and compare)
     (2.2);
   - a `destPath` inside a directory that does not exist yet is written
     successfully — T14 downloads into `tmp/<runId>/<shortcode>.mp4`;
   - a fake `fetch` responding 404 rejects with a plain `Error` whose message is
     the design's Scenario B wording, `video not available (404)`, so T14's reel
     `reason` reads exactly that, and no file is left at `destPath`.
2. **Implement (green):** Add both methods to the client. `hydrateReel` maps the
   payload with explicit defaults; `downloadVideo` checks `res.ok` before
   touching the filesystem, then streams `Readable.fromWeb(res.body)` into a
   write stream via `stream/promises#pipeline`, creating the destination
   directory with `mkdir(..., { recursive: true })` first. Retry and 403 handling
   are deliberately **not** added here — T7 wraps all three methods in one
   policy.
3. **Verify:** `npm run typecheck` && `npm test`; the suite must pass with no
   network and no `IG_SESSIONID`, writing temp files under `os.tmpdir()` and
   removing them in an `afterEach`.

**Decision log:**

- Fixture shape confirmed against `docs/research/ig-tools-bench/e2e.mjs` lines 36-44, which read `raw.items[0].caption.text`, `.video_duration` and `.video_versions[0].url` — the plan's description matched the benchmark exactly.
- `downloadVideo` throws `HttpStatusError` (new, exported) carrying the numeric status, so T7's policy classifies a 403 without parsing a message. Message is `video not available (404)` verbatim, as the design's Scenario B and T14's reel `reason` require.
- Two DOM-vs-node type clashes surfaced only in typecheck, never in the tests: `Response.body` is a DOM `ReadableStream` while `Readable.fromWeb` wants the `node:stream/web` one (bridged with an explicit cast), and `BodyInit` rejects `Uint8Array<ArrayBufferLike>` because it could be SharedArrayBuffer-backed (test helper now takes `Uint8Array<ArrayBuffer>`). Good argument for keeping typecheck in the verify step rather than trusting a green suite.

**Outcome:** `hydrateReel` and `downloadVideo` added to the client; 15 tests in instagram.test.ts, suite 56/56, typecheck clean. Temp files go under `os.tmpdir()` and are removed in `afterEach`; no network, no `IG_SESSIONID`.

### T7 — `lib/instagram`: request policy (403 fatal, backoff retries)

- **Status:** `[x]` Done
- **Traces to:** 6.4, 7.3 → Design → `lib/instagram` (Notes: retry policy lives
  in the adapter) and Error handling ("Transient Instagram failure (5xx,
  network) → retried with exponential backoff inside the adapter")
- **Depends on:** T5, T6

**Objective:** Every `InstagramClient` call goes through one policy: a transient
failure (5xx or network) is retried with exponential backoff before surfacing,
an HTTP 403 becomes `FatalRunError('ig-session-expired')` immediately, and
anything already fatal or plainly non-transient (a 4xx other than 403) surfaces
on the first attempt.

**TDD plan:**

1. **Test (red):** `src/lib/instagram/policy.test.ts`, with a fake api, a fake
   `fetch` and an injected `sleep` that only records its delays (no real
   waiting) —
   - an api that rejects twice with an axios-shaped 500
     (`{ response: { status: 500 } }`) and then succeeds makes `discoverReels`
     resolve, having called the api three times (6.4);
   - the recorded `sleep` delays grow exponentially — `baseDelayMs`, then
     `2 × baseDelayMs` — not a fixed delay (6.4);
   - an api that always rejects with a 500 rejects after exactly `attempts`
     calls with the underlying message preserved, and a network-level rejection
     with no `response` (e.g. `ECONNRESET`) is retried the same way (6.4's
     "transiently" covers both);
   - a 403 (`{ response: { status: 403 } }`) rejects with `FatalRunError` whose
     `code` is `'ig-session-expired'` after exactly **one** call, and whose
     message tells the operator to rotate the Instagram session cookie (7.3);
   - the same 403 rule holds for `hydrateReel` and for `downloadVideo` — whose
     403 arrives as a non-ok `Response` from the injected `fetch`, not as a
     thrown error — so the rule is a property of the client, not of one method
     (7.3);
   - a 404 rejects after exactly one call with no `sleep` at all: only 5xx and
     network errors are transient, so T5's `account-not-found` and T6's
     missing-video mappings do not each pay three attempts;
   - a `FatalRunError` raised *inside* the wrapped function (T5's empty-listing
     → `'account-not-found'`) escapes on the first attempt, unretried and
     unwrapped.
2. **Implement (green):** Extract a `withPolicy(fn)` wrapper and route all three
   methods through it. Classify before deciding: read the status from
   `err.response?.status` (insta-fetcher hands axios' rejection straight
   through — `FetchIGAPI` sets no `validateStatus`, so a non-2xx is an
   `AxiosError` carrying `response.status`), then `err.status`, then a `\b403\b`
   match on the message as a last resort; have `downloadVideo` attach the
   numeric `Response.status` to the `Error` it throws (T6) so the policy never
   depends on message parsing. Re-throw `FatalRunError` untouched. Default
   `retry` to `{ attempts: 3, baseDelayMs: 500 }`, configurable through
   `createInstagramClient(opts)` as the design's signature shows. A retried
   `downloadVideo` must re-open its destination with the default truncating
   `'w'` flag so a partial body from the failed attempt is not left prepended.
3. **Verify:** `npm run typecheck` && `npm test`; with the injected `sleep` the
   suite spends no real time on backoff and reaches no network. Record in the
   Decision log the `sleep` seam and the status-classification order — the
   design's published signature shows neither.

**Decision log:**

- Transient classification is deliberately narrow: 5xx by status, or a network error identified by a string `code` (ECONNRESET etc.) when no status is present. A plain `Error` from our own mapping — e.g. T6's "no video URL" — carries neither, so it surfaces on the first attempt instead of paying three attempts of backoff.
- Status is read in the order the plan set: `err.response.status` (axios, which insta-fetcher passes straight through), then `err.status` (T6's HttpStatusError), then a `\b403\b` match on the message as a last resort. Message parsing is a fallback only.
- `FatalRunError` is re-thrown before any classification, so T5's empty-listing → `account-not-found` escapes on the first attempt, unretried and unwrapped.
- Ran prettier on this file to fix indentation after refactoring the object literal into function declarations; it applied its defaults (semicolons, double quotes), which clashed with the rest of the codebase. Re-ran with `--no-semi --single-quote --print-width 100` to match. The project has no formatter configured — worth settling on one before the file count grows.

**Outcome:** One `withPolicy` wrapper routes all three methods; 10 tests in policy.test.ts, suite 66/66, typecheck clean. The injected `sleep` records delays instead of waiting, so the suite spends no real time on backoff.

### T8 — `lib/media`: ffmpeg audio extractor

- **Status:** `[x]` Done
- **Traces to:** 2.3 → Design → `lib/media` (the returned `sizeBytes` is what
  lets T15 enforce the 25 MB limit without re-reading the file; the guard itself
  belongs to T15/2.6)
- **Depends on:** T1

**Objective:** `src/lib/media/index.ts` exports `createFfmpegExtractor(ffmpegBin?)`,
whose `extractAudio(videoPath, destPath)` produces a mono 16 kHz MP3 and resolves
with `{ path, sizeBytes }`, so the caller can enforce the transcription size limit
without re-reading the file.

**TDD plan:**

1. **Test (red):** `src/lib/media/media.test.ts` with an injected process runner
   and stat function —
   - the runner is invoked with the binary `ffmpeg` and an argv containing the
     adjacent pairs `['-i', videoPath]`, `['-ac', '1']` and `['-ar', '16000']`,
     plus `-vn`, `libmp3lame` and `-y`, ending with `destPath` (2.3 — mono
     16 kHz MP3). Assert adjacency on the argv array rather than a substring of
     the joined string, so a reordered argv cannot pass;
   - a zero exit code resolves with `{ path: destPath, sizeBytes }`, the size
     taken from the injected stat called on `destPath`;
   - a non-zero exit code rejects with a plain `Error` (**not** `FatalRunError`)
     carrying the tail of ffmpeg's stderr, so a corrupt mp4 fails one reel
     instead of aborting the run;
   - `createFfmpegExtractor('/opt/bin/ffmpeg')` runs that binary instead of the
     default `ffmpeg`.
2. **Implement (green):** Implement over `child_process.spawn` and
   `fs/promises#stat` behind injected `run`/`stat` seams whose defaults are the
   real ones, and note the seam in the Decision log since the design's published
   signature (`createFfmpegExtractor(ffmpegBin?)`) does not show it.
3. **Verify:** `npm run typecheck` && `npm test` — no test invokes the real
   binary or touches the filesystem, so the suite passes on a machine without
   ffmpeg.

**Decision log:**

- `run`/`stat` seams added as an optional second argument; the design publishes only `createFfmpegExtractor(ffmpegBin?)`. Defaults are the real `child_process.spawn` and `fs/promises.stat`.
- Argv adjacency is asserted as pairs (`['-i', videoPath]`, `['-ac','1']`, `['-ar','16000']`) rather than against a joined string, so a reordered argv cannot pass.
- On a non-zero exit only the last 5 stderr lines are kept — ffmpeg's stderr is mostly banner noise and the real cause is at the end.

**Outcome:** `createFfmpegExtractor` in `src/lib/media/index.ts`; 4 tests, suite 70/70, typecheck clean. No test spawns ffmpeg or touches disk, so the suite passes on a machine without it.

### T9 — `lib/openrouter`: transcription client and `models.ts`

- **Status:** `[x]` Done
- **Traces to:** 2.4, 2.6 → Design → `lib/openrouter`, `src/lib/models.ts`
- **Depends on:** T1

**Objective:** `createTranscriptionClient({ apiKey, maxAudioBytes })` turns an
extracted MP3 into transcript text through OpenRouter and refuses an oversized
file before issuing any request or even reading it, with the three OpenRouter
model IDs pinned in `src/lib/models.ts` — the module this request reads its own
model from.

**TDD plan:**

1. **Test (red):** `src/lib/openrouter/transcription.test.ts` with an injected
   `fetch` (the design's published signature shows no seam — keep it an optional
   internal argument and log the deviation) —
   - happy path: write a few known bytes to a temp `.mp3`, then
     `transcribe(tmpPath, sizeBytes)` issues exactly one `POST` to
     `https://openrouter.ai/api/v1/audio/transcriptions` with an
     `Authorization: Bearer <apiKey>` header and a JSON body carrying
     `model: MODELS.transcription`, `format: 'mp3'` and the file's bytes
     base64-encoded (decode the body's audio field and compare it to the bytes
     written), resolving with the transcript text from the response (2.4). This
     assertion is also the only meaningful test of `models.ts`: the pinned ID
     reaches the wire.
   - `sizeBytes` above `maxAudioBytes` rejects with `AudioTooLargeError` and the
     injected `fetch` was **never** called; pass a path that does **not** exist,
     so a rejection that is not `ENOENT` proves the file was never read either —
     2.6's "without sending the transcription request";
   - `AudioTooLargeError` is an `instanceof Error` but **not** a `FatalRunError`,
     and its `message` is exactly `audio too large`, so 2.6's reason string has
     one source (T15's guard reuses it) and an oversized file fails one reel
     instead of aborting the run;
   - the default `maxAudioBytes` is exactly `25 * 1024 * 1024` and is exported
     (`MAX_AUDIO_BYTES`), so this client and T15's extract-audio guard share one
     constant; a size exactly equal to the limit is accepted (the requirement
     says "exceeds");
   - a non-2xx response rejects with a plain `Error` naming the status, and a 2xx
     response carrying no transcript text rejects with a plain `Error` too — a
     reel failure rather than a run abort, and never an `undefined` transcript
     flowing on into the analysis prompt.
2. **Implement (green):** `src/lib/openrouter/transcription.ts` exporting
   `createTranscriptionClient`, `AudioTooLargeError` and `MAX_AUDIO_BYTES`,
   reading the file with `fs/promises` **after** the size check, plus
   `src/lib/models.ts` exporting
   `MODELS = { transcription, analysis, generation }` — pin the exact IDs against
   OpenRouter's live model list (`anthropic/…` for analysis and generation, a
   speech-to-text model for transcription) and record the pinned IDs and the date
   they were checked in the Decision log. No new dependency: the request goes out
   over `fetch`. The design publishes a single `createOpenRouterClients` factory
   returning both clients; ship only the transcription half here and let T10
   compose that façade once `completion` exists — log that. While implementing,
   confirm the endpoint, request body and response field against OpenRouter's
   current API docs; if they differ from the design's note, update `design.md`
   and log it.
3. **Verify:** `npm run typecheck` && `npm test`; the suite must pass with no
   network and no `OPENROUTER_API_KEY` in the environment.

**Decision log:**

- Model IDs pinned against OpenRouter's live list on 2026-08-06: transcription `openai/whisper-large-v3`; analysis and generation `anthropic/claude-opus-5` (\$5/\$25 per M, 1M ctx). Verified each ID resolves via `GET /api/v1/models`.
- Did NOT downgrade the analysis step to `anthropic/claude-sonnet-5` (~2.5x cheaper at \$2/\$10) even though it is a credible swap for bounded structured extraction — trading quality for cost is a product decision, so it is documented as an explicit lever in models.ts rather than taken silently.
- Request body follows OpenRouter's documented shape — `{ model, input_audio: { data, format } }` with raw base64 (not a data URI) — which is more specific than the design's note; no design change needed.
- Only the transcription half ships here. The design's single `createOpenRouterClients` façade is deferred to T10, once `completion` exists to compose with.
- `MAX_AUDIO_BYTES` is exported so T15's guard and this client share one constant, and the size check runs before `readFile` — the test passes a nonexistent path to prove the file is never read (2.6).

**Outcome:** `createTranscriptionClient` plus `src/lib/models.ts`; 6 tests, suite 76/76, typecheck clean. Passes with no network and no `OPENROUTER_API_KEY`.

### T10 — `lib/openrouter`: schema-constrained completion with one retry

- **Status:** `[x]` Done
- **Traces to:** 3.2, 3.3, 3.4, 4.3, 4.4 → Design → `lib/openrouter` ("the retry
  lives here so both LLM steps get it without repeating the logic"). The "mark
  the reel failed" half of 3.4 and 4.4 lands in T16/T17; this task owns the
  rejection, the single retry, and the distinguishable error they map from.
- **Depends on:** T2, T9

**Objective:**
`createOpenRouterClients({ apiKey }).completion.complete({ model, prompt, schema })`
returns a value validated against the Zod schema, retries exactly once when the
response is rejected, and then throws `SchemaValidationError` — so both LLM
steps inherit the same rejection-and-retry rule instead of repeating it.

**TDD plan:**

1. **Test (red):** `src/lib/openrouter/completion.test.ts` with an injected
   generator standing in for the AI SDK call. The seam hands back the model's
   raw object as `unknown` and `complete` — not the SDK — decides whether it
   conforms, so the retry rule is ours and observable:
   - a first response matching `reelAnalysisSchema` resolves with the parsed
     value and the generator was called exactly once;
   - the generator received the given `model` and `prompt`, and the retry re-asks
     with the same prompt (assert both calls' arguments — the retry must not
     mutate the request);
   - a first response violating `reelAnalysisSchema` (missing `targetAudience`)
     followed by a valid one resolves with the second value, generator called
     exactly twice (3.2, 3.3);
   - two consecutive schema violations reject with a `SchemaValidationError`
     (**not** `FatalRunError`) after exactly two calls, so the caller can label
     the reel failed (3.4, 4.4); the error is exported and `instanceof`-checkable
     because T16/T17 branch on it;
   - a generator that *throws* the AI SDK's own schema/type-validation error
     (`NoObjectGeneratedError` / `TypeValidationError` — what
     schema-constrained generation actually does when the model returns
     something unparseable) is classified as a **rejection** too: retried once,
     and the second one becomes `SchemaValidationError`. Without this case
     3.3/4.4 would hold only for the shapes our fake happens to return;
   - the same rejection-then-retry behaviour holds for `reelScriptSchema` (4.3)
     — assert with a script response missing `closing`;
   - a transport-level error (a thrown `Error('network')`) is **not** retried at
     this layer: one call, the error surfaces unchanged;
   - `createOpenRouterClients({ apiKey })` exposes this client as `completion`
     next to T9's `transcription`, matching the design's factory signature.
2. **Implement (green):** Add `ai` and `@openrouter/ai-sdk-provider`, fill in the
   `completion` half of `createOpenRouterClients` (T9 shipped `transcription`),
   and implement `complete` as: call the injected generator (default: the AI SDK
   provider with schema-constrained generation) → `schema.safeParse` → on
   rejection retry once → on the second rejection throw `SchemaValidationError`.
   Classify the SDK's own validation errors as rejections and everything else as
   transport. Record in the Decision log the pinned package versions and whether
   the AI SDK's expected `zod` version matches the one T2 introduced.
3. **Verify:** `npm run typecheck` && `npm test` — no test needs
   `OPENROUTER_API_KEY` and none reaches the network.

**Decision log:**

- Pinned `ai@^7.0.55` and `@openrouter/ai-sdk-provider@^3.0.0`. `ai`'s peer range is `zod ^3.25.76 || ^4.1.8`, which the zod 3.25.76 from T2 satisfies exactly — the compatibility check T2 flagged came out clean.
- The AI SDK's own validation failures are classified by error NAME (`/NoObjectGenerated|TypeValidation|JSONParse/i`) rather than by importing the error classes. The SDK prefixes them `AI_` and the set has changed across majors; a name test survives an upgrade that a hard import would not.
- `complete` runs the schema check itself via `safeParse` on the generator's raw `unknown`, instead of delegating validation to the SDK. That is what makes the retry rule ours and observable, and it is why a fake generator can exercise 3.3/3.4 without the SDK in the loop.
- A transport error is deliberately NOT retried here — the reel-level retry budget belongs to the caller, and retrying a network failure twice per LLM step would quietly quadruple a run's worst case.

**Outcome:** `createCompletionClient` plus the `createOpenRouterClients` façade composing both halves; 10 tests, suite 86/86, typecheck clean. No test needs `OPENROUTER_API_KEY` or reaches the network.

### T11 — `lib/prompts`: analysis and script prompt builders

- **Status:** `[x]` Done
- **Traces to:** 3.1, 4.2, 4.6 → Design → `lib/prompts`
- **Depends on:** T2

**Objective:** Two pure builders assemble the LLM prompts: the analysis prompt
carries both the transcript and the caption and asks for the three analysis
fields, and the script prompt carries the actor's profile markdown verbatim plus
the instruction to write the script in Spanish as hook, body and closing.

**TDD plan:**

1. **Test (red):** `src/lib/prompts/prompts.test.ts` —
   - `buildAnalysisPrompt({ transcript, caption })` contains both strings
     verbatim (a `toContain` per string, with a transcript and a caption that
     share no substring so neither assertion can pass by accident) and names
     `objective`, `highlights` and `targetAudience` — the exact keys
     `reelAnalysisSchema` validates (3.1);
   - a reel with `caption: ''` still produces a usable prompt: it contains the
     transcript and the string `'undefined'` appears nowhere in the output;
   - `buildScriptPrompt({ analysis, profile })` embeds the profile **verbatim**:
     assert `prompt.includes(profile.markdown)` for a multi-line markdown fixture
     (a heading, a couple of paragraphs and a distinctive marker line), so
     truncating, trimming or reformatting the profile fails the test (4.2);
   - the same prompt contains the analysis' `objective`, every entry of
     `highlights` and its `targetAudience`;
   - it asks for a hook, a body and a closing (4.1's shape, the one
     `reelScriptSchema` validates) and contains an explicit Spanish-output
     instruction even though the analysis and profile fixtures are written in
     English (4.6);
   - `@ts-expect-error` on `buildScriptPrompt({ analysis, profile, language: 'en' })`
     — excess-property checking makes the extra argument a compile error, so
     "Spanish is not per-run configurable" (requirements' Out of scope) is
     enforced by the type rather than by convention.
2. **Implement (green):** Two pure template functions, no I/O, importing nothing
   but `ReelAnalysis` from `src/lib/types.ts`. Type the `profile` parameter
   structurally as `{ name: string; markdown: string }` instead of importing
   `ActorProfile` from `lib/profiles`: that module only lands in T12, and
   structural typing means the real `ActorProfile` still satisfies the parameter.
   Record that deviation from the design's published signature in the Decision
   log.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- `profile` is typed structurally as `{ name: string; markdown: string }` rather than importing `ActorProfile` from `lib/profiles`, which only lands in T12. Structural typing means the real `ActorProfile` satisfies it, so no task depends on a later one.
- The Spanish instruction (4.6) is in the prompt body and there is no `language` parameter — the `@ts-expect-error` test makes 'not per-run configurable' a compile-time guarantee rather than a convention.
- Analysis and caption fixtures share no substring, so neither `toContain` can pass on the other's text — the kind of false green this test exists to prevent.

**Outcome:** `buildAnalysisPrompt` and `buildScriptPrompt`, both pure; 8 tests, suite 94/94, typecheck clean.

### T12 — `lib/profiles`: actor profiles and the `profiles/` directory

- **Status:** `[x]` Done
- **Traces to:** 4.5, 5.2 → Design → `lib/profiles`
- **Depends on:** T3

**Objective:** `src/lib/profiles/index.ts` exports `ActorProfile`,
`listActors(dir)` — exactly the actors that have a profile — and
`loadActorProfile(dir, name)` — the raw markdown, or
`FatalRunError('unknown-actor')`; and the repo carries a real `profiles/`
directory with at least one hand-written profile the app can actually select.

**TDD plan:**

1. **Test (red):** `src/lib/profiles/profiles.test.ts`. Against a temp fixture
   directory (created with `fs.mkdtemp`, removed afterwards) holding
   `juanse.md`, `ana.md` and a stray `notes.txt` —
   - `listActors(dir)` resolves to `['ana', 'juanse']`: sorted, extension
     stripped, non-`.md` files ignored (5.2 — "exactly those actors that have a
     profile");
   - `loadActorProfile(dir, 'juanse')` resolves to
     `{ name: 'juanse', markdown }` with the file's exact contents (raw
     markdown, unparsed — the design hands it to the prompt as-is);
   - `loadActorProfile(dir, 'nadie')` rejects with `FatalRunError` whose `code`
     is `'unknown-actor'` and whose message names the actor (4.5);
   - a name containing `/` or `..` is rejected as `'unknown-actor'` rather than
     reading outside `dir`;
   - `listActors` on an empty directory resolves to `[]`, and on a directory
     that does not exist also resolves to `[]` rather than throwing — the page
     (T27) reads the directory server-side and must still render when no
     profile has been written yet.
   Then, against the repo's **real** directory
   (`path.join(process.cwd(), 'profiles')`), so the artifact this task ships is
   covered rather than assumed — nothing else in the plan asserts on it (T27
   mocks `listActors`) —
   - `listActors` includes `'juanse'`, and `loadActorProfile(dir, 'juanse')`
     returns markdown longer than 200 characters: a real profile, not an empty
     placeholder (5.2 — the actor T27's selector offers).
2. **Implement (green):** Implement over `fs/promises` — `readdir` filtering
   `.md`, `readFile` with `utf8` — rejecting any `name` that is not a bare file
   name *before* touching the filesystem. Export `ActorProfile`
   (`{ name; markdown }`) from this module, as the design publishes it; if T2
   hoisted that type into `src/lib/types.ts` — the recommended fix, since
   `lib/prompts` (T11) types `buildScriptPrompt` with it and lands earlier —
   import it from there and re-export it here rather than redeclaring it, and
   record which in the Decision log. Write the real `profiles/juanse.md`: tone,
   verbal tics, topics they command, preferred format and a couple of sample
   scripts, as the glossary describes. Confirm `profiles/` is **not** matched by
   T1's `.gitignore`.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- `ActorProfile` is declared here, as the design publishes it — T2 did not hoist it into `types.ts`, and T11 avoided the ordering problem by typing its parameter structurally instead.
- Path traversal is rejected BEFORE any filesystem call: a name containing a separator, or `.`/`..`, fails `isBareName` and raises `unknown-actor`. Tested with `../secrets`, `nested/juanse`, `/etc/passwd` and `.`.
- `listActors` resolves `[]` for a missing directory instead of throwing, so T27's page renders before any profile exists.
- Two tests run against the repo's real `profiles/` directory, not a fixture — T27 mocks `listActors`, so without them the shipped artifact would be assumed rather than covered.

**Outcome:** `listActors`/`loadActorProfile` plus the committed `profiles/juanse.md`; 10 tests, suite 104/104, typecheck clean. `git check-ignore` confirms `profiles/` is not matched by T1's .gitignore.

### T13 — Mastra instance, run dependencies and the per-reel failure helper

- **Status:** `[x]` Done
- **Traces to:** 6.1 → Design → `mastra/index.ts`, "Thin steps, injected
  adapters", "Two error classes, one rule"
- **Depends on:** T2, T3, T6, T8, T10, T12 (the adapter interfaces `RunDeps` is
  typed against; all precede this task)

**Objective:** The foundation every step from T14 on sits on exists: a Mastra
instance with its LibSQL store, one documented seam through which a step reads
the injected adapters (`RunDeps`), and `withReelFailure(step, state, fn)`, which
turns any non-fatal throw inside a per-reel step into a `failed` outcome
labelled with that step, passes an already-failed reel through untouched, and
lets `FatalRunError` propagate.

**TDD plan:**

1. **Test (red):** two small test files.
   - `src/mastra/steps/with-reel-failure.test.ts` — the helper's contract. Pin
     the signature as `withReelFailure(step, state, fn)`: the two-argument form
     cannot implement the pass-through case, and T14–T18 all build on this
     shape. It is generic over the **in-flight** per-reel state this task
     introduces (`ReelState` = `ReelBase & { status: 'pending' }` plus the
     optional fields later steps add — `caption`, `videoUrl`,
     `durationSeconds`, `videoPath`, `audioPath`, `audioSizeBytes`,
     `transcript`, `analysis`, `script` — united with `ReelOutcome`; T2 models
     only the finished outcome, so the in-flight state lands next to its only
     consumer).
     - `fn` resolves → its value is returned and `fn` ran exactly once;
     - `fn` throws `Error('boom')` → resolves to
       `{ status: 'failed', failedStep: 'transcribe', reason: /boom/ }` keeping
       the reel's `rank`, `shortcode`, `thumbnailUrl` and `metrics` (6.1 —
       failures are values, not exceptions);
     - `fn` throws a non-`Error` value (a bare string) → still a `failed`
       outcome with a **non-empty** `reason`, so 6.1's "recording the reason"
       cannot degrade to `undefined`;
     - an input already `{ status: 'failed', failedStep: 'download', reason }`
       is returned **unchanged** (same `failedStep` and `reason`) and `fn` was
       never called — this is the case the signature must carry the state for;
     - `fn` throws `FatalRunError('ig-session-expired')` → the helper rejects
       with that same instance rather than producing a failed outcome (the one
       exception allowed to escape).
   - `src/mastra/mastra.test.ts` — the scaffolding half, so "installed and
     configured" is verified instead of merely asserted:
     - `createMastra({ storageUrl: 'file::memory:' })` returns an instance whose
       storage is configured and whose workflow registry is queryable and empty
       (T19/T22 register workflows into it);
     - importing `src/mastra/index.ts` creates no `.mastra/` directory on disk —
       the file-backed singleton is built lazily — so the unit suite stays
       hermetic;
     - `getRunDeps(ctx)` returns the bundle `withRunDeps(ctx, deps)` put there,
       and throws an error naming the missing adapter when nothing was set. This
       is the single seam T14–T21 use instead of importing clients, and the one
       place the design's "injected through the Mastra instance's dependency
       container" becomes concrete.
2. **Implement (green):** Install `@mastra/core` and `@mastra/libsql`. Create:
   - `src/mastra/index.ts` — `createMastra(opts)` (LibSQL storage; the test
     passes an in-memory url) plus the lazily-built default `mastra` singleton
     pointing at `.mastra/`, with workflows registered as they land;
   - `src/mastra/deps.ts` — the `RunDeps` interface bundling the already-built
     adapters (`instagram: InstagramClient`, `media: AudioExtractor`,
     `transcription: TranscriptionClient`, `completion: CompletionClient`,
     `profiles: { listActors, loadActorProfile }`, `env` and `probe` for T20,
     a `removeFile` seam for T18 and the run-scoped `tmpDir` T14/T15 write
     into) and its accessor over whatever per-run context the pinned Mastra
     version provides (`RuntimeContext` today);
   - `src/mastra/state.ts` — the `ReelState` union above;
   - `src/mastra/steps/with-reel-failure.ts`.

   Record in the Decision log the exact package versions, the workflow/step API
   (`createStep`/`createWorkflow` signatures and their input/output schema
   requirements) and the injection mechanism actually used — T14 onward depend
   on all three, and `design.md` names none of them.
3. **Verify:** `npm run typecheck` && `npm test`; the suite must leave no
   `.mastra/` database behind (`git status` clean afterwards).

**Decision log:**

- Pinned `@mastra/core@^0.24.9` and `@mastra/libsql@^0.16.4`. API confirmed against the installed typings: `createStep(params)` / `createWorkflow(params)` from `@mastra/core/workflows`, `.foreach(step, { concurrency: number })` — exactly the knob 6.3 needs — and `.commit()` to finalise. Injection is `RuntimeContext` from `@mastra/core/runtime-context` (get/set/has).
- `withReelFailure(step, state, fn)` keeps the three-argument shape the plan pinned: the state argument is what makes the already-failed pass-through possible at all.
- A non-`Error` throw is stringified and falls back to `'unknown error'` when blank, so 6.1's reason can never be empty.
- `ReelState` lives in `src/mastra/state.ts`, not `lib/types.ts`: `types.ts` models the finished `ReelOutcome`, while this is the in-flight working shape whose only consumer is the step layer. Every later step's field is optional so one type carries a reel end to end without a cast per step.
- The file-backed Mastra instance is built lazily behind `getMastra()` — importing the module must not create a database, or the unit suite stops being hermetic.

**Outcome:** `createMastra`/`getMastra`, `RunDeps` with `withRunDeps`/`getRunDeps`, `ReelState` and `withReelFailure`; 9 tests, suite 113/113, typecheck clean. No `.mastra/` directory is left behind.

### T14 — Reel steps: `hydrate` and `download`

- **Status:** `[x]` Done
- **Traces to:** 2.1, 2.2, 6.1 → Design → `mastra/steps`, "thin steps, injected
  adapters"
- **Depends on:** T6, T13

**Objective:** The `hydrate` and `download` steps call the injected
`InstagramClient` and extend the per-reel state with caption/videoUrl/duration
and the local video path, labelling their own failures with the `PipelineStep`
literals `'hydrate'` and `'download'` (the design's architecture diagram writes
the second one as `downloadVideo`; the `PipelineStep` union in the data models
is authoritative).

**TDD plan:**

1. **Test (red):** `src/mastra/steps/ingest.test.ts` with a fake
   `InstagramClient` — no network, no filesystem, so both steps stay pure
   orchestration —
   - `hydrate` calls `hydrateReel(mediaId)` exactly once and returns state
     carrying `caption`, `videoUrl` and `durationSeconds`, preserving `rank`,
     `shortcode`, `mediaId`, `thumbnailUrl` and `metrics` (2.1);
   - a rejecting `hydrateReel` yields
     `{ status: 'failed', failedStep: 'hydrate' }` with the error message as
     `reason`, and `downloadVideo` was never called (6.1);
   - `download` calls `downloadVideo(videoUrl, destPath)` with the `videoUrl`
     that `hydrate` put on the state and a `destPath` of
     `join(tmpDir, shortcode + '.mp4')`, where `tmpDir` is the run-scoped temp
     directory read from the run state — not recomputed inside the step — and
     the returned state carries that exact path as `videoPath`, so T18 deletes
     the file that was actually written (2.2);
   - a rejecting `downloadVideo` (404) yields `failed` at `'download'` with a
     `reason` containing `404`, matching the design's Scenario B;
   - both steps return an already-`failed` input untouched and call neither
     client method (6.1's pass-through);
   - a `FatalRunError` thrown by the client (an expired-cookie 403 surfacing
     inside `hydrateReel`) propagates out of the step instead of becoming a
     failed reel — this only checks the steps are wired through
     `withReelFailure` and do not swallow it; the run-level abort is T22's.
2. **Implement (green):** `src/mastra/steps/hydrate.ts` and
   `src/mastra/steps/download.ts` (the design's one-file-per-step layout), both
   built on `withReelFailure` and both taking the `InstagramClient` and the run
   temp directory from the injected container / run state rather than importing
   or deriving them. The design names `ReelInput` but never defines it and T13's
   helper is generic over the state: pin the per-reel working state type here —
   `ReelBase & { mediaId: string }` plus the optional fields each step adds
   (`caption`, `videoUrl`, `durationSeconds`, `videoPath`) — and record it in
   the Decision log so T15–T18 extend the same type instead of inventing their
   own.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Steps are plain `(state, deps) => Promise<ReelState>` functions rather than `createStep` objects. They are trivially unit-testable this way, and T19 wraps them in Mastra steps at composition time — the engine stays out of the step's own contract.
- `destPath` is `join(deps.tmpDir, shortcode + '.mp4')` with `tmpDir` read from the injected run state, never recomputed, so T18 deletes the file that was actually written.
- Used the `PipelineStep` literal `'download'`; the design's architecture diagram writes it `downloadVideo`, and the data-model union is authoritative.

**Outcome:** `hydrate` and `download` steps; 7 tests, suite 120/120, typecheck clean.

### T15 — Reel steps: `extract-audio` (25 MB guard) and `transcribe`

- **Status:** `[x]` Done
- **Traces to:** 2.3, 2.4, 2.6, 6.1 → Design → `mastra/steps`, Error handling
  ("Extracted audio > 25 MB → reel `failed` at `extract-audio`, reason
  'audio too large', no request sent")
- **Depends on:** T8, T9, T13, T14

**Objective:** The `extract-audio` step turns the downloaded video into a mono
16 kHz MP3 inside the run's temp directory and refuses an audio file over the
25 MB limit, and the `transcribe` step stores the transcript against the reel —
so an oversized reel is failed before any transcription request leaves the
process, and its temp files stay visible to cleanup.

**TDD plan:**

1. **Test (red):** `src/mastra/steps/audio.test.ts` with a fake `AudioExtractor`
   and a fake `TranscriptionClient` —
   - `extract-audio` calls `extractAudio(videoPath, destPath)` with a `destPath`
     in the same run temp directory T14's `download` writes to, named
     `<shortcode>.mp3`, and returns state carrying `audioPath` and
     `audioSizeBytes` taken from the extractor's `{ path, sizeBytes }`, with
     `rank`, `shortcode`, `thumbnailUrl` and `metrics` preserved (2.3);
   - an extractor rejection (corrupt mp4) yields `failed` at `'extract-audio'`
     with the ffmpeg message as `reason` (6.1);
   - an extractor returning `sizeBytes` one byte above the limit exported by
     `lib/openrouter` (T9's `maxAudioBytes` default, `25 * 1024 * 1024`) yields
     `failed` at `'extract-audio'` with `reason` exactly `'audio too large'` —
     compute the fixture size from the imported constant, never from a literal,
     so the guard and the client can never drift apart (2.6);
   - `sizeBytes` exactly equal to that limit is **not** rejected — the criterion
     says "exceeds", so the boundary passes through to `transcribe` (2.6);
   - the oversized `failed` state still carries `videoPath` **and** `audioPath`,
     so T18's cleanup can delete the very file the guard refused to send (2.5);
   - feeding that oversized `failed` state into the `transcribe` step returns it
     untouched with the fake `TranscriptionClient` never called — this chained
     assertion, not one inside the `extract-audio` test alone, is what actually
     proves "without sending the transcription request"; asserting it while only
     running `extract-audio` would pass in a vacuum (2.6);
   - `transcribe` on a healthy state calls
     `transcribe(audioPath, audioSizeBytes)` and returns state carrying
     `transcript` (2.4);
   - a rejecting `transcribe` (e.g. provider timeout) yields `failed` at
     `'transcribe'` with that message as `reason` (6.1);
   - both steps return an already-`failed` input (e.g. failed at `'download'`)
     untouched, without calling their adapter.
2. **Implement (green):** Both steps on `withReelFailure`, taking the extractor
   and the transcription client from the injected container and reusing T14's
   run temp-dir helper for `destPath`. Import the size limit from
   `lib/openrouter` so one constant governs both this guard and the client's own
   `AudioTooLargeError`. The guard must **return** its failure rather than throw:
   after a successful extraction the step first extends the state with
   `audioPath`/`audioSizeBytes`, then returns
   `{ status: 'failed', failedStep: 'extract-audio', reason: 'audio too large' }`
   built from that extended state — throwing would make `withReelFailure` rebuild
   the outcome from the *input* state, dropping `audioPath` and leaking a 25 MB
   file past cleanup. Keep `'audio too large'` a single literal in one place.
3. **Verify:** `npm run typecheck` && `npm test` — the suite must pass with no
   ffmpeg binary and no `OPENROUTER_API_KEY`.

**Decision log:**

- The oversized guard RETURNS its failure instead of throwing. Throwing would send it through `withReelFailure`, which rebuilds the outcome from the INPUT state — dropping `audioPath` and leaking a 25 MB file past cleanup. The test asserts both paths survive on the failed state.
- Fixture sizes are computed from the imported `MAX_AUDIO_BYTES`, never a literal, so the step's guard and the transcription client cannot drift apart. Boundary case (size exactly equal) passes through — 2.6 says "exceeds".
- The "no request is sent" claim is asserted by chaining the oversized state into the real `transcribe` step; asserting it inside the extract-audio test alone would have passed in a vacuum.

**Outcome:** `extract-audio` (with the 25 MB guard) and `transcribe`; 10 tests, suite 146/146, typecheck clean. Passes with no ffmpeg binary and no `OPENROUTER_API_KEY`.

### T16 — Reel step: `analyze`

- **Status:** `[x]` Done
- **Traces to:** 3.1, 3.4, 6.1 → Design → `mastra/steps` (analyze). The single
  retry demanded by 3.3 lives inside `complete` (T10); this step's only duty
  towards it is to go through that client and map its final give-up.
- **Depends on:** T10, T11, T15

**Objective:** The `analyze` step builds the analysis prompt from the reel's
transcript and caption, obtains a value validated against `reelAnalysisSchema`
through the completion client, stores it on the reel state, and marks the reel
failed at `'analyze'` with reason "invalid analysis response" when the client
gives up.

**TDD plan:**

1. **Test (red):** `src/mastra/steps/analyze.test.ts` with a fake
   `CompletionClient` —
   - the step calls `complete` **exactly once** with `MODELS.analysis`,
     `reelAnalysisSchema` and the prompt from `buildAnalysisPrompt`, which
     contains the reel's transcript and its caption verbatim (3.1); asserting it
     goes through `complete` — and not through a bare generation call — is what
     keeps the 3.3 retry in force for the analysis path;
   - a valid response is stored on the state as `analysis` with `objective`,
     `highlights` and `targetAudience`, while the rest of the state survives
     (`transcript`, `caption`, `rank`, `shortcode`, `thumbnailUrl`, `metrics`) —
     T17 reads `analysis` and the assembled outcome must still carry `ReelBase`;
   - a `SchemaValidationError` from `complete` (the client having already retried
     once, T10) yields
     `{ status: 'failed', failedStep: 'analyze', reason: 'invalid analysis response' }`
     with that reason string exactly (3.4, 6.1);
   - any other rejection (e.g. a transport error) yields `failed` at `'analyze'`
     carrying **that error's** message as `reason`, not the fixed string (6.1);
   - an already-`failed` input is returned unchanged and `complete` is never
     called (6.1).
2. **Implement (green):** The step on `withReelFailure('analyze', …)`, taking the
   completion client from the injected container (the design's "thin steps,
   injected adapters") and mapping only `SchemaValidationError` to the fixed
   reason string, letting every other message through.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Only `SchemaValidationError` maps to the fixed `'invalid analysis response'` reason; every other error keeps its own message, so a transport failure stays diagnosable rather than being disguised as a schema problem.
- The test asserts the call goes through `completion.complete` with the real `reelAnalysisSchema` — that is what keeps T10's single retry (3.3) in force for this path rather than the step quietly bypassing it.

**Outcome:** `analyze` step; 5 tests, suite 146/146, typecheck clean.

### T17 — Reel step: `generate-script`

- **Status:** `[x]` Done
- **Traces to:** 4.1, 4.2, 4.4, 4.6, 6.1 → Design → `mastra/steps`
- **Depends on:** T10, T11, T12, T16

**Objective:** The `generate-script` step builds the script prompt from the
reel's analysis plus the run's actor profile, asks the completion client for a
value validated against `reelScriptSchema`, turns it into the reel's `ok`
outcome, and marks the reel failed at `'generate-script'` with reason "invalid
script response" once the client has exhausted its single retry.

**TDD plan:**

1. **Test (red):** `src/mastra/steps/generate-script.test.ts` with a fake
   `CompletionClient` and an `ActorProfile` fixture whose markdown carries a
   distinctive marker line —
   - the step calls `complete` **exactly once**, with `MODELS.generation`,
     `reelScriptSchema` and a prompt containing the profile's marker line (4.2),
     the analysis' objective, highlights and target audience, and the
     Spanish-output instruction (4.6) — one call, because the single retry lives
     in the completion client (T10) and the step must not add a second one (4.4);
   - the profile comes from the step's input state (the run-scoped
     `ActorProfile`), not from the filesystem: no profile loader is injected and
     the step reads no file;
   - a valid response is stored as `script` with `hook`, `body` and `closing`,
     and the returned outcome has `status: 'ok'` carrying both `analysis` and
     `script` while preserving `rank`, `shortcode`, `thumbnailUrl` and `metrics`
     (4.1, 6.1);
   - a `SchemaValidationError` yields `failed` at `'generate-script'` with
     `reason` exactly `'invalid script response'`, keeping the same `ReelBase`
     fields (4.4, 6.1);
   - any other rejection (e.g. a provider transport error) yields `failed` at
     `'generate-script'` with that error's message as `reason` — not the fixed
     schema string (6.1);
   - an already-`failed` input (e.g. failed at `'transcribe'`) passes through
     unchanged and `complete` is never called.
2. **Implement (green):** The step on `withReelFailure('generate-script', …)`,
   calling `buildScriptPrompt({ analysis, profile })` and mapping
   `SchemaValidationError` — and only that error — to the fixed reason string.
   The completion client and the actor profile arrive through the injected
   container / run state; the run step that loads the profile lands later (T20),
   so this task's test supplies the profile directly and nothing here depends on
   T20.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- The actor profile rides on the reel state (`ReelWorkingState.profile`) rather than being loaded here — no profile loader is injected, so a filesystem read would throw. T20 puts it there.
- Exactly one `complete` call is asserted: the single retry belongs to the completion client (T10), and a second one here would silently double 4.4's budget.
- The `ok` outcome still carries `videoPath`/`audioPath` so T18's cleanup can find the temp files after the reel is finished.

**Outcome:** `generate-script` step, producing the reel's `ok` outcome; 6 tests, suite 146/146, typecheck clean.

### T18 — Reel step: `cleanup`

- **Status:** `[x]` Done
- **Traces to:** 2.5 → Design → `mastra/steps` (cleanup), "Thin steps, injected
  adapters"
- **Depends on:** T13, T14, T15

**Objective:** Once a reel is done, its downloaded video and extracted audio are
deleted from local storage — for failed reels too, and for whichever of the two
files actually exists — without ever changing the outcome it was given.

**TDD plan:**

1. **Test (red):** `src/mastra/steps/cleanup.test.ts` with an injected
   `FileRemover` (`{ remove(path: string): Promise<void> }`) that records every
   path it is asked to delete —
   - after a successful reel (state carrying `videoPath` and `audioPath`), the
     recorded removals are **exactly** those two paths — nothing else, in
     particular not the run's temp directory — and the `ok` outcome comes back
     deep-equal to the input (2.5);
   - a reel that failed at `'analyze'` — its transcript was stored, so 2.5
     applies, and both temp files exist — still gets both files removed, and the
     `failed` outcome comes back deep-equal to the input (2.5 must not be
     defeated by the pass-through rule);
   - a reel that failed at `'extract-audio'`, with `videoPath` on its state but
     no `audioPath`, removes exactly the video and never calls the remover with
     `undefined`;
   - a reel that failed at `'hydrate'`, with no paths on its state, removes
     nothing and does not throw;
   - a remover that rejects (file already gone) leaves the `ok` outcome
     untouched and never produces a `failed` outcome — cleanup is best-effort,
     and `'cleanup'` is deliberately not a member of `PipelineStep`, so it can
     never appear as a `failedStep`.
2. **Implement (green):** The step deliberately does **not** use
   `withReelFailure`'s pass-through: it reads whatever paths the state recorded
   regardless of status, removes each one that exists through the injected
   remover, swallows removal errors, and returns the outcome it was given.
   Default the remover to `fs.rm(path, { force: true })`, injected through the
   same container as the other adapters. Two deviations to record in the
   Decision log: the design draws `cleanup` as an ordinary pass-through step (a
   failed reel would keep its temp files), and the design names no filesystem
   interface, so `FileRemover` is introduced here. Update `design.md` if the
   reviewer prefers both stated there.
3. **Verify:** `npm run typecheck` && `npm test` — no real file is touched, the
   remover is faked.

**Decision log:**

- Deliberately does NOT use `withReelFailure`. Its pass-through rule would skip a failed reel, leaving that reel's downloaded video on disk forever — the design draws cleanup as an ordinary pass-through step, and following the drawing would defeat 2.5 for exactly the reels most likely to have big files.
- Introduced `FileRemover` (`{ remove(path) }`) in `RunDeps`; the design names no filesystem interface. Default implementation uses `fs.rm(path, { force: true })`.
- Removal errors are swallowed: cleanup is best-effort, and `'cleanup'` is deliberately not a member of `PipelineStep`, so it can never appear as a `failedStep`.
- Both deviations are worth reflecting in design.md if a reviewer prefers them stated there.

**Outcome:** `cleanup` step; 5 tests, suite 146/146, typecheck clean. No real file is touched — the remover is faked.

### T19 — `processReelWorkflow` composition

- **Status:** `[x]` Done
- **Traces to:** 6.1, 2.5, 7.3 → Design → `mastra/workflows/process-reel.ts`,
  "Two error classes, one rule"
- **Depends on:** T14, T15, T16, T17, T18

**Objective:** `processReelWorkflow` chains hydrate → download → extract-audio →
transcribe → analyze → generate-script → cleanup over injected adapters and,
run through Mastra's own engine, resolves with a `ReelOutcome`: `status: 'ok'`
for a healthy reel, a `failed` outcome — never a rejection — when any single
step fails, and a rejection only for a `FatalRunError`.

**TDD plan:**

1. **Test (red):** `src/mastra/workflows/process-reel.test.ts` with all-fake
   adapters, driving the workflow **through Mastra's run API** (create a run and
   start it with one ranked reel as input) rather than calling the step
   functions in sequence — the engine's composition, not a hand-rolled chain, is
   what this task verifies, and a test that chains the steps by hand would go
   green with no workflow at all.
   - the happy path resolves to a `ReelOutcome` with `status: 'ok'`, an
     `analysis` and a `script`, every fake called exactly once and in pipeline
     order (assert the order from a shared call log, not per-fake call counts);
   - the resolved value is a `ReelOutcome` and nothing more: `rank`,
     `shortcode`, `thumbnailUrl` and `metrics` survive, and the intermediate
     state (`videoPath`, `audioPath`, `transcript`) is not part of it — the
     composition projects run state onto the outcome;
   - a table-driven case per `PipelineStep` (`hydrate`, `download`,
     `extract-audio`, `transcribe`, `analyze`, `generate-script`): injecting a
     failure at that step resolves — does not reject — to `failed` at that step
     with its reason, no adapter of a later step was called, and `rank`,
     `shortcode`, `thumbnailUrl` and `metrics` survive (6.1);
   - cleanup ran and removed the temp video and audio in **both** the ok case
     and a failed-at-`analyze` case, and left the outcome unchanged (2.5 at the
     workflow level; T18 only proves the step in isolation);
   - a `FatalRunError('ig-session-expired')` thrown by the fake Instagram client
     during `hydrate` makes the workflow **reject** with that error instead of
     producing a failed outcome, and no later adapter ran (7.3 — the one
     exception allowed to escape).
2. **Implement (green):** Compose the seven steps with the workflow API pinned
   in T13 (chain, commit, export), and register `processReelWorkflow` on the
   Mastra instance if that version requires nested workflows to be registered;
   record the exact API shape in the Decision log. No new adapter or step logic
   here: if a case only passes by adding behaviour to a step, that behaviour
   belongs in T14–T18.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- **Found a real defect the isolated step tests missed.** `withReelFailure` rebuilt the failed outcome from base fields only, dropping `videoPath`/`audioPath` — so cleanup had nothing to delete for ANY reel failing after `download`, and every failed run leaked its video files. T18's test had supplied the paths directly on the state, so it passed while 2.5 was broken end to end. Fixed by carrying the temp paths onto the failed outcome. This is exactly why the plan insisted on driving the engine rather than chaining the steps by hand.
- **Mastra does not hand the original error instance back**: a thrown step error arrives on `result.error` as a serialized copy, so a `FatalRunError` lost its class and its `code`. The step wrapper now stashes the real instance on the runtime context and `runProcessReel` rethrows that, keeping 7.3's contract intact.
- Step and workflow I/O use `z.custom<ReelState>()` rather than a hand-written zod mirror of the union: our TypeScript types already govern the shape, and a parallel schema would be a second source of truth to keep in sync.
- A final `outcome` step projects the working state onto the published `ReelOutcome`, dropping `videoPath`, `audioPath`, `transcript` and `profile`. The test asserts the exact key set, so intermediate state cannot leak into the API response.
- Exported `runProcessReel(reel, deps)` as the callable contract — resolve with a `ReelOutcome`, reject only on a fatal — since Mastra's own result object reports step failures as `status: 'failed'` rather than rejecting.

**Outcome:** `processReelWorkflow` composed with Mastra and driven through its real run API; 11 tests, suite 157/157, typecheck clean.

### T20 — Run step: `preflight` (preconditions + actor profile)

- **Status:** `[x]` Done
- **Traces to:** 7.1, 7.2, 4.5 → Design → `mastra/steps`, `lib/preflight`,
  `lib/profiles` (Architecture: "preflight ──── assertPreconditions +
  loadActorProfile")
- **Depends on:** T3, T12, T13

**Objective:** The run's first step verifies the environment preconditions and
loads the requested actor's profile, lets `FatalRunError` propagate unwrapped,
and hands the run input plus the loaded profile to the next step — so a
misconfigured environment or an unknown actor aborts the run before anything is
fetched.

**TDD plan:**

1. **Test (red):** `src/mastra/steps/preflight.test.ts`, driving the step with
   the real `assertPreconditions` and `loadActorProfile` over an injected env
   object, `BinaryProbe` and profiles directory (never `process.env`, never the
   repo's real `profiles/`) —
   - with every precondition met and the actor's profile present, the step
     resolves carrying the run input's `account`, `actor`, `scan` and `top`
     through **plus** the loaded `ActorProfile`, so `discover` (T21) still sees
     `account`/`scan` and `generate-script` (T17) reads the profile off the run
     state (7.1);
   - a missing `IG_SESSIONID` rejects with the `FatalRunError` raised by
     `assertPreconditions` — `code` `'missing-ig-session'` and its message reach
     the caller **unwrapped** — and the profile loader was **never** called:
     preconditions are checked before any profile is read (7.2);
   - an unavailable `ffmpeg` likewise rejects with `'ffmpeg-unavailable'`
     (per-code coverage of every precondition stays in T3; what this layer adds
     is that the step delegates and does not swallow);
   - a requested actor with no profile, with every precondition met, rejects
     with `FatalRunError('unknown-actor')` naming the actor (4.5);
   - the step never turns a fatal into a reel-style value: assert the rejection
     is `instanceof FatalRunError`, and that the step does not go through
     `withReelFailure` (that helper is for per-reel steps only).
   Note: 7.1's "before downloading any content" and 4.5's "before retrieving any
   reel" are properties of the *chain* — asserted at the workflow level in T22,
   which checks no client method ran when preflight rejects.
2. **Implement (green):** The step calls `assertPreconditions(env, probe)` and
   then `loadActorProfile(profilesDir, actor)`, taking `env`, `probe` and
   `profilesDir` from the injected container (the design's "thin steps, injected
   adapters"), and returns `{ ...runInput, profile }`. Record in the Decision log
   where `profilesDir` comes from (the container's default being the repo's
   `profiles/`) and the exact shape of the run state the later steps read.
3. **Verify:** `npm run typecheck` && `npm test` — the suite must pass with no
   `IG_SESSIONID`, no `OPENROUTER_API_KEY` and no ffmpeg installed.

**Decision log:**

- Returns `PreflightState = RunInput & { profile }`, so `discover` (T21) still sees account/scan and `generate-script` (T17) reads the profile off the run state.
- Deliberately NOT wrapped in `withReelFailure` — that helper is for per-reel steps. A run-level fatal must abort, and the test asserts the rejection has no `status` property, i.e. it never became a reel-shaped value.
- Preconditions are asserted before the profile is loaded; the test injects a spy loader and asserts it was never called.

**Outcome:** `preflight` run step; 5 tests, suite 169/169, typecheck clean. Passes with no `IG_SESSIONID`, no `OPENROUTER_API_KEY` and no ffmpeg installed — env, probe and profiles directory are all injected.

### T21 — Run steps: `discover` and `rank`

- **Status:** `[x]` Done
- **Traces to:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 → Design → `mastra/steps`,
  `lib/instagram`, `lib/ranking`
- **Depends on:** T4, T5, T13, T20

**Objective:** The `discover` step pulls the account's scan-window reels through
the injected `InstagramClient`, keeping the client's most-recent-first order and
letting a `FatalRunError` abort the run; the `rank` step turns them into the
ranked selection that feeds the per-reel pipeline — `ReelBase` plus the
`mediaId` that `hydrate` needs.

**TDD plan:**

1. **Test (red):** `src/mastra/steps/discover-rank.test.ts` with a fake
   `InstagramClient` and the real `rankReels` —
   - `discover` calls `discoverReels(account, scan)` with exactly the run
     input's `account` and `scan` — assert with `scan: 50`, not 20, so a
     hard-coded scan window fails the test. `RunInput` types `scan` and `top` as
     required; the defaults (20 / 3) are applied where the run is started
     (T25), not here (1.1);
   - `discover` puts the client's reels on the run state **in the order
     received**, unmodified — most-recent-first is the adapter's contract (T5)
     and the step must not re-sort, which is what makes the tie-break in 1.3
     hold end to end;
   - a `FatalRunError('account-not-found')` from the client propagates out of
     the step: `discover` is a run-level step and is deliberately **not**
     wrapped in `withReelFailure`, so an empty or unreachable account aborts the
     run instead of becoming a reel failure (1.5);
   - `rank` applies `rankReels(reels, top)` with the input's `top` — assert with
     `top: 2` over five reels of distinct view counts: exactly two entries come
     back, ordered by `views` descending, with `rank` 1 and 2 (1.2, 1.6);
   - each ranked entry carries `rank`, `shortcode`, `thumbnailUrl` and
     `metrics { views, likes, comments }` (the design's `ReelBase`) **plus**
     `mediaId`, mapped from the matching `DiscoveredReel` — this is the value
     `processReelWorkflow` consumes, and `hydrate` (T14) needs `mediaId`;
   - two reels tied on `views` arriving most-recent-first keep that relative
     order through the step — assert both shortcodes by position (1.3);
   - two available reels with `top: 3` yields two ranked entries and no error
     (1.4).
2. **Implement (green):** Two thin run-level steps over the already-tested
   modules — `discover` takes the `InstagramClient` from the injected container
   rather than importing it; `rank` is pure and only maps
   `DiscoveredReel & { rank }` onto the per-reel workflow's input. The design
   names that input type (`processReelWorkflow // ReelInput -> ReelOutcome`) but
   never defines it, and `ReelBase` carries no `mediaId`: use
   `ReelInput = ReelBase & { mediaId: string }`, defined next to the data models
   in `src/lib/types.ts` if T14 has not introduced it already, and record the
   choice in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`; the suite must pass with no
   network and no `IG_SESSIONID` in the environment.

**Decision log:**

- Added `ReelInput = ReelBase & { mediaId: string }` to `src/lib/types.ts`. The design names this type for the per-reel workflow but never defines it, and `ReelBase` has no `mediaId` — which `hydrate` needs.
- `discover` is tested with `scan: 50`, not the default 20, so a hard-coded scan window fails the test. Defaults live where the run is started (T25), not in the step.
- `discover` preserves the adapter's most-recent-first order verbatim and never re-sorts — that is what makes 1.3's stable tie-break hold end to end rather than only inside `rankReels`.

**Outcome:** `discover` and `rank` run steps; 7 tests, suite 169/169, typecheck clean. No network, no `IG_SESSIONID`.

### T22 — `generateScriptsWorkflow` and `assemble`

- **Status:** `[x]` Done
- **Traces to:** 1.5, 4.2, 4.5, 5.4, 6.1, 6.2, 7.2, 7.3 → Design →
  `mastra/workflows/generate-scripts.ts`, "Two error classes, one rule"
- **Depends on:** T19, T20, T21

**Objective:** `generateScriptsWorkflow` chains preflight → discover → rank →
foreach(`processReelWorkflow`) → assemble and emits a `RunResult` ordered by
rank that still carries every successful reel when others failed, while a
`FatalRunError` from any step aborts the whole run.

**TDD plan:**

1. **Test (red):** `src/mastra/workflows/generate-scripts.test.ts` with fake
   adapters —
   - three discovered reels where the rank-2 reel's download fails resolve to a
     `RunResult` whose `reels` has three entries ordered by rank 1..3: two `ok`
     carrying `analysis`, `script`, `shortcode`, `thumbnailUrl` and
     `metrics { views, likes, comments }`, and one `failed` at `'download'` with
     its reason (6.1, 6.2, 5.4 — the run output must carry everything the page
     later presents, not just the script);
   - in that same run, the rank-3 reel's transcription and generation adapters
     were still called — one reel's failure does not stop the others (6.1's
     "continue processing the remaining reels");
   - the profile loaded by `preflight` reaches generation: the prompt handed to
     the fake completion client for `MODELS.generation` contains the fixture
     profile's marker line (4.2 end to end — T17 only proves it with an injected
     profile, this proves the run actually wires preflight's profile through);
   - a run in which *every* reel fails still resolves (three failed outcomes)
     rather than rejecting (6.2);
   - `account`, `actor` echo the input and `generatedAt` is an ISO-8601 string;
   - `assemble` sorts by rank even when the per-reel outcomes come back out of
     order (feed them reversed — under `foreach` concurrency the arrival order is
     not guaranteed, and the design's invariant is "always ordered by ascending
     rank");
   - an unknown actor rejects with `FatalRunError('unknown-actor')` and the fake
     client's `discoverReels` was **never** called — the abort happens before
     any reel is retrieved (4.5);
   - a 403 from `discoverReels` rejects with
     `FatalRunError('ig-session-expired')` and no reel was processed (7.3);
   - an empty account rejects with `FatalRunError('account-not-found')` (1.5);
   - a missing precondition rejects before any adapter runs (7.2);
   - in each of those four abort cases the rejected error still exposes its
     `code`, so T24b can map the run to `status: 'aborted'` with
     `error: { code, message }`.
2. **Implement (green):** Compose the workflow, implement `assemble` (sort by
   rank, stamp `generatedAt`), and register the workflow on the Mastra instance
   in `src/mastra/index.ts`. Put the run-scoped temp directory root (derived
   from the `runId`) on the run state right after `preflight` — T14, T15 and T18
   all assume `download`, `extract-audio` and `cleanup` share one per-run
   directory, and this composition is where it gets established. Let
   `FatalRunError` propagate untouched; if Mastra's persisted run record
   serializes only the message and drops `code`, record `{ code, message }` on
   the run state before it escapes so T24b has a real source, and log that
   deviation.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- `foreach` takes a Step, not a Workflow, so the nested per-reel workflow is invoked from inside a `process-reel` step that passes the SAME runtime context through. That is what carries both the injected adapters and the fatal-error stash across the nesting boundary.
- Each run-level step declares precise input/output types via `z.custom<T>()`. A shared `Record<string, unknown>` schema compiled and passed its tests but made `.then()` stop type-checking against the previous step — the chain's types collapsed to `never`. Worth knowing: with `z.custom` the engine validates nothing, so the step chain's typing is the only guard there is.
- The run-scoped temp directory is derived from the run id in `runGenerateScripts` rather than plumbed through run state — the steps read `deps.tmpDir`, and deps are already per-run, so one directory per run falls out without extra wiring.
- `assemble` sorts by rank rather than trusting arrival order: under `foreach` concurrency the order is not guaranteed, and the design's invariant is ascending rank.
- A test-helper bug worth recording: the fake completion client first distinguished analysis from generation by `prompt.includes('hook')`, but the ANALYSIS prompt also says "hooks", and both steps are pinned to the same model id. It now keys on the script prompt's opening line.

**Outcome:** `generateScriptsWorkflow` with `assemble`, registered on the Mastra instance; 7 tests here, suite 178/178, typecheck clean.

### T23 — Cap the per-run concurrency at 3 reels

- **Status:** `[x]` Done
- **Traces to:** 6.3 → Design → Architecture (`foreach(concurrency: 3)`),
  Testing strategy ("`generateScriptsWorkflow` never processes more than 3 reels
  at once")
- **Depends on:** T22

**Objective:** `generateScriptsWorkflow` never has more than three reels in
flight at the same time, whatever `top` is, and it throttles rather than drops —
with the limit held in one exported constant instead of a literal.

**TDD plan:**

1. **Test (red):** A `describe('concurrency')` block added to
   `src/mastra/workflows/generate-scripts.test.ts`, with fake adapters, **seven**
   discovered reels and a run input of **`top: 7`** — with the default `top: 3`
   only three reels are ever selected, so the test would pass with no cap at all;
   the extra reels are what make it real.
   - Instrument the fake `InstagramClient.hydrateReel` (the first per-reel
     adapter call, so entry into it means the reel is in flight):
     `entered++`, `active++`, `peak = Math.max(peak, active)`, `await release`
     (a deferred the test resolves), then `active--`.
   - Start the run **without awaiting it**; wait until `entered === 3` by
     flushing ticks (a bounded loop of `await new Promise(r => setTimeout(r, 0))`,
     never a fixed sleep), then flush several more ticks to give a missing cap
     the chance to start a fourth reel.
   - While the deferred is still pending, assert `entered === 3` and
     `peak === 3` — three reels in flight, a fourth never started (6.3).
   - Resolve the deferred, await the run, and assert it resolves with **seven**
     outcomes, all `ok`, ranks 1..7 — the cap throttles, it does not drop reels.
   - Assert `peak === 3` again after the run finished, so the limit held across
     the whole `foreach`, not only at the first checkpoint.
   - Assert the workflow module exports `MAX_REEL_CONCURRENCY === 3` — a cheap
     guard that the number lives in one named place.
2. **Implement (green):** Export `MAX_REEL_CONCURRENCY = 3` from
   `src/mastra/workflows/generate-scripts.ts` and pass it as the `foreach`
   concurrency option. If the Mastra version pinned in T13 does not accept a
   concurrency limit on `foreach`, run the per-reel workflows through a small
   bounded pool driven by the same constant instead, and record that deviation
   from the design's `foreach(concurrency: 3)` in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`. The suite must stay fast: the
   only waiting is the test-controlled deferred plus zero-delay ticks, no real
   timers.

**Decision log:**

- Mastra's `foreach` accepts `{ concurrency }` natively, so no bounded pool was needed — the design's `foreach(concurrency: 3)` is implemented literally.
- The test uses seven reels with `top: 7`. With the default `top: 3` only three reels are ever selected, so it would have passed against no cap at all — the extra reels are what make it a real assertion.
- `peak` is asserted both while the gate is held and again after the run completes, so the limit is shown to hold across the whole foreach rather than only at the first checkpoint.

**Outcome:** `MAX_REEL_CONCURRENCY = 3` exported and passed to `foreach`; 2 tests, suite 178/178, typecheck clean. The only waiting is a test-controlled deferred plus zero-delay ticks.

### T24a — Record each reel's current pipeline step

- **Status:** `[x]` Done
- **Traces to:** 5.3 → Design → Architecture (`foreach(concurrency: 3) →
  processReelWorkflow`), `app/api/runs` ("read run snapshot → RunView")
- **Depends on:** T19, T22

**Objective:** While a run is in flight, the run exposes — per selected reel —
the pipeline step currently executing for it, recorded explicitly by the
per-reel steps through an injected `ProgressRecorder`, so 5.3 has a real source
instead of depending on whether Mastra's persisted snapshot happens to expose
per-item progress inside a `foreach`.

**TDD plan:**

1. **Test (red):** `src/mastra/progress.test.ts`, plus additions to
   `src/mastra/workflows/process-reel.test.ts` (all-fake adapters, no network) —
   - `createProgressRecorder()`: `record(runId, shortcode, 'download')` then
     `read(runId)` returns `{ [shortcode]: 'download' }`; a later `record` for
     the same reel **overwrites** it (the *current* step, not a history);
     `read` of an unknown runId returns `{}`;
   - two reels under the same runId are tracked independently, and two runs
     never see each other's progress;
   - running `processReelWorkflow` with a recorder: while a fake `transcribe` is
     parked on a deferred promise, `read(runId)` reports `'transcribe'` for that
     reel — the step *currently* executing (5.3) — and reports
     `'generate-script'` once the pipeline reaches it;
   - the happy path records every step in pipeline order (assert the observed
     sequence);
   - a reel that failed at `'download'` does **not** advance past `'download'`
     while the later steps pass the failure through.
2. **Implement (green):** Add `ProgressRecorder` (`record`, `read`) with an
   in-memory implementation keyed by `runId` — a run's state is not durable
   ("Persistence and history" is out of scope) — injected through the Mastra
   container next to the other adapters. Record from **one** place:
   `withReelFailure(step, fn)` (T13) records `step` for the reel (runId from the
   step context, shortcode from the reel state) just before calling `fn`, so an
   already-`failed` pass-through records nothing and no step body repeats the
   call. This deviates from `design.md`'s note that the view is mapped from the
   Mastra snapshot alone: update the `app/api/runs` note in `design.md` to say
   5.3 reads this progress record, and log the deviation here.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Recorded from ONE place — `withReelFailure`, which every per-reel step already goes through. An already-failed pass-through records nothing, so a failed reel keeps showing the step it actually died on rather than advancing silently.
- In-memory and keyed by runId, shared per process via `getProgressRecorder()` so a poll can read a run started by an earlier request. Durability is out of scope.
- This deviates from design.md's note that the view is mapped from the Mastra snapshot alone — the snapshot is not assumed to expose per-item progress inside a `foreach`. design.md's `app/api/runs` note should be updated to say 5.3 reads this record.

**Outcome:** `ProgressRecorder` in `src/mastra/progress.ts`, wired into `withReelFailure`; 5 unit tests plus 3 through the real per-reel workflow, suite 217/217.

### T24b — Map a run snapshot to `RunView`

- **Status:** `[x]` Done
- **Traces to:** 5.3, 5.4, 5.6, 1.5, 4.5, 7.2, 7.3 → Design → `app/api/runs`
  ("the mapping snapshot → RunView is a pure function, tested on its own"),
  Data models → `RunView`
- **Depends on:** T2, T22, T24a

**Objective:** A pure `toRunView({ runId, input, snapshot, progress })` turns
what a run record holds — its status, the ranked reels, the finished `RunResult`
or the fatal error — plus T24a's progress record into the `RunView` the page
reads: in-flight reels expose the step running for them, finished reels their
analysis and script or their failure reason, and an aborted run its fatal code
and message.

**TDD plan:**

1. **Test (red):** `app/api/runs/run-view.test.ts` over hand-written values of
   the narrow `RunSnapshot` type this task defines
   (`{ status: 'running' | 'completed' | 'failed'; ranked?: ReelBase[];
   result?: RunResult; error?: { code: FatalCode; message: string } }`) — the
   pure function must not know Mastra's record shape; extracting a `RunSnapshot`
   from the real record is T26's job —
   - a running snapshot with three `ranked` reels and
     `progress = { <shortcode-2>: 'transcribe' }` maps to `status: 'running'`,
     with `runId` and `account`/`actor` echoed from the run input, and reel 2 as
     `{ status: 'pending', currentStep: 'transcribe' }` keeping `rank`,
     `shortcode`, `thumbnailUrl` and `metrics` (5.3);
   - a ranked reel with no progress entry yet is still present, pending at
     `'hydrate'` — every selected reel shows up while the run is in flight;
   - a running snapshot taken before `rank` finished (no `ranked`) maps to
     `status: 'running'`, `reels: []`, no `error` — what the first poll after
     `POST /api/runs` sees;
   - a completed snapshot maps to `status: 'completed'` with reels ordered by
     ascending `rank`, `ok` reels carrying `analysis` and `script` (5.4), the
     `failed` reel carrying `failedStep` and `reason` and **no** `analysis` or
     `script` (5.6), and no reel left `pending` even though the progress record
     still holds a step for it;
   - a snapshot that ended in a `FatalRunError` maps to `status: 'aborted'` with
     `error: { code, message }` and no reels — one case per fatal code that
     reaches the user: `account-not-found` (1.5), `unknown-actor` (4.5),
     `missing-ig-session` (7.2), `ig-session-expired` (7.3) — asserting the
     message is the operator-facing text (rotate the cookie, name the actor,
     name the missing variable);
   - the invariant holds: `error` is present **if and only if** `status` is
     `'aborted'`;
   - a failed snapshot whose error is not a `FatalRunError` (an unexpected
     crash) still maps to `'aborted'` and surfaces its message, so the page
     stops polling; `design.md`'s `FatalCode` union has no catch-all, so record
     in the Decision log how `code` is filled and update `src/lib/types.ts` and
     `design.md` together if it has to be widened;
   - purity: called twice with the same arguments it returns equal values and
     mutates neither `snapshot` nor `progress`.
2. **Implement (green):** `app/api/runs/run-view.ts` exporting `RunSnapshot` and
   `toRunView`. No I/O, no Mastra import, no `Date.now()` — everything it
   reports comes from its arguments.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- **Widened `FatalCode` with `'unexpected-error'`.** A run that dies on something no adapter raised still has to map to `status: 'aborted'` with an `error`, or the page polls forever a run that is never coming back. `src/lib/types.ts` is updated; design.md's FatalCode list should follow.
- `RunSnapshot` is a narrow hand-written type, deliberately not Mastra's record shape — extracting one from the other is T26's job, which keeps this function testable against literal values.
- A ranked reel with no progress entry defaults to `currentStep: 'hydrate'` rather than being hidden, so every selected reel appears from the first poll.
- Invariant asserted directly: `error` is present if and only if `status` is `'aborted'`.

**Outcome:** `toRunView` in `app/api/runs/run-view.ts`, pure; 12 tests, suite 217/217, typecheck clean.

### T25 — `POST /api/runs`

- **Status:** `[x]` Done
- **Traces to:** 5.1 → Design → `app/api/runs`
- **Depends on:** T22

**Objective:** `POST /api/runs` starts a run for `{ account, actor, top }` and
answers `201 { runId }` immediately — with the `runId` of the run that was
actually created, so `GET /api/runs/:runId` can already address it — without
ever awaiting the workflow.

**TDD plan:**

1. **Test (red):** `app/api/runs/route.test.ts`, importing the route module and
   calling the exported `POST(new Request(...))` directly. A route handler takes
   no injected container, so the seam here is a module mock (`vi.mock`) of
   `src/mastra`: the fake workflow's `createRunAsync()` resolves to
   `{ runId: 'run_test_1', start }`, and `start` returns a deferred the test
   controls.
   - a valid body `{ account: 'morningbrew', actor: 'juanse', top: 3 }` responds
     `201` with `{ runId: 'run_test_1' }` **while** `start`'s promise is still
     pending — resolve the deferred only *after* asserting the response; this is
     what proves the handler does not await the run (5.1);
   - the `runId` in the body is the one the created run reported, not an id
     minted by the handler — so the identifier returned to the user is the one
     T26 reads and T28 polls (5.1, and the precondition for 5.3);
   - `start` was called once with `{ account, actor, scan: 20, top: 3 }`: `top`
     from the body when present and defaulting to 3, `scan` always the default
     20 (the design's POST body is `{ account, actor, top }`; `scan` is not
     accepted from the client);
   - a body missing `account` or `actor`, or one that is not valid JSON,
     responds `400` and neither `createRunAsync` nor `start` was called;
   - a `top` that is not a positive integer (`0`, `-1`, `2.5`, `'three'`)
     responds `400`;
   - a run that aborts does not disturb the response already sent: reject the
     deferred with `FatalRunError('unknown-actor')` after asserting the `201`,
     flush microtasks, and assert a `process.on('unhandledRejection')` listener
     registered by the test never fired.
2. **Implement (green):** The handler validates the body, creates the run to
   obtain its `runId`, fires `start` **without** awaiting, keeps a module-level
   reference to the in-flight promise so it is not collected, and attaches a
   `catch` that only logs. That `catch` is deliberately not where 7.2/7.3 are
   handled: the aborted run's state is what Mastra persists and what
   `GET /api/runs/:runId` reports as `aborted` (T24b, T26). Respond `201` with
   `{ runId }` and no caching.
3. **Verify:** `npm run typecheck` && `npm test`; no test needs a real Mastra
   store, network access or API keys.

**Decision log:**

- The seam is a module mock of `src/mastra` — a route handler takes no injected container. `getGenerateScriptsWorkflow` and `buildRunDeps` are exported from there for exactly that reason.
- The 201 is asserted while `start`'s promise is still pending; releasing the deferred only afterwards is what actually proves the handler does not await the run (5.1).
- The in-flight promise is kept in a module-level Set so it is not collected after the response returns, and its `catch` only logs — an aborted run is reported through the poll as `status: 'aborted'`, never through this response.
- `scan` is fixed at 20 and never read from the body, matching the design's POST shape of `{ account, actor, top }`.

**Outcome:** `POST /api/runs`; 12 tests, suite 217/217, typecheck clean. No real store, no network, no API keys.

### T26 — `GET /api/runs/[runId]`

- **Status:** `[x]` Done
- **Traces to:** 5.3, 5.4, 5.6, 5.7 → Design → `app/api/runs`
- **Depends on:** T24a, T24b, T25 (this route reads the run under the id
  `POST /api/runs` minted; both handlers reach the run through the same
  accessor on the Mastra instance, and this one also reads T24a's progress
  record for in-flight reels)

**Objective:** `GET /api/runs/:runId` answers `200` with the `RunView` built by
`toRunView` from the run record and T24a's progress record, for a run the store
knows — running, completed or aborted alike — and `404 { error: 'run not
found' }` for an id it does not.

**TDD plan:**

1. **Test (red):** `app/api/runs/[runId]/route.test.ts`. Import the handler
   (`import { GET } from './route'`) and call it directly with a `Request` and
   `{ params: Promise.resolve({ runId }) }` — no HTTP server. Fake the snapshot
   source the way T25 fakes the start side (`vi.mock` over the run accessor
   exported by `src/mastra/index.ts`), so the test needs neither LibSQL nor a real
   run.
   - a running snapshot, together with a fake progress record for one reel,
     responds `200` and the body **equals**
     `toRunView({ runId, input, snapshot, progress })` computed in the test with
     that same progress — the handler shapes nothing itself, so per-reel
     `currentStep` is visible (5.3);
   - a completed snapshot responds `200` carrying, per reel in rank order, its
     analysis and script and, for the failed reel, its `failedStep` and `reason`
     (5.4, 5.6);
   - a snapshot whose run ended in a `FatalRunError` responds `200` — **not** 4xx
     or 5xx — with `status: 'aborted'` and `error: { code, message }`: an aborted
     run is data the page renders (T28), not a transport error;
   - the body's `runId` is the id taken from the URL;
   - an id the store does not know responds `404` with a body exactly
     `{ error: 'run not found' }` (5.7); a blank/whitespace id does the same,
     never a 500;
   - the response carries `Cache-Control: no-store`, so polling never reads a
     cached snapshot.
2. **Implement (green):** The route handler: `await` the Next 15 `params`
   (`{ params }: { params: Promise<{ runId: string }> }` — typing it as a plain
   object fails `tsc --noEmit` against Next's generated route types), read the run
   record through the Mastra instance's workflow-run API, return the 404 body
   when there is none, and otherwise extract T24b's narrow `RunSnapshot` from
   that record, read `progressRecorder.read(runId)` (T24a) for the in-flight
   progress, and call `toRunView({ runId, input, snapshot, progress })`,
   returning its result untouched. If the store's read API turns out to differ
   from the snapshot fixtures frozen in T24b, reconcile it in this route's
   extraction step rather than reshaping the pure mapper, and log the mismatch.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Booting the real app after T31 surfaced a defect every unit test had missed: `GET /api/runs/:id` for an unknown run answered **500, not 404**. libsql cannot create `.mastra/run-state.db` when the `.mastra/` directory does not exist (SQLite error 14), and the route tests mock the record reader, so nothing ever constructed the real store. Fixed with `ensureStorageDir`, covered by a regression test, and re-verified against the running app (`/` 200, unknown run 404, invalid POST 400).

- Added `readRunRecord(runId)` to `src/mastra`: it reads the stored run and narrows it to T24b's `RunSnapshot`. Reconciling Mastra's record shape lives here, as the plan required, so the pure mapper never learns the engine's format.
- The handler shapes nothing — the test asserts the body EQUALS `toRunView(...)` computed independently, so any future shaping in the route would fail.
- An aborted run answers 200, not 4xx/5xx: it is data the page renders (T28). Only an unknown or blank id is a 404, with the body exactly `{ error: 'run not found' }`.
- `params` is typed as a Promise per Next 15; a plain object fails `tsc --noEmit` against the generated route types.

**Outcome:** `GET /api/runs/[runId]`; 8 tests, suite 217/217, typecheck clean.

### T27 — Page: start-a-run form with the actor selector

- **Status:** `[x]` Done
- **Traces to:** 5.1, 5.2 → Design → `app/page.tsx`, `lib/profiles`, `app/api/runs`
  (the `POST` contract)
- **Depends on:** T12, T25

**Objective:** `/` replaces T1's placeholder page with a form for the account,
the actor — offering exactly the actors that have a profile — and the number of
reels; submitting it `POST`s `/api/runs` and keeps the returned `runId` in
client state for T28 to poll.

**TDD plan:**

1. **Test (red):** This is the suite's first component test. Add devDeps
   `jsdom`, `@testing-library/react` and `@testing-library/dom` (a *peer* of
   RTL 16 — it is not installed transitively). T1 sets Vitest's environment to
   `node`, so opt in **per file** with a `// @vitest-environment jsdom` docblock
   on the first line of each `.tsx` test rather than a config-level glob
   (`environmentMatchGlobs` is deprecated). T1's config leaves `globals` off, so
   RTL's automatic cleanup never registers: call `cleanup()` from an explicit
   `afterEach` imported from `vitest` in every UI test file, or a second
   `render` leaves the first tree mounted and `getByRole` matches twice.
   - `app/run-form.test.tsx` —
     - `RunForm` given `actors: ['ana', 'juanse']` renders exactly those two
       actor options and offers no free-text actor input — assert the rendered
       option values *equal* the prop, so no hard-coded or typed-in actor
       without a profile can be chosen (5.2);
     - filling account `morningbrew`, actor `juanse` and 3 reels and submitting
       calls the injected `startRun` exactly once with
       `{ account: 'morningbrew', actor: 'juanse', top: 3 }` and renders the
       `runId` it resolves with (5.1);
     - the number-of-reels field defaults to 3, matching `POST /api/runs`'s own
       default (T25), so the two defaults cannot drift;
     - the submit control is disabled while `startRun` is pending (resolve the
       deferred only after asserting), so one click cannot start two runs;
     - a rejected `startRun` — the route's `400` for an invalid body (T25) —
       shows the error message and leaves the entered account, actor and number
       in place.
   - `app/start-run.test.ts` (plain node environment) — the default transport
     `RunForm` uses when no `startRun` is injected: with an injected `fetch`,
     `startRun({ account, actor, top })` issues `POST /api/runs` with a JSON
     body of exactly those three fields and resolves with `runId` from the `201`
     response; a non-2xx rejects with a message naming the status. Without this
     the form is only ever exercised against a fake and its wiring to T25's
     route stays unverified until e2e (5.1).
   - `app/page.test.tsx` — with `src/lib/profiles` mocked, `render(await Page())`
     (RTL cannot render an async server component; awaiting the function yields
     a plain element tree) shows exactly the mocked actors as options, and
     `listActors` was called with the repo's `profiles` directory resolved from
     `process.cwd()` rather than a bare relative path (5.2).
2. **Implement (green):** `app/page.tsx` as a server component awaiting
   `listActors(path.join(process.cwd(), 'profiles'))` and passing the array to
   `app/run-form.tsx`, the `'use client'` component holding the form state and
   the returned `runId`; `app/start-run.ts` for the `POST /api/runs` call. Add
   `export const dynamic = 'force-dynamic'` to the page so a newly added profile
   appears without a rebuild — `next build` would otherwise prerender the actor
   list once. The design does not name a transport for 5.2: reading the profiles
   directory server-side and passing the list down is this task's choice; record
   it in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Added devDeps `jsdom`, `@testing-library/react` and `@testing-library/dom` (a peer of RTL 16, not installed transitively). jsdom is opted into per file with a `// @vitest-environment jsdom` docblock, since `environmentMatchGlobs` is deprecated.
- T1 leaves Vitest `globals` off, so RTL's automatic cleanup never registers — every UI test file calls `cleanup()` from an explicit `afterEach`.
- Did NOT add `@testing-library/jest-dom` for one matcher: `toBeDisabled` failed as an unknown Chai property, and asserting `button.disabled` directly is one line and one dependency fewer.
- The actor list is read server-side (`listActors` in the page) and passed down as a prop; the design names no transport for 5.2. `export const dynamic = 'force-dynamic'` keeps a newly added profile visible without a rebuild.
- `DEFAULT_TOP` is exported and asserted to equal the route's own default, so the two cannot drift apart silently.

**Outcome:** `app/page.tsx` (server component), `app/run-form.tsx`, `app/run-panel.tsx` and `app/start-run.ts`; 9 tests, suite 252/252, typecheck clean.

### T28 — Page: poll the run and show each reel's current step

- **Status:** `[x]` Done
- **Traces to:** 5.3, plus the user-facing half of 1.5, 4.5, 7.2, 7.3 → Design →
  "the UI polls a status endpoint", Scenario C ("the run ends as `aborted`, and
  the page shows ...")
- **Depends on:** T26, T27

**Objective:** Once a run starts, the page mounts a run view that polls
`GET /api/runs/:runId` about every 2 s and shows, per selected reel, the
pipeline step running for it, stopping when the run completes or aborts and
surfacing an aborted run's message as the copy the operator reads.

**TDD plan:**

1. **Test (red):** `app/run-status.test.tsx`, in the jsdom environment
   introduced in T27 (same opt-in mechanism — docblock or config glob), with
   `vi.useFakeTimers()` and an injected `fetchRunView(runId)` prop as the seam
   (a prop, not the global `fetch`, so no polyfill is needed); wrap each timer
   advance in `act` —
   - mounting `RunStatus` with a `runId` requests that id on mount and once more
     per ~2 s tick — advance the timers twice and assert the call count grows by
     exactly one each time, every call carrying that same `runId`;
   - a `running` `RunView` holding one reel at `transcribe` and one at
     `download` renders each pending reel's `currentStep` next to its `rank`
     (5.3) — two different steps on screen at once, so a single run-level label
     cannot pass;
   - in that same `running` view a reel already `ok` shows no current step — the
     step is reported per reel, not per run (5.3);
   - when a poll returns `status: 'completed'`, polling stops: advancing the
     timers by several intervals issues no further request;
   - an `aborted` `RunView` also stops polling and renders `error.message`
     verbatim — use the `ig-session-expired` message so the rotate-the-cookie
     instruction provably reaches the screen (7.3); the same path is what a user
     sees for `account-not-found` (1.5), `unknown-actor` (4.5) and
     `missing-ig-session` (7.2), so assert one of those renders its message too;
   - unmounting stops the polling (no request after unmount), so a finished run
     leaves no timer behind.
   Plus one wiring assertion in this file: the client component that holds the
   `runId` returned by T27's form renders `RunStatus` with that id once a run
   has started, and renders no run view before it.
2. **Implement (green):** `app/run-status.tsx` — a client component whose
   polling effect is driven by the injected fetcher, defaulting to a real
   `fetch('/api/runs/' + runId)` with `cache: 'no-store'`, with the interval in
   one named constant (`POLL_INTERVAL_MS = 2000`) and the effect cleared on
   unmount and on a terminal status. Wire it into the client component that owns
   `runId` (T27), which renders the form first and the run view once a run
   exists. Scope boundary: rendering a *completed* run's reel cards (metrics,
   analysis, script, failure reason) is T29 — here a completed or aborted run
   only has to stop polling and show its status or error.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- The fetcher is an injected PROP rather than the global `fetch`, so the jsdom tests need no polyfill and the seam is explicit.
- Polling stops on a terminal status and on unmount; both are asserted by advancing fake timers and checking the call count does not grow.
- The 'two different steps on screen at once' assertion is what rules out a single run-level label passing for per-reel progress (5.3).
- The aborted path renders `error.message` verbatim, asserted with the `ig-session-expired` text so the rotate-the-cookie instruction provably reaches the screen (7.3), plus an `unknown-actor` case (4.5).

**Outcome:** `app/run-status.tsx` polling every `POLL_INTERVAL_MS` (2000); 7 tests, suite 252/252, typecheck clean.

### T29 — Page: render the finished reels

- **Status:** `[x]` Done
- **Traces to:** 5.4, 5.6 → Design → `app/page.tsx`, Data models (`RunView`)
- **Depends on:** T28

**Objective:** A completed run shows, per reel in rank order, its rank, its
view/like/comment counts, and either its analysis and script or, when it failed,
its failure reason in their place — rendered by the same run view T28 polls, so
the results appear on the page as soon as a poll returns `completed`.

**TDD plan:**

1. **Test (red):** `app/run-results.test.tsx` (jsdom — the same opt-in T27
   introduced must cover this file) with a completed `RunView` holding two `ok`
   reels and one `failed` at `'transcribe'` —
   - the three cards render in ascending rank order and each card displays its
     own rank number, not just its position (5.4);
   - each `ok` card shows its view, like and comment counts, the analysis'
     objective, every highlight and the target audience, and the script's hook,
     body and closing (5.4);
   - the `failed` card shows its `reason` and the step it failed at, and renders
     no analysis and no script section — query for the analysis and script
     headings within that card and assert nothing is found (5.6);
   - a reel's thumbnail is rendered from `thumbnailUrl`;
   - **wiring:** in `app/run-status.test.tsx`, a poll returning
     `status: 'completed'` renders the results (assert a script's hook text is on
     screen), so 5.4 holds for the page and not only for a component tested in
     isolation.
2. **Implement (green):** `app/run-results.tsx` — the results list plus a reel
   card that branches on `status` — and render it from the run view component
   when the polled status is `'completed'`. Use a plain `<img>` for the
   thumbnail rather than `next/image`, which would need `images.remotePatterns`
   configured for Instagram's CDN host; record that choice in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Rendered by the same component tree `RunStatus` polls, so results appear as soon as a poll returns `completed` — no second fetch.
- A failed reel renders its reason in place of the analysis and script, and the test asserts the analysis text and the copy control are both ABSENT from that card, not merely that the reason is present.

**Outcome:** `app/run-results.tsx`; 10 tests shared with T30, suite 252/252, typecheck clean.

### T30 — Page: copy a script in one action

- **Status:** `[x]` Done
- **Traces to:** 5.5 → Design → `app/page.tsx`, Data flow Scenario A step 6
  ("a copyable script per reel")
- **Depends on:** T29

**Objective:** Every successful reel's card carries one control that copies that
reel's whole script — hook, body and closing, in that order — in a single click.

**TDD plan:**

1. **Test (red):** Extend `app/run-results.test.tsx` (T29's file and its
   completed `RunView` fixture: two `ok` reels and one `failed`), driving the
   copy through an injected `copy` function rather than the global clipboard —
   jsdom does not implement `navigator.clipboard`, so asserting on a hand-patched
   global would test the stub instead of the component's real copy path.
   - every `ok` card renders exactly one copy control and the `failed` card
     renders none — "each generated script" is covered, not just the first (5.5);
   - a single click on the rank-1 control calls `copy` exactly once with one
     string that contains that reel's `hook`, `body` and `closing` **in that
     order** (assert on their indexes, not mere containment) and contains none of
     the rank-2 reel's text (5.5);
   - clicking the rank-2 control copies the rank-2 script — each control is bound
     to its own card, one action per script;
   - after a resolved copy the control shows a readable confirmation (assert the
     visible text changes);
   - a `copy` that rejects (clipboard permission denied) leaves the card usable
     and shows a failure message instead of the confirmation, so the rejection is
     handled rather than unhandled.
2. **Implement (green):** A copy control on the script card taking an optional
   `copy` prop defaulting to `navigator.clipboard.writeText.bind(navigator.clipboard)`,
   and a pure `formatScript(script)` helper that joins hook, body and closing with
   blank lines so one definition governs the copied text. Always `catch` the copy
   promise. The design's `app/page.tsx` note does not describe a copy mechanism;
   record the injected seam and the chosen text format in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- `copy` is an injected prop defaulting to `navigator.clipboard.writeText` — jsdom does not implement the clipboard, so asserting on a hand-patched global would test the stub instead of the component's real path.
- Copied text is `hook

body

closing`, produced by one exported helper so the card and the clipboard cannot disagree. The test asserts ORDER by comparing indexes, not containment.
- The copy promise is always caught: a denied permission switches the control to a failure label and leaves the card usable, rather than surfacing an unhandled rejection.

**Outcome:** Copy control per successful reel plus the pure `formatScript`; covered by T29's file, suite 252/252.

### T31 — README: run the app and rotate the Instagram cookie safely

- **Status:** `[x]` Done
- **Traces to:** 7.4 → Design → operational safety; "Antes de producción" in
  `docs/research/ig-tools-bench/REPORT.md`
- **Depends on:** T1, T12, T27

**Objective:** The project README (`README.md` next to `package.json` — the git
root is the parent folder and carries no README of its own) documents how to
configure and run the system, states plainly that `IG_SESSIONID` must come from a
disposable Instagram account and never from Lab10's own, and says what to do when
that cookie expires.

**TDD plan:**

1. **Test (red):** `src/readme.test.ts` — placed under `src/` so both Vitest's
   default glob and T1's `tsconfig.json` `include` cover it (a repo-root test file
   would run under Vitest but escape `tsc --noEmit`). Resolve the file as
   `new URL('../README.md', import.meta.url)` rather than through `process.cwd()`,
   read it once, and assert:
   - it exists and is non-empty;
   - it mentions `IG_SESSIONID`, `OPENROUTER_API_KEY`, `ffmpeg`, `.env.local`,
     `profiles/`, `npm run typecheck` and `npm test`;
   - **the 7.4 assertion:** splitting the README into paragraphs on `/\n\s*\n/`,
     at least one paragraph contains `IG_SESSIONID` *and*
     `/(desechable|descartable|quemable|burner|disposable)/i` *and* `/lab10/i`
     *and* `/(nunca|never)/i` — the cookie comes from a throwaway account and
     never from Lab10's, said in one place rather than scattered across the file;
   - rotation is explained: some paragraph pairs `/(403|expir)/i` with
     `/(rotar|rotate)/i`, matching the operator message T7 attaches to
     `ig-session-expired`.
   The assertions are deliberately language-tolerant — the README may be written
   in Spanish (like `CLAUDE.md`) or English; record the language chosen in the
   Decision log. The test fails at first because there is no `README.md`.
2. **Implement (green):** Write `README.md`: what the system does and the stack;
   prerequisites (Node, installing `ffmpeg`); how to obtain a `sessionid` from a
   **disposable** Instagram account — never Lab10's, the risk
   `docs/research/ig-tools-bench/REPORT.md` calls out ("usa una cuenta quemable,
   no la de Lab10"), because scraping can get that account banned; copying
   `.env.local.example` to `.env.local` and filling `IG_SESSIONID` and
   `OPENROUTER_API_KEY`; the `profiles/<actor>.md` convention and how a new actor
   becomes selectable; `npm run dev` and starting a run from the page; the
   `npm run typecheck` and `npm test` commands; and a short "the cookie expired"
   section (a run aborts with `ig-session-expired` → pull a fresh `sessionid` from
   the disposable account, update `.env.local`, restart the process). Do **not**
   document `npm run test:e2e`: that script and the `e2e/` specs only exist after
   the `/verify-implementation` loop (see Open items).
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- The test lives under `src/` so both Vitest's glob and T1's tsconfig `include` cover it — a repo-root test would run but escape `tsc --noEmit`.
- The 7.4 assertion splits the README into paragraphs and requires ONE of them to carry `IG_SESSIONID`, a throwaway-account word, `lab10` and a negation together. Scattering those across the file fails, which is the point: the warning has to read as one instruction.
- The README also documents the long-lived-process constraint — a serverless deploy would cut a multi-minute run in half.

**Outcome:** `README.md` plus `src/readme.test.ts`; 9 tests, suite 252/252, typecheck clean.

---

## Open items

- **Unresolved design gap — exhausted transient failure during `discover`
  (needs a human decision).** `design.md` is ambiguous about one case: when an
  Instagram request keeps failing transiently (5xx/network) and the backoff in
  T7 is exhausted during `discover`, should the run abort as
  `FatalRunError('account-not-found')` (what the design's error table implies
  for "unreachable"), or surface as an unclassified error — which today has no
  `FatalCode` and therefore no `RunView.error` the page can show? Requirements
  1.5/7.2/7.3 only cover the fatal codes. Decide, then reconcile design.md's
  error table with T7, T22 and T24b.
- **Per-reel progress source (5.3).** Mastra's persisted snapshot is not assumed
  to expose the step in flight for each item of a `foreach`. T24a records it
  explicitly from `withReelFailure` into an in-memory, run-scoped
  `ProgressRecorder`, and updates `design.md`'s `app/api/runs` note accordingly.
  T24b maps that record into `RunView`.
- **Model IDs.** The design leaves the three OpenRouter model IDs to be pinned
  during implementation (T9). Record the pinned IDs and the date they were
  checked against the live model list.
- **Mastra API surface.** Package names, versions, the workflow-run read API and
  the dependency-injection mechanism (how a step reads `RunDeps`) are pinned in
  T13. T25 assumes a run id is available at creation time, before `start`
  resolves; T24b and T26 assume the run snapshot is queryable by `runId` from
  the LibSQL store.
- **Injection seams.** `createInstagramClient` (T5), `createFfmpegExtractor`
  (T8), the transcription client (T9) and the completion client (T10) need a
  test seam for their underlying library/process/transport; the design's
  published signatures do not show it. Keep the seam optional and internal, and
  log it.
- **Instagram fixtures.** The benchmark archived derived fields only, not raw
  `api/v1` payloads, so T5/T6 fixtures are reconstructed from
  `insta-fetcher@1.4.0`'s own `dist/types/*.d.ts` and from the shapes read in
  `docs/research/ig-tools-bench/e2e.mjs` and `bench_instafetcher.mjs`. Validate
  them against one real authenticated call before trusting them.
- **T5's `fetchUserReel` call shape vs. the vendored library (unresolved
  conflict between two planners' proposals).** T7's review of the vendored
  `insta-fetcher` source
  (`docs/research/ig-tools-bench/node_modules/insta-fetcher/dist/index.js`)
  found the real signature is `fetchUserReel(username, end_cursor = '', count)`,
  not `(username, null, count)` as T5's own TDD plan asserts, and that a
  nonexistent account most likely surfaces as an unresolved user id rather than
  a 404 rejection. T5's proposal was left as written (its own author's
  assertions were not second-guessed against T7's finding). Reconcile against
  the real library during T5's implementation; T7's "a 404/`FatalRunError` is
  never retried" rule depends on getting the actual failure shape right.
- **Cleanup on the failure path.** T18 deliberately deviates from the design's
  pass-through drawing so temp files are removed for failed reels too (2.5).
- **Temp storage layout.** T22 establishes the run-scoped temp directory
  (`tmp/<runId>/`, derived from the `runId`) on the run state right after
  `preflight`; T14/T15 write into it and T18's cleanup deliberately removes only
  the files it recorded, never the directory itself. If a run aborts mid-flight,
  its directory is left behind — acceptable for this slice, worth a later
  cleanup task.
- **`app/` directory placement vs. `design.md`.** `design.md`'s directory layout
  nests the Next.js app under `src/` (`src/app/page.tsx`, `src/app/api/runs/`),
  but T1's tsconfig `include` and every UI/API task (T24b–T30) use a
  repo-root `app/` instead — a valid, internally consistent Next.js layout, but
  a deviation from the design. Correct `design.md`'s layout diagram once the
  first route lands (T25), rather than letting both trees coexist.
- **Playwright / `npm run test:e2e`.** Not a task here: `playwright.config.ts`
  and the `e2e/` specs are produced by the `/verify-implementation` loop once
  every task is `Done`; T1 explicitly leaves `@playwright/test` out of
  `package.json` for that reason. Note that this project folder currently has
  no `.mcp.json`, even though `CLAUDE.md` says the Playwright MCP is
  "configurado en `.mcp.json`" (the sibling project has one) — that is a gate
  condition for the e2e loop, not a task in this spec, but the loop will stall
  on it until one is created.
