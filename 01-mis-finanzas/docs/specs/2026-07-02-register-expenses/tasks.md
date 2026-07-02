# Tasks — Register expenses (with AI-suggested category)

**Status:** Draft
**Date:** 2026-07-02
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
  choice, discovery, or deviation from the design.
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

- [ ] **T1** — Scaffold Next.js + TypeScript + Vitest project
- [ ] **T2** — Domain core: categories, `Expense`, `createExpense`
- [ ] **T3** — `localStorage` persistence: `loadExpenses` / `saveExpenses`
- [ ] **T4** — AI suggestion logic: `normalizeCategory` / `suggestCategory`
- [ ] **T5** — API route: `POST /api/suggest-category`
- [ ] **T6** — UI: page, `ExpenseForm`, `ExpenseList`

## Requirements coverage

| Requirement criterion | Task(s) |
|-----------------------|---------|
| 1.1                   | T2      |
| 1.2                   | T2      |
| 1.3                   | T2      |
| 1.4                   | T2      |
| 1.5                   | T2      |
| 1.6                   | T2, T6  |
| 1.7                   | T2      |
| 2.1                   | T2      |
| 2.2                   | T6      |
| 2.3                   | T2      |
| 3.1                   | T4, T5  |
| 3.2                   | T6      |
| 3.3                   | T6      |
| 3.4                   | T4      |
| 3.5                   | T5, T6  |
| 3.6                   | T5, T6  |
| 3.7                   | T5      |
| 4.1                   | T3      |
| 4.2                   | T3, T6  |
| 4.3                   | T6      |
| 4.4                   | T6      |
| 4.5                   | T3      |
| 4.6                   | T3, T6  |

---

## Tasks

### T1 — Scaffold Next.js + TypeScript + Vitest project

- **Status:** `[ ]`
- **Traces to:** Design → Architecture / build tooling (no acceptance criterion
  directly; foundation for all others).
- **Depends on:** none

**Objective:** A runnable Next.js (App Router) + TypeScript project exists with
Vitest wired up, so later tasks can write and run tests.

**TDD plan:**

1. **Test (red):** Add a trivial `src/domain/__smoke__.test.ts` that imports a
   placeholder and asserts `true`; confirm `npm test` runs Vitest and the test
   is discovered (fails first if the placeholder module is absent).
2. **Implement (green):** Create `package.json` (deps: `next`, `react`,
   `react-dom`, `@anthropic-ai/sdk`; devDeps: `typescript`, `vitest`,
   `@types/*`), `tsconfig.json`, `vitest.config.ts`, minimal `app/layout.tsx`,
   and an empty `app/page.tsx`. Remove the smoke test once real tests exist.
3. **Verify:** `npm run typecheck` && `npm test` both run clean.

**Decision log:**

**Outcome:**

### T2 — Domain core: categories, `Expense`, `createExpense`

- **Status:** `[ ]`
- **Traces to:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.3 → `src/domain/expense.ts`
- **Depends on:** T1

**Objective:** `createExpense(input)` validates all fields, returns a normalized
`Expense` on success or all `ValidationError`s at once, and `CATEGORIES` /
`isCategory` are available.

**TDD plan:**

1. **Test (red):** `src/domain/expense.test.ts` — valid input → normalized
   `Expense` (positive `amount`, `YYYY-MM-DD` `date`, trimmed `description`,
   valid `category`, uuid `id`) [1.1, 1.7]; amount missing/NaN/0/negative
   rejected [1.2]; empty/whitespace description rejected [1.3]; missing/invalid
   date rejected [1.4]; off-list category rejected [1.5, 2.3]; multiple bad
   fields → all errors returned, nothing stored [1.6]; `CATEGORIES` equals the
   six fixed values [2.1].
2. **Implement (green):** `CATEGORIES`, `Category`, `Expense`, `ExpenseInput`,
   `isCategory`, `createExpense` per design.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T3 — `localStorage` persistence: `loadExpenses` / `saveExpenses`

- **Status:** `[ ]`
- **Traces to:** 4.1, 4.2, 4.5, 4.6 → `src/storage/expenseStorage.ts`
- **Depends on:** T2

**Objective:** Expenses round-trip through `localStorage`; corrupt data reads as
`[]`; a write failure propagates.

**TDD plan:**

1. **Test (red):** `src/storage/expenseStorage.test.ts` (jsdom or a stubbed
   `localStorage`) — `saveExpenses` then `loadExpenses` returns the same list
   [4.1, 4.2]; absent key → `[]`; malformed JSON / malformed entries → `[]`, no
   throw [4.5]; `saveExpenses` propagates a thrown write error [4.6].
2. **Implement (green):** `loadExpenses` / `saveExpenses` per design (single key
   `mis-finanzas:expenses`, try/catch on read, per-entry shape + `isCategory`
   validation).
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T4 — AI suggestion logic: `normalizeCategory` / `suggestCategory`

- **Status:** `[ ]`
- **Traces to:** 3.1, 3.4 → `src/ai/suggestCategory.ts`
- **Depends on:** T2

**Objective:** `normalizeCategory` maps any string to a valid `Category` (or
`Otros`), and `suggestCategory` returns a `Category` from a description using an
injectable Anthropic client.

**TDD plan:**

1. **Test (red):** `src/ai/suggestCategory.test.ts` — `normalizeCategory` exact
   match, case/whitespace variants, off-list → `Otros` [3.4]; `suggestCategory`
   with a fake client returning `"Comida"` → `Comida` [3.1]; fake returning an
   off-list word → `Otros` [3.4]; fake that throws → error propagates.
2. **Implement (green):** `normalizeCategory`, `suggestCategory(description,
   client?)` using `@anthropic-ai/sdk`, model `claude-haiku-4-5`, small
   `max_tokens`, prompt listing `CATEGORIES`.
3. **Verify:** `npm run typecheck` && `npm test` (no real API call — client is
   injected/faked).

**Decision log:**

**Outcome:**

### T5 — API route: `POST /api/suggest-category`

- **Status:** `[ ]`
- **Traces to:** 3.1, 3.5, 3.6, 3.7 → `app/api/suggest-category/route.ts`
- **Depends on:** T4

**Objective:** A server-side endpoint returns `{ category }`, `400` on empty
description, `502` on AI failure, and holds the API key server-side only.

**TDD plan:**

1. **Test (red):** `app/api/suggest-category/route.test.ts` — invoke the handler
   with a stubbed `suggestCategory`: valid description → `200 { category }`
   [3.1]; empty/whitespace → `400`, no AI call [3.5]; `suggestCategory` throws →
   `502` [3.6]. (Key-on-server [3.7] is satisfied structurally by living in the
   route + verified by no `ANTHROPIC_API_KEY` reference in client code.)
2. **Implement (green):** the Route Handler per design (validate body, call
   `suggestCategory`, try/catch → `502`).
3. **Verify:** `npm run typecheck` && `npm test`; grep client bundle/components
   for `ANTHROPIC_API_KEY` (must be absent).

**Decision log:**

**Outcome:**

### T6 — UI: page, `ExpenseForm`, `ExpenseList`

- **Status:** `[ ]`
- **Traces to:** 1.6, 2.2, 3.2, 3.3, 3.5, 3.6, 4.2, 4.3, 4.4, 4.6 →
  `app/page.tsx`, `ExpenseForm`, `ExpenseList`
- **Depends on:** T2, T3, T5

**Objective:** The user can register an expense end to end, get an AI suggestion
that prefills (and can override) the category, see the persisted list update
without reload, and see validation/save errors without losing input.

**TDD plan:**

1. **Test (red):** component tests (Vitest + Testing Library) — category select
   lists exactly `CATEGORIES` [2.2]; clicking "Sugerir" with a mocked fetch sets
   the select to the returned category [3.2] and the user can change it after
   [3.3]; empty description does not call the endpoint [3.5]; a failed/`502`
   fetch leaves manual entry working [3.6]; submitting valid input adds a row to
   the list without reload [4.3, 4.4]; invalid input shows field errors and
   preserves values [1.6]; expenses present at mount are displayed [4.2]; a
   `saveExpenses` failure shows an error and preserves input [4.6].
2. **Implement (green):** `"use client"` page seeding state from `loadExpenses`,
   `ExpenseForm` (fields + `CATEGORIES` select + "Sugerir" button calling
   `/api/suggest-category`), `ExpenseList` rendering amount/date/description/
   category, wired to `createExpense` + `saveExpenses`.
3. **Verify:** `npm run typecheck` && `npm test`; run the app (`npm run dev`) and
   manually register one expense with and without a suggestion.

**Decision log:**

**Outcome:**

---

## Open items

- End-to-end verification with a real `ANTHROPIC_API_KEY` is a manual step at T6;
  set the key in `.env.local` (git-ignored) before running `npm run dev`.
