---
name: planning-tasks
description: >-
  Produces or converges a feature spec's tasks.md (Phase 3 of the spec
  workflow) by launching the `converge-tasks` dynamic workflow: it ensures the
  spec has an approved requirements.md and design.md, then hands the spec folder
  to the workflow, which fans out read-only planners over every task and writes
  the final tasks.md once. Use this WHENEVER the user wants to create, re-plan,
  iterate, converge, or audit the task list of a spec — phrases like "plan the
  tasks", "iterate tasks.md", "planear las tareas", "itera el tasks.md", "audita
  las tareas", "replan after the spec change", or right after design.md is
  approved and before TDD execution starts. Trigger even if the user doesn't
  mention tasks.md by name, as long as they want the implementation plan of a
  spec produced or validated.
---

# Planning tasks — launch the converge-tasks workflow

This skill is Phase 3 of the spec workflow
(`/brainstorming` → `/specify` → `/planning-tasks` → TDD execution). The actual
planning is done by the **`converge-tasks` dynamic workflow**
(`.claude/workflows/converge-tasks.js`), not by this skill. Your only jobs are:

1. **Ensure the input** the workflow needs.
2. **Launch the workflow** on that spec.
3. **Relay its result** to the user.

Do not evaluate, draft, or edit `tasks.md` yourself — that is entirely the
workflow's job. It bootstraps the list when none exists, fans out one read-only
`planner` per task in parallel, synthesizes their proposals, and writes the
final `tasks.md` exactly once.

## Step 1 — Ensure the input

The workflow needs a spec folder `docs/specs/<YYYY-MM-DD>-<feature>/` containing
an **approved** `requirements.md` and `design.md`. Resolve and check it:

- If the user named a feature or folder, use it.
- If `docs/specs/` contains exactly one spec, use that one and say so.
- If there are several and the conversation doesn't make it obvious, ask which.
- If `requirements.md` or `design.md` is missing, **stop** and point the user to
  `/specify` — planning against a missing or unapproved design plans the wrong
  feature. Do not launch the workflow until both exist.

You don't need to inspect `tasks.md` — the workflow's scout decides on its own
whether to bootstrap from scratch or iterate an existing list.

## Step 2 — Launch converge-tasks

Call the **Workflow** tool with the saved workflow and pass the resolved spec
folder as `args`:

```
Workflow({ name: "converge-tasks", args: { specFolder: "docs/specs/<date>-<feature>/" } })
```

Launching it from this skill is an explicit opt-in, so the workflow runs. It
executes in the background across many subagents and returns a structured result
(spec folder, rounds run, whether it converged, tasks, user decisions, remaining
gaps, and a report) — the workflow's own output is **not** shown to the user, so
you must relay it.

## Step 3 — Relay the result

When the workflow returns, report to the user in their language:

- What it did: bootstrapped and/or how many rounds it converged, and the final
  task count.
- Anything notable from its `report` / `changes`: splits, removals, rewrites.
- **User decisions and remaining gaps** it surfaced (`userDecisions`,
  `remainingGaps`): the workflow cannot pause for input mid-run, so these are
  the open questions only the user can resolve — present them with your
  recommendation. If the user answers, re-launch the workflow so the planners
  resolve them.
- If it returned `blocked`, relay the reason (usually a missing approved
  requirements.md/design.md) and route the user to `/specify`.
- State plainly that `tasks.md` is written and ready for the user's approval
  before TDD execution starts — the approval gate belongs to the user.

## Scope guardrails

- This skill **plans**; it never implements tasks, and neither does the
  workflow. Execution is the next stage, after the user approves `tasks.md`.
- Never edit `tasks.md`, `requirements.md`, or `design.md` yourself. The
  workflow is the sole author of `tasks.md`; gaps in the requirements or design
  are reported to the user and belong to `/specify`.
