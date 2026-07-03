# Tasks — Register expenses (with AI-suggested category)

**Status:** Draft
**Date:** 2026-07-03
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

- [ ] **T1** — Scaffold Next.js + TypeScript + Vitest project
- [ ] **T2** — Domain: fixed categories and valid expense creation
- [ ] **T3** — Domain: field validation with aggregated errors
- [ ] **T4** — Storage: `loadExpenses` / `saveExpenses` over `localStorage`
- [ ] **T5** — AI suggestion logic: `normalizeCategory` / `suggestCategory`
- [ ] **T6** — API route: `POST /api/suggest-category`
- [ ] **T7** — UI: `ExpenseList` and load-on-mount display
- [ ] **T8** — UI: `ExpenseForm` — submit, validation display, persistence
- [ ] **T9** — UI: AI suggestion wiring ("Sugerir")

## Requirements coverage

| Requirement criterion | Task(s) |
|-----------------------|---------|
| 1.1                   | T2, T8  |
| 1.2                   | T3      |
| 1.3                   | T3      |
| 1.4                   | T3      |
| 1.5                   | T3      |
| 1.6                   | T3, T8  |
| 1.7                   | T2      |
| 2.1                   | T2      |
| 2.2                   | T8      |
| 2.3                   | T3      |
| 3.1                   | T5, T6  |
| 3.2                   | T9      |
| 3.3                   | T9      |
| 3.4                   | T5      |
| 3.5                   | T6, T9  |
| 3.6                   | T6, T9  |
| 3.7                   | T6      |
| 4.1                   | T4, T8  |
| 4.2                   | T4, T7  |
| 4.3                   | T8      |
| 4.4                   | T7      |
| 4.5                   | T4      |
| 4.6                   | T4, T8  |

---

## Tasks

### T1 — Scaffold Next.js + TypeScript + Vitest project

- **Status:** `[ ]`
- **Traces to:** Design → Architecture / build tooling (no acceptance criterion
  directly; foundation for all other tasks — the repo currently has no
  `package.json`, source, or tests).
- **Depends on:** none

**Objective:** A runnable Next.js (App Router) + TypeScript project exists with
Vitest wired to `npm test` and `tsc --noEmit` wired to `npm run typecheck`, so
later tasks can follow red→green→verify.

**TDD plan:**

1. **Test (red):** Tooling must exist before a test can fail, so set it up as
   part of going red: create `package.json` (deps: `next`, `react`,
   `react-dom`, `@anthropic-ai/sdk`; devDeps: `typescript`, `vitest`,
   `@types/react`, `@types/node`; scripts: `dev`, `typecheck: tsc --noEmit`,
   `test: vitest run`), `tsconfig.json`, `vitest.config.ts`, `.gitignore`
   (`node_modules`, `.next`, `.env.local`), an empty `.env.local` placeholder
   for `ANTHROPIC_API_KEY`, and run `npm install`. Then add
   `src/domain/expense.test.ts` with a single test that imports `CATEGORIES`
   from `src/domain/expense` and asserts it is defined. Run `npm test` — it
   must execute Vitest and fail (module absent). This proves the runner is
   discovering tests before anything else is built.
2. **Implement (green):** Make the red test pass with a stub
   `src/domain/expense.ts` exporting `CATEGORIES` (T2 gives it its real,
   tested contract), plus minimal `app/layout.tsx` and `app/page.tsx`
   placeholders so the Next.js app boots.
3. **Verify:** `npm run typecheck` && `npm test` both run clean.

**Decision log:**

**Outcome:**

### T2 — Domain: fixed categories and valid expense creation

- **Status:** `[ ]`
- **Traces to:** 1.1 (domain half: valid input yields a stored-ready `Expense`
  with a unique id — actual storing is T8), 1.7, 2.1 → Design → Domain
  (`src/domain/expense.ts`)
- **Depends on:** T1

**Objective:** `CATEGORIES` exposes exactly the six fixed values, `isCategory`
narrows to them, and `createExpense` turns valid input into a normalized
`Expense` with a unique id.

**TDD plan:**

1. **Test (red):** In `src/domain/expense.test.ts` —
   - `CATEGORIES` equals exactly `["Comida", "Transporte", "Vivienda", "Ocio",
     "Salud", "Otros"]` [2.1]; `isCategory` accepts each and rejects `"Mascotas"`.
   - `createExpense` with valid input returns `{ ok: true, expense }` where
     `expense` has a non-empty unique `id` (two calls → different ids), a
     positive numeric `amount`, a `date` matching `/^\d{4}-\d{2}-\d{2}$/`, a
     trimmed `description`, and the given `category` [1.1, 1.7];
   - `createExpense` with `amount` given as a numeric string (e.g. `"25000"`,
     as a form yields it) stores it as the *number* `25000` — amounts are
     always stored as positive numbers, per the design's "amount is parsed"
     [1.7].
2. **Implement (green):** `CATEGORIES`, `Category`, `Expense`, `ExpenseInput`,
   `CreateExpenseResult`, `isCategory`, and the happy path of `createExpense`
   (`crypto.randomUUID()`, amount parse, date normalization, trim) per design.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T3 — Domain: field validation with aggregated errors

- **Status:** `[ ]`
- **Traces to:** 1.2, 1.3, 1.4, 1.5, 1.6 (domain half: no expense produced,
  all errors reported at once), 2.3 → Design → Domain (`src/domain/expense.ts`)
- **Depends on:** T2

**Objective:** `createExpense` rejects every invalid field with a
field-specific `ValidationError` and returns *all* errors in one result, so
the form can annotate every bad field while preserving input.

**TDD plan:**

1. **Test (red):** In `src/domain/expense.test.ts` —
   - amount missing / non-numeric / non-finite (`Infinity`) / `0` / negative →
     `{ ok: false }` with an error whose `field === "amount"` [1.2];
   - description empty or whitespace-only → error with `field === "description"` [1.3];
   - date missing / a non-date string (e.g. `"hola"`) / not a real calendar
     date (e.g. `"2026-02-30"`) → error with `field === "date"` [1.4];
   - category missing or off-list → error with `field === "category"` [1.5, 2.3];
   - input with several invalid fields → one `{ ok: false }` result containing
     an error per bad field, and no `expense` is produced [1.6].
2. **Implement (green):** validation branches in `createExpense` accumulating
   `ValidationError[]` instead of returning on the first failure.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T4 — Storage: `loadExpenses` / `saveExpenses` over `localStorage`

- **Status:** `[ ]`
- **Traces to:** 4.1, 4.2 (storage half), 4.5, 4.6 (storage half: write errors
  propagate) → Design → Storage (`src/storage/expenseStorage.ts`)
- **Depends on:** T2

**Objective:** Expenses round-trip through `localStorage` under the key
`mis-finanzas:expenses`; absent or corrupt data reads as `[]` without
throwing; a write failure propagates to the caller.

**TDD plan:**

1. **Test (red):** `src/storage/expenseStorage.test.ts` with a stubbed
   `localStorage` (or jsdom) —
   - `saveExpenses(list)` then `loadExpenses()` returns the same list [4.1, 4.2];
   - absent key → `[]`; malformed JSON and a non-array value → `[]`; a stored
     array mixing one valid expense with one entry failing shape/`isCategory`
     checks → only the valid expense is returned — never a throw [4.5];
   - `localStorage.setItem` throwing (quota) → `saveExpenses` propagates the
     error [4.6].
2. **Implement (green):** `loadExpenses` / `saveExpenses` per design (single
   JSON key, try/catch + per-entry validation on read, no catch on write).
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T5 — AI suggestion logic: `normalizeCategory` / `suggestCategory`

- **Status:** `[ ]`
- **Traces to:** 3.1 (suggestion produces one fixed-list category), 3.4 →
  Design → AI prompt logic (`src/ai/suggestCategory.ts`)
- **Depends on:** T2

**Objective:** `normalizeCategory` maps any string to a valid `Category` with
`Otros` as fallback, and `suggestCategory(description, client?)` returns a
`Category` via an injectable Anthropic client, letting errors propagate.

**TDD plan:**

1. **Test (red):** `src/ai/suggestCategory.test.ts` —
   - `normalizeCategory`: exact match (`"Comida"` → `Comida`), case and
     whitespace variants (`"  comida "` → `Comida`), off-list input
     (`"Groceries"`) → `Otros` [3.4];
   - `suggestCategory` with a fake client replying `"Transporte"` →
     `Transporte`, and the fake receives a prompt containing the description
     and the fixed categories [3.1];
   - fake replying an off-list word → `Otros` [3.4];
   - fake that throws → the error propagates (not swallowed).
2. **Implement (green):** `normalizeCategory` (trim, case-fold, membership
   check) and `suggestCategory` using `@anthropic-ai/sdk`, model
   `claude-haiku-4-5`, small `max_tokens`, prompt listing `CATEGORIES`.
3. **Verify:** `npm run typecheck` && `npm test` (no real API call — the
   client is always injected in tests).

**Decision log:**

**Outcome:**

### T6 — API route: `POST /api/suggest-category`

- **Status:** `[ ]`
- **Traces to:** 3.1, 3.5 (server half: `400` on empty description), 3.6
  (server half: failures become `502`), 3.7 → Design → API route
  (`app/api/suggest-category/route.ts`)
- **Depends on:** T5

**Objective:** A server-side Route Handler validates the request body, returns
`200 { category }` on success, `400` for an empty/whitespace description, and
`502 { error }` when the AI call fails — keeping `ANTHROPIC_API_KEY` out of
all client code.

**TDD plan:**

1. **Test (red):** `app/api/suggest-category/route.test.ts` — invoke the
   exported `POST` handler directly with `Request` objects, stubbing
   `suggestCategory`:
   - `{ description: "Almuerzo" }` → `200` and `{ category }` from the fixed
     list [3.1];
   - `{ description: "   " }` or missing → `400`, and the stub was **not**
     called [3.5];
   - stub throws → `502 { error }` [3.6].
2. **Implement (green):** the handler per design — parse body, validate
   description, call `suggestCategory`, try/catch → `502`.
3. **Verify:** `npm run typecheck` && `npm test`; then check the key stays
   server-side [3.7]: grep `app/` and `src/` for `ANTHROPIC_API_KEY` — it may
   appear only in server-only modules (`src/ai/`, the route); confirm no
   `NEXT_PUBLIC_`-prefixed variant of the key exists anywhere; confirm neither
   `route.ts` nor `src/ai/suggestCategory.ts` contains `"use client"` and no
   client component imports them (clients reach the route only via `fetch`).

**Decision log:**

**Outcome:**

### T7 — UI: `ExpenseList` and load-on-mount display

- **Status:** `[ ]`
- **Traces to:** 4.2 (UI half: stored expenses shown on open), 4.4 → Design →
  UI (`app/page.tsx`, `ExpenseList`)
- **Depends on:** T4

**Objective:** Opening the app shows previously stored expenses in a list,
each row displaying amount, date, description, and category.

**TDD plan:**

1. **Test (red):** first component test — add devDeps `jsdom` and
   `@testing-library/react` as part of going red, enabling jsdom only for UI
   tests (per-file `// @vitest-environment jsdom` or an `environmentMatchGlobs`
   entry) so the node-environment tests from T2–T6 keep running unchanged. In
   `src/components/ExpenseList.test.tsx` and `app/page.test.tsx`:
   - `ExpenseList` given two expenses renders both, showing each one's
     amount, date, description, and category [4.4]; given none, renders an
     empty state without crashing;
   - the page, with `localStorage` pre-seeded with a stored expense, shows it
     after mount [4.2].
2. **Implement (green):** `ExpenseList` (presentational, props-driven) and a
   `"use client"` page that seeds React state from `loadExpenses()` on mount
   and renders the list.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T8 — UI: `ExpenseForm` — submit, validation display, persistence

- **Status:** `[ ]`
- **Traces to:** 1.1 (submit → stored), 1.6 (UI half: errors shown, input
  preserved), 2.2, 4.1 (wiring `saveExpenses` on create), 4.3, 4.6 (UI half:
  save failure reported, input kept) → Design → UI (`ExpenseForm`,
  `app/page.tsx`)
- **Depends on:** T3, T4, T7

**Objective:** The user can register an expense end to end — valid input is
validated by `createExpense`, persisted via `saveExpenses`, and appears in the
list without a reload; invalid input or a failed save shows errors while
preserving every entered value.

**TDD plan:**

1. **Test (red):** `src/components/ExpenseForm.test.tsx` (+ page-level test) —
   - the category field is a select whose options are exactly `CATEGORIES`
     and nothing else [2.2];
   - filling valid values and submitting adds a row with those values to the
     rendered list without any reload [1.1, 4.3], and the new expense is
     persisted (`localStorage["mis-finanzas:expenses"]` — or a `saveExpenses`
     spy — contains it) [1.1, 4.1];
   - submitting invalid values (e.g. negative amount + empty description)
     shows a message per invalid field, every input keeps its entered
     value, and nothing is persisted (list and storage unchanged) [1.6];
   - if `saveExpenses` throws (mocked quota failure), an error message is
     shown, the expense is not added to the list, and inputs keep their
     values [4.6].
2. **Implement (green):** `ExpenseForm` (amount, date, description inputs +
   `CATEGORIES` select), page wiring: on submit run `createExpense`; on `ok`
   call `saveExpenses([...current, expense])` in try/catch and update state;
   on error render field messages from `ValidationError[]`.
3. **Verify:** `npm run typecheck` && `npm test`; `npm run dev` and manually
   register one expense, reload, confirm it persists.

**Decision log:**

**Outcome:**

### T9 — UI: AI suggestion wiring ("Sugerir")

- **Status:** `[ ]`
- **Traces to:** 3.2, 3.3, 3.5 (client half: no call on empty description),
  3.6 (client half: failure never blocks manual entry) → Design → UI
  (`ExpenseForm`)
- **Depends on:** T6, T8

**Objective:** A "Sugerir" action posts the description to
`/api/suggest-category` and prefills the category select with the response;
the user can still override it, and empty descriptions or failed requests
leave manual registration fully working.

**TDD plan:**

1. **Test (red):** in `src/components/ExpenseForm.test.tsx` with a mocked
   `fetch` —
   - clicking "Sugerir" with description `"Almuerzo con cliente"` POSTs
     `{ description }` to `/api/suggest-category` and, on a mocked
     `200 { category: "Comida" }` response, sets the select to `Comida`
     without submitting the expense (list unchanged) [3.2];
   - after a suggestion, the user changes the select and submits — the stored
     category is the user's final choice [3.3];
   - with an empty/whitespace description, clicking "Sugerir" does not call
     `fetch` [3.5];
   - `fetch` rejecting or returning `502` shows no blocking state: the user
     selects a category manually and submits successfully [3.6].
2. **Implement (green):** "Sugerir" button in `ExpenseForm`: guard on trimmed
   description, `fetch` POST, on `200` set the category state, on any failure
   swallow and leave the form untouched.
3. **Verify:** `npm run typecheck` && `npm test`; with `ANTHROPIC_API_KEY` in
   `.env.local`, `npm run dev` and manually confirm one real suggestion
   end to end.

**Decision log:**

**Outcome:**

---

## Open items

- End-to-end verification with a real `ANTHROPIC_API_KEY` is a manual step at
  T9; set the key in `.env.local` (git-ignored, created in T1) before running
  `npm run dev`.
