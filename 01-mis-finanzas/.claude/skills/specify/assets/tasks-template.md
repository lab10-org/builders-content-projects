# Tasks — <Feature Name>

**Status:** Draft
**Date:** <YYYY-MM-DD>
**Requirements:** ./requirements.md
**Design:** ./design.md

## Purpose

<This document breaks the approved design into an ordered list of implementation
tasks and doubles as the execution log. Each task traces back to the design and
requirements, and records the decisions made while implementing it — so this file
becomes the durable record of *why* the code ended up the way it did, not just
*what* was built.>

## How to use this document

- Work **one task at a time, top to bottom**. Don't start a task until its
  dependencies are `Done`.
- Follow **TDD**: write the failing test, implement until it passes, then verify.
- As you execute a task, append to its **Decision log** — every non-obvious
  choice, discovery, or deviation from the design. This is the point of the file:
  a future reader should understand the reasoning without re-reading the diff.
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

<A flat checklist of all tasks for a quick progress view. Keep titles identical
to the detailed entries below. Order reflects execution order.>

- [ ] **T1** — <short title>
- [ ] **T2** — <short title>
- [ ] **T3** — <short title>

## Requirements coverage

<Reverse map: every acceptance criterion from requirements.md must appear here,
mapped to the task(s) that implement it. This is the completeness check — a
criterion with no task is a gap; fill it before starting, and revisit if
requirements change. List each criterion, even if several share a task.>

| Requirement criterion | Task(s) |
|-----------------------|---------|
| 1.1                   | T1      |
| 1.2                   | T1, T2  |
| 2.1                   | T3      |

---

## Tasks

<One detailed entry per task. Fill in the plan sections before starting; fill in
the Decision log and Outcome as you execute. Delete the `<...>` guidance as you
go.>

### T1 — <short title>

- **Status:** `[ ]`
- **Traces to:** <requirement criteria (e.g. 1.1, 1.2) and design component(s)>
- **Depends on:** <task IDs, or "none">

**Objective:** <One sentence: what capability exists once this task is done.>

**TDD plan:**

1. **Test (red):** <the failing test to write — name it and state what it asserts>
2. **Implement (green):** <the smallest change that makes the test pass>
3. **Verify:** <`npm run typecheck` && `npm test`, plus any manual check>

**Decision log:** <append-only; newest entries at the bottom. Record choices,
rationale, alternatives rejected, surprises, and any spec/design updates.>

- <YYYY-MM-DD> — <decision or finding> — <why>

**Outcome:** <Filled when Done: what shipped, tests added, and any follow-up left
for a later task.>

### T2 — <short title>

- **Status:** `[ ]`
- **Traces to:** <requirement criteria and design component(s)>
- **Depends on:** <task IDs, or "none">

**Objective:** <what capability exists once this task is done>

**TDD plan:**

1. **Test (red):** <failing test>
2. **Implement (green):** <smallest change>
3. **Verify:** <checks to run>

**Decision log:**

- <YYYY-MM-DD> — <decision or finding> — <why>

**Outcome:** <filled when Done>

---

## Open items

<Anything discovered during implementation that isn't yet a task: deferred work,
newly found edge cases, tech debt taken on purpose. Promote these to real tasks
or move them to a later spec. Remove if empty.>

- <item>
