---
name: planning-tasks
description: >-
  Orchestrates the `planner` subagent to fully converge a feature spec's
  tasks.md (Phase 3 of the spec workflow): bootstraps the task list when none
  exists, then iterates EVERY task one by one until each reaches CRITERIA MET —
  the goal is 100% of tasks.md validated against the approved requirements.md
  and design.md and the real state of the codebase. Use this WHENEVER the user
  wants to create, re-plan, iterate, converge, or audit the task list of a spec
  — phrases like "plan the tasks", "iterate tasks.md", "planear las tareas",
  "itera el tasks.md", "audita las tareas", "replan after the spec change", or
  right after design.md is approved and before TDD execution starts. Trigger
  even if the user doesn't mention tasks.md by name, as long as they want the
  implementation plan of a spec produced or validated.
---

# Planning tasks — converge a spec's tasks.md via planner subagents

This skill is the **orchestrator** for Phase 3 of the spec workflow
(`/brainstorming` → `/specify` → `/planning-tasks` → TDD execution). It is
normally invoked from `/specify` right after `design.md` is approved, but it
also runs standalone — to re-plan after a spec change or audit an existing
`tasks.md` before execution. It does not judge or edit `tasks.md` itself — that is the job of the `planner` subagent
(`.claude/agents/planner.md`). Your job is to launch that agent with the right
mode, track verdicts, and keep going until **every task in `tasks.md` has been
iterated to `CRITERIA MET`**. Partial convergence is not done: a task list
where only some tasks were audited gives false confidence, because the
un-audited tasks are exactly where sizing and coverage problems hide.

## Input — the spec folder

You need a spec folder `docs/specs/<YYYY-MM-DD>-<feature>/` containing an
**approved** `requirements.md` and `design.md`. Resolve it like this:

- If the user named a feature or folder, use it.
- If `docs/specs/` contains exactly one spec, use that one and say so.
- If there are several and the conversation doesn't make it obvious, ask.

If `requirements.md` or `design.md` is missing, stop and point the user to
`/specify` — planning tasks against an unapproved or missing design produces a
plan for the wrong feature.

## Decide the starting point

Read the spec folder and check `tasks.md`:

- **No `tasks.md`, or one that is empty / a bare template / explicitly needs
  re-planning** → start with one planner in **bootstrap** mode (step 1 below).
- **A `tasks.md` with real tasks** → skip bootstrap and go straight to the
  per-task loop (step 2), covering every task that is not `[x] Done`.

## Step 1 — Bootstrap (single subagent)

Launch **one** `planner` subagent (Agent tool, `subagent_type: "planner"`):

```
Spec folder: docs/specs/<date>-<feature>/
Mode: bootstrap
<any relevant context from the conversation: recent spec changes, user
constraints, tasks the user already knows they want>
```

Bootstrap always returns `NEEDS ITERATION` by design — a freshly drafted list
has never been checked task-by-task. When it returns, **re-read `tasks.md`**
to get the actual task IDs it created, then continue with step 2.

## Step 2 — Per-task iteration loop (one subagent per task)

Build the work queue from the **Task overview** section of `tasks.md`: every
task ID whose status is not `[x] Done`, in order. Track it visibly (todo list)
so the user can see progress toward 100%.

Then, **one task at a time, sequentially**:

```
Spec folder: docs/specs/<date>-<feature>/
Mode: T<n>
<if this is a re-iteration: paste the previous verdict's NEXT/FINDINGS so the
agent resolves exactly what blocked convergence, plus any user answer you
obtained in the meantime>
```

Sequential is not an optimization choice — it's a correctness requirement.
Every planner edits the same `tasks.md`, so parallel runs would overwrite each
other's edits, and each evaluation must see the file as the previous one left
it (splits, renumbering, coverage-table updates).

Handle each verdict:

- **`CRITERIA MET`** → mark that task converged, move to the next in queue.
- **`NEEDS ITERATION`** → re-invoke the planner for the **same task**, feeding
  it the verdict's `NEXT` guidance. Cap at **3 iterations per task**: if a task
  still hasn't converged after 3, something structural is wrong (usually a spec
  gap) — stop and surface it to the user instead of churning.
- **The verdict names an open question or spec gap only the user can decide**
  → pause the loop, ask the user (concise, with your recommendation), then
  re-invoke that task's planner with the answer. Never guess an answer on the
  user's behalf — the whole point of convergence is consensus with the spec,
  and the spec's owner is the user.
- **The verdict reports a split** (e.g. T3 → T3a/T3b) or new tasks → add the
  new IDs to the queue. New tasks have not been iterated and must earn their
  own `CRITERIA MET`.
- **The verdict flags problems in *other* tasks** → if those tasks are still
  ahead in the queue, just pass the finding along when their turn comes; if
  they were already converged, put them back in the queue — a converged
  verdict is invalidated by new evidence.

Keep every planner invocation to **one mode and one task** — that's the
agent's contract, and batching tasks into one call is how audits get shallow.

## Step 3 — Completion check and report

The goal state: **every task in the final `tasks.md` has a `CRITERIA MET`
verdict from this session** (or is `[x] Done`, which is historical fact and
out of scope). Before declaring done:

1. Re-read `tasks.md` end to end. Confirm the Task overview, the detailed
   tasks, and the Requirements coverage table are in sync, and that no task
   appeared that never went through the loop.
2. If the coverage table has a criterion with no task, the plan is incomplete
   — send the gap back through the planner (usually as an iteration on the
   nearest related task, or bootstrap-level findings for the user).

Then report to the user, in their language:

- Tasks converged (count and IDs), with anything notable per task in one line
  (splits, removals, rewrites — pull these from the verdicts' `CHANGES`).
- Findings that need their attention: spec gaps, conflicts with `Done` tasks,
  tasks that hit the iteration cap.
- The explicit statement that `tasks.md` is 100% iterated and ready for their
  approval before TDD execution starts (the approval gate belongs to the
  user, not to this skill).

## Scope guardrails

- This skill **plans**; it never implements tasks, and neither do its
  subagents. If the user wants execution, that's the next stage of the
  workflow, after they approve `tasks.md`.
- Never edit `tasks.md` yourself — all edits go through the planner, so the
  file's history has a single author with a single set of criteria. The one
  exception: none. If you spot a problem, that's an input to the next planner
  invocation, not an edit you make.
- Don't touch `requirements.md` or `design.md`. Gaps found there are reported
  to the user; changing them re-opens earlier approval gates and belongs to
  `/specify`.
