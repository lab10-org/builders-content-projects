---
name: specify
description: >-
  Spec out a new feature using the Requirements-First approach before writing
  any code: produce a requirements.md (EARS-format acceptance criteria), then a
  design.md (technical architecture), then a tasks.md (ordered TDD task list that
  doubles as the execution/decision log) — each after user approval. Use this WHENEVER
  the user wants to define, spec, plan, or scope a new feature or capability —
  phrases like "spec this out", "write requirements", "let's define the
  feature", "before we build", "escribir el spec", "definir la feature", or
  when starting the "spec" step of a brainstorm → spec → build workflow. Trigger
  even if the user doesn't say the word "spec", as long as they're describing a
  feature they want to formalize before implementation.
---

# Specify — Requirements-First feature specs

This skill turns a feature idea into a reviewable, traceable specification
**before** implementation starts. It follows the **Requirements-First** flow:
first nail down *what* the system should do (behavior), then design *how* it
will do it (architecture). Locking behavior before design keeps the design
honest — every technical decision traces back to a requirement instead of the
requirements being reverse-engineered to fit whatever got built.

The scope of this skill is three artifacts: **requirements.md**, **design.md**,
and **tasks.md**. The first two define *what* and *how*; the third breaks the
approved design into an ordered, traceable task list that doubles as the
execution log — the durable record of the decisions made while implementing
each task.

## Language — write the specs in English

Write both documents **entirely in English** — headings, prose, user stories,
and the EARS keywords — **even when the user speaks to you in another
language.** Specs are long-lived, shared engineering artifacts, and keeping
them in one language (English) makes them consistent, searchable, and portable
across teams and tools regardless of the conversation's language. This is
deliberate: don't mirror the user's language into the document body the way you
naturally would in chat.

Two things stay verbatim: domain terms and identifiers the user gave you
(category names, field names, product names, sample data) — quote those as-is
rather than translating them, since translating an identifier would break
traceability. You still *talk to the user* in their language (questions,
the approval request, your summaries); only the written spec files are English.

## Where the files go

Create one folder per feature, date-stamped so specs sort chronologically and
never collide:

```
docs/specs/<YYYY-MM-DD>-<feature-slug>/
├── requirements.md
├── design.md
└── tasks.md
```

- `<YYYY-MM-DD>` — today's date. If you don't know it, ask or check the
  environment rather than guessing.
- `<feature-slug>` — short kebab-case name (e.g. `budget-categories`,
  `expense-import`).

## The workflow — and the approval gate

Produce the documents in order, with a **hard stop for user approval** between
each phase. This gate is the point of the whole method: requirements are cheap
to change and design decisions compound on top of them, so it's far cheaper to
correct behavior now than after a design — or a task list — is built around the
wrong behavior. The same logic applies to the tasks: get the design signed off
before decomposing it into work.

**Coming from `/brainstorming`?** This skill is the "spec" stage of the project
workflow (`brainstorm → spec → ejecución → verificación → commit`), so it often
runs right after the `brainstorming` skill produced an *approved* design. When
that's the case, treat that design as settled input: reuse its architecture,
components, data flow, error handling and testing decisions instead of
re-interrogating the user about them. Your job is to formalize it — turn the
agreed behavior into numbered EARS requirements, then write it up as `design.md`
— not to re-open decisions the user already made.

### Phase 1 — Requirements

1. Gather enough understanding of the feature to write meaningful behavior. If
   the idea is vague, ask a few sharp questions first (who's the user, what's
   the trigger, what's success, what are the failure cases). Don't invent
   requirements to fill silence — surface them as **Open questions** instead.
2. Copy `assets/requirements-template.md` into the feature folder as
   `requirements.md` and fill it in. Write acceptance criteria in **EARS
   notation** (see below).
3. **Stop and ask the user to review.** Say clearly that design comes next and
   you're waiting for their sign-off or change requests. Do not create
   `design.md` yet. Iterate on requirements until the user approves.

### Phase 2 — Design

4. Only after explicit approval, copy `assets/design-template.md` into the
   feature folder as `design.md` and fill it in.
5. Ground every part of the design in the approved requirements. Each component,
   data model, and error path should trace back to a numbered acceptance
   criterion. If the design surfaces a gap in requirements, go back and update
   `requirements.md` rather than silently designing past it.
6. Present the design for review. **Stop and wait for approval** before
   decomposing it into tasks. Iterate on the design until the user approves.

### Phase 3 — Tasks (delegated to `/planning-tasks`)

7. Only after the design is approved, produce `tasks.md` by invoking the
   **`planning-tasks` skill** — do not hand-write the task list inline. That
   skill orchestrates the `planner` subagent (`.claude/agents/planner.md`):
   one bootstrap invocation drafts the list from `assets/tasks-template.md`,
   then one invocation per task evaluates and refines it until **every task
   reaches `CRITERIA MET`**. Per-task convergence against the real codebase is
   the point — a hand-written list skips exactly that audit.
8. The converged file must still satisfy this skill's contract (the planner
   enforces it): every task sized to one red→green→verify TDD cycle, **traced**
   to the design component(s) and requirement criteria it implements, and a
   **Requirements coverage** table where every acceptance criterion maps to at
   least one task. A criterion with no task is a gap — close it before
   implementation starts.
9. Each task's **Decision log** and **Outcome** stay empty at first. These are
   filled *during* execution, not now: as each task is implemented, append the
   decisions, discoveries, and any deviations from the design to its log, so
   `tasks.md` becomes the running record of *why* the code turned out the way it
   did. This is what makes the file a log, not just a checklist.
10. Present the task list for review. If requirements or design change after
    approval, re-run `/planning-tasks` to re-converge `tasks.md` instead of
    patching it by hand.

Keep the three documents in sync: if requirements change later, the design and
tasks must be revisited; if implementation reveals the design was wrong, update
`design.md` (and `requirements.md` if needed) and note it in the affected task's
Decision log.

## EARS notation for acceptance criteria

EARS (Easy Approach to Requirements Syntax) makes each criterion unambiguous
and **testable** — every SHALL is a check you can write a test against. Use the
pattern that fits the behavior; don't force everything into WHEN/THEN.

| Pattern | Template | Use for |
|---------|----------|---------|
| Ubiquitous | THE SYSTEM SHALL `<behavior>` | An invariant that always holds |
| Event-driven | WHEN `<trigger>` THE SYSTEM SHALL `<behavior>` | A response to an event/action |
| State-driven | WHILE `<state>` THE SYSTEM SHALL `<behavior>` | Behavior held during a state |
| Unwanted / error | IF `<condition>` THEN THE SYSTEM SHALL `<response>` | Error handling, edge cases |
| Optional | WHERE `<feature is present>` THE SYSTEM SHALL `<behavior>` | Behavior of an optional/configurable feature |

Guidance that makes criteria good:

- **One behavior per criterion.** Split "validates and saves and notifies" into
  three — each is separately testable and traceable.
- **Observable outcomes only.** State what the system *does* (returns, rejects,
  stores), not how it's implemented internally.
- **Number everything** (Requirement 1 → criteria 1.1, 1.2…) so `design.md`,
  tests, and reviews can cite exact criteria.
- **Cover the unhappy path.** For every WHEN, ask what happens IF the input is
  bad, missing, or out of range.

**Example (event-driven + error):**

Input: "Users assign expenses to budget categories."

Output:
```
### Requirement 2 — Assign expense to a category

**User story:** As a user, I want to assign each expense to a budget category,
so that I can see spending grouped by category.

**Acceptance criteria:**

2.1. WHEN a user assigns an expense to an existing category THE SYSTEM SHALL
     store the association and include the expense in that category's total.
2.2. IF the target category does not exist THEN THE SYSTEM SHALL reject the
     assignment and return a "category not found" error.
2.3. WHEN an expense already assigned to a category is reassigned THE SYSTEM
     SHALL move it, updating both categories' totals.
```

## Templates

- `assets/requirements-template.md` — structure for the requirements document.
- `assets/design-template.md` — structure for the design document.
- `assets/tasks-template.md` — structure for the task list / execution log.

Copy them into the feature folder rather than writing from scratch, then delete
the guidance placeholders (`<...>`) as you fill each section. Drop sections that
genuinely don't apply, but don't drop them just to save effort — an empty
"Error handling" section usually means the unhappy path wasn't thought through.
