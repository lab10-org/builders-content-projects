---
name: verify-implementation
description: >-
  Runs the autonomous end-to-end verification loop for a feature spec once its
  implementation is finished: it confirms the spec is really implemented (tasks
  Done, typecheck and unit tests green), then drives plan-test-cases →
  generate-tests → healer until the e2e suite reflects the spec and the report
  has no open defects. Use this WHENEVER the implementation of a spec has just
  been completed or the user wants the feature verified end to end in the
  browser — phrases like "verify the implementation", "verifica la
  implementación", "corre el loop e2e", "run the e2e loop", "the spec is
  implemented, now validate it", "levanta los tests e2e de este spec", or right
  after the last task of tasks.md is marked Done. Trigger even if the user
  doesn't name the skill, as long as they want a finished spec validated against
  the running app rather than just unit-tested.
---

# Verify implementation — the autonomous e2e loop

This skill is the stage **after** TDD execution in the project workflow
(`/brainstorming` → `/specify` → `/planning-tasks` → execution → **this**). It
closes the loop between "the tasks say Done" and "the feature actually works in
the browser".

You are the **orchestrator**. You do not write test plans, test code, or the
report yourself — each of those belongs to a component below, and each writes
exactly one artifact. Your job is to run them in order, read what they return,
and decide whether the loop turns again.

```
implementation finished
        │
        ▼
  [this skill]  gate: tasks Done, typecheck + unit tests green
        │
        ▼
  [skill] plan-test-cases   → docs/specs/<spec>/e2e-tests-plan.md   (3 cases)
        │
        ▼
  [subagent] generate-tests → e2e/*.spec.ts                          (Playwright)
        │
        ▼
  [subagent] healer         → docs/specs/<spec>/e2e-tests-report.md  (verdict)
        │
        ├── report clean ────────────────► done, report to the user
        └── report blames the code ──────► fix the code (back to execution), loop again
```

## Step 0 — Resolve the spec

Work on one spec folder `docs/specs/<YYYY-MM-DD>-<feature>/`:

- If the user named a feature or folder, use it.
- If `docs/specs/` has exactly one spec, use it and say so.
- If several exist and the conversation doesn't disambiguate, ask which.

Read `requirements.md`, `design.md` and `tasks.md` — you need them to gate, and
the components downstream re-read what they need.

## Step 1 — Gate: is the implementation really finished?

The loop verifies a *finished* feature; running it against half-built code
produces noise, not signal. Before anything else:

1. **Task status.** Every task in `tasks.md` is `[x] Done`. If some are not,
   stop and tell the user which ones remain — do not e2e-test a partial feature.
   Exception: the user explicitly asks to run the loop anyway; then say plainly
   which criteria are expected to fail.
2. **Suite health.** Run from the project root and capture real output:

   ```bash
   npm run typecheck
   npm test
   ```

   Red on either one stops the loop: fix that first, at the unit level, where
   the feedback is cheaper. Never start the browser loop over a red suite.
3. **App boots.** `npm run dev` must serve the app on `http://localhost:3000`.
   The Playwright config starts it automatically (`reuseExistingServer`), so you
   don't need to launch it by hand — but if the app can't boot (missing
   `.env.local`, missing key for the AI route), say so now: that is a blocked
   loop, not a failing test.

If a task is marked Done but you doubt it, that is what the **`task-verifier`**
subagent is for — invoke it on that task before spending a browser run.

## Step 2 — Plan the test cases

Invoke the **`plan-test-cases`** skill with the resolved spec folder. It reads
`requirements.md` + `design.md` and writes
`docs/specs/<spec>/e2e-tests-plan.md` with exactly **three** cases: one happy
path and two failure paths.

Do not draft that file yourself. If it already exists and the spec has not
changed since, reuse it — say so instead of regenerating.

## Step 3 — Generate the tests

Launch the **`generate-tests`** subagent, passing the spec folder and the plan
path:

```
Agent({
  subagent_type: "generate-tests",
  description: "Generate e2e specs",
  prompt: "Spec folder: docs/specs/<date>-<feature>/\nPlan: docs/specs/<date>-<feature>/e2e-tests-plan.md\nWrite the Playwright specs for all three planned cases into e2e/."
})
```

It explores the running app through the **Playwright MCP** to ground its
selectors in the real DOM, then writes `e2e/<feature>.spec.ts`. It returns the
files it wrote and the case → test mapping. It is the only component allowed to
write under `e2e/`.

## Step 4 — Run and diagnose

Launch the **`healer`** subagent on the same spec folder. It runs
`npm run test:e2e`, reproduces failures in the browser when it needs to, and
writes `docs/specs/<spec>/e2e-tests-report.md`.

The healer **never edits tests or source code** — deliberately. Its value is the
diagnosis: for every failing case it decides whether the *test* is wrong (bad
selector, wrong assumption about the flow) or the *code* is wrong (the app does
not satisfy the criterion), and it says which, with evidence.

## Step 5 — Decide whether the loop turns again

Read the healer's verdict and route:

- **GREEN** — all three cases pass. The loop ends. Report to the user: the spec
  is verified end to end, with the plan, the specs and the report as artifacts.
- **TEST DEFECT** — the healer blames the tests. Re-launch `generate-tests` with
  the healer's findings pasted into the prompt so it corrects those specs, then
  go back to Step 4. Never patch `e2e/` yourself: one author per artifact.
- **CODE DEFECT** — the healer blames the app. This is the loop's real output:
  the feature does not meet its own spec. Return to execution — fix the code
  under TDD (a failing unit test first, when the defect is expressible at that
  level), record it in the task's Decision log, then re-run from Step 1.
- **BLOCKED** — the app can't boot, a key is missing, the flow needs a real
  external service. Relay exactly what is blocking and what the user must do.

**Stop after 3 turns of the loop** without reaching GREEN. Report what is still
failing and why the loop is not converging — an autonomous loop that keeps
turning on the same failure is burning tokens, not finding bugs. Also stop and
ask if the fix the healer implies would change `requirements.md` or `design.md`:
changing the spec is the user's call, and it belongs to `/specify`.

## Scope guardrails

- **One writer per artifact.** `plan-test-cases` owns the plan, `generate-tests`
  owns `e2e/`, `healer` owns the report. You own none of them — you own the
  routing and the message to the user.
- **Browser automation is the Playwright MCP** (`mcp__playwright__*`), per
  `CLAUDE.md`. `claude-in-chrome` is denied in `.claude/settings.json`.
- Never weaken or delete a test to make the loop green. A test that fails
  because the app is wrong is the loop working as designed.
- Report honestly: if the loop ended without reaching GREEN, say so with the
  failing output — never round a partial result up to "verified".
