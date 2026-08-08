# E2E test report — Reel Script Generation

Spec: `docs/specs/2026-08-06-reel-script-generation/` · Plan: `e2e-tests-plan.md` · Suite: `e2e/reel-script-generation.spec.ts`
Produced by the `healer` subagent — diagnosis only, no code was modified.
**Turn 2 of the loop** (supersedes the turn-1 report; history lives in git).

## Verdict

**GREEN** — all three cases pass, twice, with `retries: 0`, and each one asserts
something its criterion actually demands. The single turn-1 failure was a test defect
and has been corrected at its source (the plan) as well as in the test; the turn-1
false green in the unit suite is gone.

## Run

Ran twice in this invocation. Identical results, near-identical timings — no flakiness.

```
npm run test:e2e → 3 passed / 0 failed   (run 1: 10.2s · run 2: 10.3s)

  ✓  1 e2e/reel-script-generation.spec.ts:90:5  › a completed run shows every reel with its analysis, its script and a working copy control (3.3s)
  ✓  2 e2e/reel-script-generation.spec.ts:210:5 › an aborted run shows the operator instruction verbatim and stops polling (5.6s)
  ✓  3 e2e/reel-script-generation.spec.ts:271:5 › a failed reel shows its reason while its siblings still deliver their scripts (647ms / 780ms)

  3 passed (10.2s)
```

`test-results/e2e-results.json` from the last run: `"expected": 3, "unexpected": 0,
"flaky": 0, "skipped": 0`. `playwright.config.ts` sets `retries: 0`, so these are raw
first results both times — no pass was rescued by a retry.

Baselines confirmed in this invocation:

```
npm test        → 255 passed / 32 files (2.21s)
npm run typecheck → clean (no output)
```

Case 3 dropped from **5.7 s to ~0.7 s**. That is the signature of the turn-1 fix: the
5 s it used to spend was the `toHaveText` timeout on the file's last assertion, and
every assertion before it already passed. Nothing else in the case changed behaviour.

No real Instagram or OpenRouter call was made: all three cases are served entirely from
`page.route()` fixtures, and fixture-only strings (`HOOK UNO`, `run_e2e_1`) appear in
the assertions, so a silent interception failure could not produce a green.

## What changed since turn 1, verified rather than assumed

| Change | Author | Verified how |
|---|---|---|
| Rank-ordering invariant stays server-side; `app/run-results.tsx` unchanged | user's ruling | Read `app/run-results.tsx:41` — still `view.reels.map(...)`, no sort. Correct per the ruling. |
| `e2e-tests-plan.md` Case 3 now mandates ascending rank, with a note on why `3, 1, 2` was wrong | `/plan-test-cases` | Read plan lines 143–154. The note is there and is accurate, so `generate-tests` cannot re-derive the broken fixture. |
| `app/run-results.test.tsx` false green fixed | executing agent (TDD) | Read the file. Test renamed to `renders every reel, in the order the API gave them`, asserts against `completed.reels.map(r => '#' + r.rank)`, comment names `run-view.ts` / `generate-scripts.ts` as the owners. 10 tests in that file, all passing inside the 255. |
| `e2e/reel-script-generation.spec.ts` Case 3 fixture reordered to ascending, stale comments removed, `['#1','#2','#3']` kept as a regression guard | `generate-tests` | Read lines 276–331 and re-ran the suite myself. Matches the claim; 3 passed confirmed independently, not taken on report. |

Server-side ownership of the invariant re-confirmed at all three points, so the
diagnosis that turn 1 rested on still holds:

- `src/mastra/workflows/generate-scripts.ts:93` — `reels: [...inputData].sort((a, b) => a.rank - b.rank)`
- `app/api/runs/run-view.ts:44` (completed) and `:56` (running) — sorted on every branch that can carry reels
- `app/api/runs/run-view.test.ts:56-75` — feeds `toRunView` a `3, 1, 2` fixture and asserts `[1, 2, 3]`

## Case by case

### Case 1 — A completed run shows each reel's analysis and script · PASS · —

- **Traces to:** 5.1, 5.2, 5.3, 5.4, 5.5
- **Observed:** actor `<select>` offers exactly `juanse` and is selected; `Reels`
  defaults to `3`; submitting shows `Run: run_e2e_1`; while `running`, `transcribe` and
  `download` are visible simultaneously; after the transition to `completed`,
  `[data-testid="reel-1"]` carries `#1`, `6900000 views`, `412000 likes`,
  `1820 comments`, the "Análisis" and "Script" headings, the objective, both highlights
  and `HOOK UNO` / `CUERPO UNO` / `CIERRE UNO`; `reel-2` carries `HOOK DOS`; clicking the
  copy control flips its label to `Copiado`.
- **Expected:** exactly that, per 5.1–5.5.
- **Diagnosis:** genuine pass, unchanged from turn 1. The assertions are card-scoped, so
  they prove the content sits on the *right* reel rather than merely existing on the
  page. The `running → completed` transition is gated on the test having seen the running
  view, so 5.3 and 5.4 are each exercised instead of one masking the other. `Copiado`
  renders only when the clipboard promise resolves (rejection renders
  `No se pudo copiar`), so 5.5 is proven, not assumed. The 5.2 assertion is correctly
  anchored: `profiles/` holds exactly `juanse.md`, verified this turn.
- **Reproduced manually:** not needed — passes on both runs and its assertions are
  substantive. The hydration mitigation it depends on was verified in the browser in
  turn 1 and is unchanged.
- **Recommended fix:** none.

### Case 2 — An expired Instagram cookie aborts the run · PASS · —

- **Traces to:** 7.3 (same aborted-render path as 1.5, 4.5, 7.2)
- **Observed:** the alert inside `<main>` reads the operator instruction verbatim,
  including `Rotate IG_SESSIONID with a fresh cookie from a disposable account.`; zero
  `[data-testid^="reel-"]` cards; no further `GET /api/runs/run_e2e_2` in a 5 s window
  after the alert appeared, and the intercept counter did not move.
- **Expected:** exactly that, per 7.3.
- **Diagnosis:** genuine pass. The polling-stop half is a real assertion rather than a
  sleep — `waitForRequest` resolves early and fails the test the moment a rogue poll
  fires. Scoping the alert to `<main>` is necessary, not cosmetic: Next.js keeps an empty
  `role="alert"` route announcer in a shadow root outside the app's markup. The 5.6 s
  runtime is that deliberate observation window, not slowness.
- **Reproduced manually:** in turn 1 — only 2 `GET`s for a terminal run (React Strict
  Mode double-invokes the effect in dev) and the interval cleared on the terminal status
  (`app/run-status.tsx:36-38`). Nothing in this turn touched that path.
- **Recommended fix:** none.

### Case 3 — A failed reel shows its reason, and the rest still deliver · PASS · —

- **Traces to:** 5.6, 6.2, user-visible half of 6.1
- **Observed:** three cards render; `reel-2` shows `#2`, `1200000 views`, an alert
  reading `video not available (404)`, zero "Copiar script" buttons and neither the
  "Análisis" nor the "Script" heading; `reel-1` and `reel-3` each show their full
  hook/body/closing and exactly one "Copiar script" button; the `h3` order is
  `#1, #2, #3`.
- **Expected:** 5.6 — the reason in place of the analysis and script; 6.1 — the failed
  reel labelled rather than dropped; 6.2 — the successful reels still delivered.
- **Diagnosis:** genuine pass, and the turn-1 defect is closed at its root. The failure
  was never the app: the fixture demanded that the client re-sort a payload the real API
  provably cannot emit, an expectation no criterion in `requirements.md` assigns to the
  page. The user's ruling kept the invariant server-side, the plan now records why the
  `3, 1, 2` payload was wrong, and the test's fixture is contract-faithful. `run-results.tsx`
  was correctly left untouched.
- **Reproduced manually:** not needed this turn — the counterfactual was already run in
  the browser in turn 1 (contract-faithful payload → `h3Order ["#1","#2","#3"]`,
  `reel-2` alert `video not available (404)`, 0 buttons, 0 `h4`s), and the suite now
  reproduces exactly that outcome unattended, twice.
- **Recommended fix:** none. One thing to record, not to change — see below.

## Notes for whoever maintains this suite

These are not defects. They are places where the suite says less than it looks like it
says, or is more fragile than it looks. Recording them so nobody later reads them wrong.

1. **Case 3's `['#1','#2','#3']` is a weaker guard than its history suggests.** Against
   an ascending payload it passes for *any* renderer that preserves array order, which
   `RunResults` does by construction. It still earns its place — it catches a future
   change that drops a card, duplicates one, or groups failed reels last — but it is
   **not** the ordering test, and treating it as one would be a mistake. The real
   ordering guarantee is `app/api/runs/run-view.test.ts:67` (`orders by rank and carries
   analysis and script`), which feeds an out-of-order `3, 1, 2` result and asserts
   `[1, 2, 3]`, plus the `assemble` sort in `generate-scripts.ts:93`. If either
   server-side sort is ever removed, those unit tests fail and this e2e case does not.
   Agreed with `generate-tests`' note.

2. **`waitForHydratedForm` is the most upgrade-fragile line in the suite.** It probes
   React's internal `__reactProps$<id>` key on the `<form>` because the page exposes no
   user-facing hydration marker. The mitigation is load-bearing, not defensive padding:
   the `<form>` has no `action`/`method`, so a pre-hydration click fires a native GET to
   `/?account=…` and no run ever starts — a failure that looks nothing like its cause.
   Expect it to break on a React/Next major upgrade, and expect the breakage to surface
   as `waitForFunction` timing out. The fix at that point is to find the new internal
   key **or** to give the app a real hydration marker; the latter is an app change and
   would need a spec decision, so it is not recommended here. Agreed with
   `generate-tests`' note.

3. **`git diff` reviews nothing in this project.** The git root is the parent directory
   (`/Users/.../builders-content-projects`) and this project is entirely untracked —
   `git status --porcelain` returns exactly `?? 06-social-media-scripts/`. Verified this
   turn. All review here has to be done by reading files; a clean `git diff` means
   nothing. Agreed with `generate-tests`' note, and it applies to this report's own
   verification of turn-1 changes.

## False greens

**None.** The turn-1 false green is fixed and I re-read the replacement rather than
trusting the description: `app/run-results.test.tsx:81` is now
`renders every reel, in the order the API gave them` and asserts
`expect(headings).toEqual(completed.reels.map((reel) => '#' + reel.rank))`, with a
comment stating outright that this is *not* an ordering guarantee and naming
`run-view.ts` / `generate-scripts.ts` as where that guarantee lives. Deriving the
expectation from the fixture is the honest move here: the assertion now proves
completeness and preservation (no reel dropped, added, mislabelled or shuffled), which
is a real property, and its title no longer claims the ordering property it never
tested. The misleading claim, not the assertion, was the defect.

Re-checked the three e2e cases for vacuous assertions and found none: every case
asserts fixture-only strings, scoped to the card or region that owns them, and the two
absence-assertions (polling stops, no copy button on a failed reel) are both real
observations rather than sleeps.

One residual limit, deliberate and unchanged: Case 1 proves the copy control's promise
resolved (`Copiado`) but never reads the clipboard back, so it does not prove the
copied *contents*. That assertion exists at unit level
(`app/run-results.test.tsx:107` — order, not mere containment, plus a cross-card
negative). 5.5 is covered across the two levels; the e2e covers the "single action +
confirmation" half. A boundary, not a gap.

## Blocked / not verifiable

- **A live end-to-end run** (real Instagram + OpenRouter). Excluded by the plan on
  purpose and not attempted here. **Nothing in this report speaks to whether a real run
  produces a usable script** — every case stops at the `page.route()` boundary. One
  manual smoke run against a small account with `Reels = 1` is still owed before anyone
  relies on the output. This is the one thing standing between "the suite is green" and
  "the feature works".
- **The pipeline criteria** (1.1–4.6, 6.3, 6.4, 7.1) never cross the browser boundary
  and are covered by the 255 unit and workflow tests, per the plan's own coverage table.
- **5.7** (404 for an unknown run id) is an HTTP assertion, covered in
  `app/api/runs/[runId]/route.test.ts`. **7.4** (README warning) is covered in
  `src/readme.test.ts`.

## For the user

**Nothing blocking.** The one spec question raised in turn 1 — where the ascending-rank
invariant lives — you ruled on: it stays server-side, `requirements.md` and `design.md`
unchanged. The loop implemented exactly that ruling and the suite is green under it.

Two items for your awareness, neither of which the loop should act on unilaterally:

1. **One manual smoke run is still owed** (see *Blocked*). The automated suite proves the
   browser half of Requirement 5 and the user-visible half of 6; it deliberately proves
   nothing about a live run.
2. **`design.md` still has two open mismatches with the code**, both recorded in the plan
   and neither affecting these tests: it assumes port 3000 where the app and
   `playwright.config.ts` use **3001**, and it draws the UI under `src/app/` where the
   code has it at the repo-root `app/`. They are documentation drift, already noted as an
   open item in `tasks.md` — worth a cleanup pass in `/specify` at some point, not now.
