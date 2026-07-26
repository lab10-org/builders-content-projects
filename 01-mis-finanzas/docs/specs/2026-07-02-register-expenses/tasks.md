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
- [ ] **T8a** — UI: `ExpenseForm` submit → validate, persist, show in the list
- [ ] **T8b** — UI: validation and save errors are shown without losing input
- [ ] **T9** — UI: AI suggestion wiring ("Sugerir")

## Requirements coverage

| Requirement criterion | Task(s)     |
|-----------------------|-------------|
| 1.1                   | T2, T8a     |
| 1.2                   | T3          |
| 1.3                   | T3          |
| 1.4                   | T3          |
| 1.5                   | T3          |
| 1.6                   | T3, T8b     |
| 1.7                   | T2          |
| 2.1                   | T2          |
| 2.2                   | T8a         |
| 2.3                   | T3          |
| 3.1                   | T5, T6      |
| 3.2                   | T9          |
| 3.3                   | T9          |
| 3.4                   | T5          |
| 3.5                   | T6, T9      |
| 3.6                   | T5, T6, T9  |
| 3.7                   | T6, T9      |
| 4.1                   | T4, T8a     |
| 4.2                   | T4, T7      |
| 4.3                   | T8a         |
| 4.4                   | T7          |
| 4.5                   | T4, T7      |
| 4.6                   | T4, T8b     |

---

## Tasks

### T1 — Scaffold Next.js + TypeScript + Vitest project

- **Status:** `[ ]`
- **Traces to:** Design → Architecture / build tooling (no acceptance criterion
  directly; foundation for all other tasks — the project folder currently has no
  `package.json`, source, or tests).
- **Depends on:** none

**Objective:** A runnable Next.js (App Router) + TypeScript project exists with
Vitest wired to `npm test` and `tsc --noEmit` wired to `npm run typecheck`, so
later tasks can follow red→green→verify.

**TDD plan:**

1. **Test (red):** Tooling must exist before a test can fail, so set it up as
   part of going red. Create the files by hand and install with plain
   `npm install` — do **not** use `create-next-app`: it is interactive, refuses
   a non-empty directory (this one already holds `CLAUDE.md`, `docs/`,
   `.claude/`), and pulls in ESLint/Tailwind that no requirement asks for.
   - `package.json` — `"private": true` and a `"version"` (so `npm install`
     runs without warnings); deps `next`, `react`, `react-dom`; devDeps
     `typescript`, `vitest`, `@types/react`, `@types/react-dom`, `@types/node`;
     scripts `dev: next dev`, `typecheck: tsc --noEmit`, `test: vitest run`.
     Feature deps arrive with the task that needs them (`@anthropic-ai/sdk` in
     T5, `jsdom` + `@testing-library/react` in T7), per the project rule "no
     dependencies without need".
   - `tsconfig.json` — `strict: true`, `noEmit: true`, `jsx: "preserve"`,
     `moduleResolution: "bundler"` with `module: "esnext"` (bundler resolution
     rejects a CommonJS `module`), `skipLibCheck: true` (Next ships its own
     `.d.ts` files), `esModuleInterop`, `resolveJsonModule`, `isolatedModules`,
     `target: "ES2022"`, and `lib: ["ES2022", "DOM", "DOM.Iterable"]` — `DOM` is
     load-bearing, not cosmetic: without it `localStorage` (T4) and the React
     DOM types (T7) fail `tsc --noEmit`. `include` lists `next-env.d.ts` plus
     `src/**` and `app/**`, so test files are type-checked too and the Next.js
     ambient types referenced from `next-env.d.ts` are actually loaded (an
     `include` of only `src/**`/`app/**` would leave that file out of the
     program, and the fallback in step 3 would then have no effect).
   - `vitest.config.ts` — pin `test.environment: "node"` explicitly (T7 opts
     specific UI files into jsdom on top of this) and leave the default include
     glob so tests under both `src/` and `app/` are discovered (T6 and T7 place
     tests under `app/`). The config is not frozen: T7 may add
     `esbuild.jsx: "automatic"` and `test.globals: true` when the first
     component test needs them.
   - `.gitignore` **in this project folder**, next to `package.json` —
     `node_modules`, `.next`, `.env*.local`, `next-env.d.ts`. The git root is
     the parent directory and its `.gitignore` only covers Python artifacts, so
     a project-local file is required. Also create an empty `.env.local`
     placeholder for `ANTHROPIC_API_KEY` (used from T6).
   - Run `npm install`.
   Then add `src/domain/expense.test.ts` with a single test that imports
   `CATEGORIES` from `src/domain/expense` and asserts it is defined. Run
   `npm test` — it must execute Vitest and fail (module absent). This proves the
   runner is discovering tests before anything else is built.
2. **Implement (green):** Make the red test pass with a stub
   `src/domain/expense.ts` exporting `CATEGORIES`, plus minimal
   `app/layout.tsx` and `app/page.tsx` placeholders so the Next.js app boots.
   The root layout must render `<html>` and `<body>` around `children` — Next.js
   throws at runtime if the root layout omits them, which is what the optional
   `npm run dev` check in step 3 would hit. The stub may already carry the six
   literal values — T2's red is guaranteed regardless, because `isCategory` and
   `createExpense` do not exist yet — and T2 replaces this placeholder assertion
   with the real, tested contract.
3. **Verify:** `npm run typecheck` && `npm test` both run clean (Node 22 is in
   use, so `crypto.randomUUID` is a global and the T2 domain tests will need no
   polyfill under the node environment). If `tsc --noEmit` fails on missing
   Next.js ambient types, generate `next-env.d.ts` by running `next dev`/`next
   build` once (it stays git-ignored, and is already listed in `include`)
   rather than loosening `strict`. Optionally start `npm run dev` once to
   confirm the app renders.

**Decision log:**

**Outcome:**

### T2 — Domain: fixed categories and valid expense creation

- **Status:** `[ ]`
- **Traces to:** 1.1 (domain half: valid input yields a stored-ready `Expense`
  with a unique id — actual storing is T8a), 1.7, 2.1 → Design → Domain
  (`src/domain/expense.ts`)
- **Depends on:** T1

**Objective:** `CATEGORIES` exposes exactly the six fixed values, `isCategory`
narrows any `unknown` to them, and `createExpense` turns valid input into a
normalized `Expense` with a unique id.

**TDD plan:**

1. **Test (red):** In `src/domain/expense.test.ts`, replacing T1's placeholder
   assertion —
   - `CATEGORIES` equals exactly `["Comida", "Transporte", "Vivienda", "Ocio",
     "Salud", "Otros"]` [2.1]; `isCategory` accepts each of the six and rejects
     `"Mascotas"`, `""`, `undefined`, `null`, and `42` — it takes `unknown`, and
     T4 leans on it to drop malformed stored entries;
   - `createExpense` with valid input returns `{ ok: true, expense }` where
     `expense` has a non-empty unique `id` (two calls → different ids), a
     positive numeric `amount`, a `date` matching `/^\d{4}-\d{2}-\d{2}$/`, a
     trimmed `description`, and the given `category` [1.1, 1.7];
   - `createExpense` with `amount` given as a numeric string (e.g. `"25000"`,
     as a form yields it) stores it as the *number* `25000` — amounts are
     always stored as positive numbers, per the design's "amount is parsed"
     [1.7];
   - **date normalization is actually exercised:** an already-normalized input
     (`"2026-07-02"`) comes back verbatim, and a valid date that is *not*
     already normalized (e.g. `"2026-7-2"`) yields `date === "2026-07-02"`
     [1.7]. Asserting only the regex would pass with no normalization code when
     the input is already `YYYY-MM-DD`, so these cases are what make 1.7 real.
     Keep the assertions timezone-independent: `new Date(2026, 6, 2)` read back
     with `toISOString()` shifts the day in a negative-offset timezone. Split
     the input into year/month/day parts and rebuild through
     `Date.UTC(y, m - 1, d)`, reading the **UTC** getters back — never
     local-time getters. Keep this helper the single date path in the module:
     T3 reuses it to reject calendar roll-over (`"2026-02-30"` normalizes to
     `"2026-03-02"`, which no longer matches the input's own parts), so it must
     run the parts through `Date` rather than merely zero-padding them. Record
     the choice in the Decision log.
2. **Implement (green):** `CATEGORIES`, `Category`, `Expense`, `ExpenseInput`,
   `ValidationError`, `CreateExpenseResult`, `isCategory`, and the happy path of
   `createExpense` (`crypto.randomUUID()`, amount parse, date normalization,
   trim) per design. `ValidationError` is declared here because
   `CreateExpenseResult` references it and would not typecheck otherwise; T3
   fills the rejection paths that populate it.
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
   - amount `undefined`, `"abc"`, `""`, `Infinity`, `0`, `-5` → `{ ok: false }`
     with an error whose `field === "amount"` [1.2] (note `Number("")` and
     `Number(null)` are `0`, so "missing" must be rejected as an amount error,
     not silently coerced);
   - description `""`, `"   "`, and a non-string value (`undefined`) → error
     with `field === "description"` [1.3]; `ExpenseInput.description` is typed
     `unknown`, so the missing case must be rejected rather than crash on
     `.trim()`;
   - date `undefined`, `"hola"`, and `"2026-02-30"` (a non-existent calendar
     day) → error with `field === "date"` [1.4];
   - category `undefined` and `"Mascotas"` → error with `field === "category"`
     [1.5, 2.3];
   - every returned `ValidationError` carries a non-empty `message` (T8b renders
     it per field);
   - input with several invalid fields (e.g. negative amount + empty
     description + off-list category, valid date) → one `{ ok: false }` result
     whose `errors` field set is exactly those three, with no duplicate field,
     no error for the valid field, and no `expense` produced [1.6].
2. **Implement (green):** validation branches in `createExpense` accumulating
   `ValidationError[]` instead of returning on the first failure. Guard every
   field on its type first (the inputs are `unknown`) so no branch can throw.
   The date branch must reject calendar roll-over: `new Date("2026-02-30")` is
   a *valid* `Date` (it becomes March 2), so validate by normalizing to
   `YYYY-MM-DD` and comparing the result back against the input's own
   year/month/day before accepting it [1.4, 1.7]. Extend T2's normalization
   helper rather than introducing a second date path (compare the parts
   **numerically**, so T2's `"2026-7-2"` → `"2026-07-02"` case is not rejected
   by a `"7"` vs `"07"` string mismatch), and note the choice in the Decision
   log.
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

1. **Test (red):** `src/storage/expenseStorage.test.ts`, running in the default
   node environment — no jsdom, which only arrives with the UI tests in T7 —
   with a hand-rolled in-memory `localStorage` stub (`getItem` / `setItem` /
   `clear` over a `Map`), installed fresh in `beforeEach` via
   `vi.stubGlobal("localStorage", stub)` and removed in `afterEach` via
   `vi.unstubAllGlobals()`. Use `vi.stubGlobal` rather than assigning
   `globalThis.localStorage` directly: Node does not define `localStorage`, and
   the DOM lib types it as the full `Storage` interface, so a three-method stub
   assigned directly would fail `npm run typecheck` at step 3. (If you assign
   directly anyway, the stub must implement all of `getItem`, `setItem`,
   `removeItem`, `clear`, `key`, `length`.) No new dependency either way.
   - `saveExpenses(list)` then `loadExpenses()` returns the same list, and the
     stub holds it as JSON under the exported `STORAGE_KEY`
     (`"mis-finanzas:expenses"`) [4.1, 4.2];
   - absent key → `[]`; malformed JSON and a non-array value → `[]`; a stored
     array mixing one valid expense with entries failing shape or `isCategory`
     checks → only the valid expense is returned — never a throw [4.5];
   - `localStorage.setItem` throwing (quota) → `saveExpenses` propagates the
     error [4.6].
2. **Implement (green):** `loadExpenses` / `saveExpenses` per design (single
   JSON key exported as `STORAGE_KEY` so the UI tests in T7/T8a/T8b assert
   against the constant instead of a duplicated literal; try/catch + per-entry
   shape and `isCategory` validation on read, no catch on write). The exported
   `STORAGE_KEY` is an addition to the design's Storage interface — record it in
   the Decision log. Two access constraints the test above forces: reach the
   store through the **bare `localStorage` global**, never `window.localStorage`
   — both typecheck and both work under jsdom (T7), but `window` is `undefined`
   in this task's node environment, so the `window.` form fails the red test for
   a mechanical reason; and touch `localStorage` only *inside* the two
   functions, never at module scope, so importing this module during Next.js
   server rendering (T7's page) cannot crash.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T5 — AI suggestion logic: `normalizeCategory` / `suggestCategory`

- **Status:** `[ ]`
- **Traces to:** 3.1 (upstream half: a suggestion resolves to one fixed-list
  category; the HTTP endpoint itself is T6), 3.4, 3.6 (upstream half: AI errors
  propagate out of `suggestCategory` instead of being swallowed, so T6 can turn
  them into `502`) → Design → AI prompt logic (`src/ai/suggestCategory.ts`)
- **Depends on:** T2

**Objective:** `normalizeCategory` maps any string to a valid `Category` with
`Otros` as fallback, and `suggestCategory(description, client?)` returns a
`Category` via an injectable Anthropic client, letting errors propagate.

**TDD plan:**

1. **Test (red):** add `@anthropic-ai/sdk` as a dependency as part of going red
   (T1 deliberately does not install it up front — feature deps arrive with the
   task that needs them). Then `src/ai/suggestCategory.test.ts` (node
   environment, no real API call — the client is always injected) —
   - `normalizeCategory`: exact match (`"Comida"` → `Comida`), case and
     whitespace variants (`"  comida "` → `Comida`), off-list input
     (`"Groceries"`) → `Otros`, empty string → `Otros` [3.4];
   - `suggestCategory("Almuerzo con cliente", fakeClient)` where the fake
     replies `"Transporte"` → returns `Transporte`, and the fake received a
     prompt containing the description and every value of `CATEGORIES`. The
     reply is deliberately *not* the intuitive category for that description,
     so the test fails against an implementation that guesses locally instead
     of relaying the client's answer [3.1];
   - fake replying an off-list word (`"Groceries"`), and a fake replying a
     response whose `content` has no text block → `Otros` [3.4];
   - fake whose `messages.create` rejects → `suggestCategory` rejects with that
     error (not swallowed, no `Otros` fallback) [3.6 upstream half];
   - importing the module with `ANTHROPIC_API_KEY` unset must not throw (the
     tests themselves prove this: they run without the key).
2. **Implement (green):** `normalizeCategory` (trim, case-fold, membership check
   against `CATEGORIES`, fallback `Otros`) and `suggestCategory` using
   `@anthropic-ai/sdk`, model `claude-haiku-4-5`, small `max_tokens` (~16),
   prompt listing `CATEGORIES` and asking for exactly one. Extract the reply's
   first text block, defaulting to `""` when absent, and pass it through
   `normalizeCategory`. Two constraints the tests above force:
   - construct the default `new Anthropic()` **lazily inside** `suggestCategory`
     when no client is passed — never at module scope — so importing the module
     without `ANTHROPIC_API_KEY` does not throw (this also keeps the key
     server-side by construction, which T6/T9 verify statically for [3.7]);
   - type the `client` parameter as a **minimal structural interface** so a fake
     exposing only `messages.create` is assignable and `npm run typecheck`
     passes on the test file without casts. Note that
     `Pick<Anthropic, "messages">` does *not* work: `Anthropic["messages"]` is
     the full SDK `Messages` class, so a one-method fake fails to satisfy it.
     Declare instead a local shape such as
     `type SuggestClient = { messages: { create(params: { model: string; max_tokens: number; messages: { role: "user"; content: string }[] }): Promise<{ content: { type: string; text?: string }[] }> } }`
     and accept `client?: SuggestClient`. This narrows the design's
     `client?: Anthropic` (a real SDK client still satisfies it) — record the
     deviation in the Decision log. Two corollaries that keep step 3 green:
     put the **whole** prompt in the single `user` message instead of a separate
     `system` parameter — the shape above declares no `system` field, so an
     object literal carrying one fails excess-property checking; and if `tsc`
     nevertheless reports the real SDK client is not assignable to
     `SuggestClient`, cast **only** at the default-construction site
     (`new Anthropic() as unknown as SuggestClient`) rather than widening the
     parameter type back to `Anthropic` — the fake's assignability is precisely
     what the test file depends on. Note either choice in the Decision log.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T6 — API route: `POST /api/suggest-category`

- **Status:** `[ ]`
- **Traces to:** 3.1, 3.5 (server half: `400` on empty description), 3.6
  (server half: failures become `502`), 3.7 → Design → API route
  (`app/api/suggest-category/route.ts`)
- **Depends on:** T5

**Objective:** A server-side Route Handler validates the request body, returns
`200 { category }` on success, `400` for a missing/empty/unparseable
description, and `502 { error }` when the AI call fails — keeping
`ANTHROPIC_API_KEY` out of all client code.

**TDD plan:**

1. **Test (red):** `app/api/suggest-category/route.test.ts` — invoke the
   exported `POST` handler directly with real `Request` objects (Node 22
   provides `Request`/`Response` as globals, so no Next.js runtime is needed),
   with `src/ai/suggestCategory` replaced by `vi.mock` so no network or API key
   is involved:
   - stub resolves `"Comida"`; `POST` with body `{ description: "Almuerzo" }`
     → status `200`, JSON body exactly `{ category: "Comida" }`, and the stub
     called once with `"Almuerzo"` — the handler relays the description and
     the resulting category unchanged [3.1];
   - `{ description: "   " }`, `{}` (no `description`), a non-string
     `description`, and a body that is not valid JSON → status `400` each
     time, no unhandled throw, and the stub **never** called [3.5];
   - stub rejects → status `502` with a JSON body whose `error` is a string
     [3.6].
   Two mechanics this first route test forces:
   - **`vi.mock` must name the same module the route imports.** T1's
     `tsconfig.json` defines no `paths` alias (this project is hand-scaffolded,
     not `create-next-app`), so the route must import `suggestCategory` by
     relative path — `../../../src/ai/suggestCategory` — and the test must mock
     that same specifier as it resolves from the test file (the test sits in
     the same directory as `route.ts`, so the specifier is identical). Do not
     introduce a `@/` alias here: it would need matching entries in both
     `tsconfig.json` and `vitest.config.ts` (`resolve.alias`) for no gain. Use
     the hoisted factory form, `vi.mock("…/suggestCategory", () => ({
     suggestCategory: vi.fn() }))`, then import the symbol and drive it with
     `vi.mocked(...)`; reset it in `beforeEach` so the "never called"
     assertions are honest.
   - If `vitest.config.ts` (T1) turned out to restrict `include` to `src/`,
     widen it here so `app/**/*.test.ts` is discovered — otherwise the red test
     never runs.
2. **Implement (green):** the handler per design — export an async
   `POST(request: Request)`; `await request.json()` in try/catch → `400` on
   parse failure, validate `description` is a non-empty trimmed string →
   `400`, then `suggestCategory(description)` in try/catch → `502 { error }` on
   rejection, else `200 { category }`. Build replies with the Web-standard
   `Response.json(body, { status })` rather than `NextResponse`, so the handler
   stays directly invocable from the node-environment test without pulling in
   `next/server`.
3. **Verify:** `npm run typecheck` && `npm test`; then a static key-safety
   check for [3.7]: grep `app/` and `src/` for `ANTHROPIC_API_KEY` and for
   `NEXT_PUBLIC_`. Expect **zero** matches in both trees — T5 constructs
   `new Anthropic()` with no explicit `apiKey`, so the SDK reads the variable
   from the environment implicitly and the literal need not appear in source at
   all; its only home is the git-ignored `.env.local`. Any match that does turn
   up must sit in a server-only module (`src/ai/suggestCategory.ts` or
   `app/api/**/route.ts`) and must never carry a `NEXT_PUBLIC_` prefix.
   Also confirm neither `app/api/suggest-category/route.ts` nor
   `src/ai/suggestCategory.ts` carries `"use client"` or is imported by any
   client module (clients reach the endpoint only via `fetch`). Re-run this
   check at T9, when the first client caller exists.

**Decision log:**

**Outcome:**

### T7 — UI: `ExpenseList` and load-on-mount display

- **Status:** `[ ]`
- **Traces to:** 4.2 (UI half: stored expenses shown on open), 4.4, 4.5 (UI
  half: absent/corrupt storage renders an empty state without crashing) →
  Design → UI (`app/page.tsx`, `ExpenseList`)
- **Depends on:** T4

**Objective:** Opening the app shows previously stored expenses in a list,
each row displaying amount, date, description, and category; with no readable
data the page renders an empty state instead of crashing.

**TDD plan:**

1. **Test (red):** first component test — add devDeps `jsdom` and
   `@testing-library/react` as part of going red, and opt **only** the UI test
   files into jsdom with a per-file `// @vitest-environment jsdom` docblock
   (prefer it over `environmentMatchGlobs`, deprecated in current Vitest), so
   the node-environment tests from T2–T6 keep running unchanged. Four setup
   details this first component test forces:
   - if esbuild does not pick up the automatic JSX runtime from `tsconfig.json`
     (which uses `jsx: "preserve"` for Next.js), set `esbuild.jsx: "automatic"`
     in `vitest.config.ts`;
   - React Testing Library's auto-cleanup only runs when `test.globals: true`
     is set in `vitest.config.ts`; either set it or call RTL's `cleanup()` in an
     `afterEach` — otherwise the second test in a file renders on top of the
     first and `getBy…` fails with "found multiple elements". Clear
     `localStorage` in the same `beforeEach`/`afterEach`;
   - under jsdom `localStorage` is real (unlike T4, which stubs it for the node
     environment), so seed it directly with
     `localStorage.setItem(STORAGE_KEY, JSON.stringify([...]))` — no stub, no
     module mock of `src/storage/expenseStorage`;
   - do **not** add `@testing-library/jest-dom` (no requirement needs it):
     assert presence with `getBy…` / `findBy…` and absence with
     `expect(queryBy…).toBeNull()`, never `toBeInTheDocument()`.

   In `src/components/ExpenseList.test.tsx` and `app/page.test.tsx`:
   - `ExpenseList` given two expenses renders exactly two rows
     (`screen.getAllByRole("listitem")`), and for each row `within(row)`
     finds that expense's amount, date, description, and category [4.4].
     Scoping with `within` is what makes the assertion real: two rows share a
     category, so a bare `screen.getByText("Comida")` would be ambiguous;
   - the rendered text is the stored value verbatim — amount as its plain
     number (`"25000"`, no currency symbol, no thousands separator: currency
     and locale formatting are out of scope) and date as the stored
     `YYYY-MM-DD` string, so the assertions above can compare exact text;
   - `ExpenseList` given `[]` renders no `listitem` and shows the empty-state
     message `Aún no hay gastos registrados.` (fix the copy here so the page
     tests below and T8b can query the same string);
   - the page, with storage pre-seeded **before render** under `STORAGE_KEY`
     (imported from `src/storage/expenseStorage`) with one stored expense,
     shows that expense's values (assert with `await screen.findBy…`, since the
     page reads storage in a mount effect, not during render) and no longer
     shows the empty-state message [4.2];
   - the page with the key absent or holding corrupt JSON (e.g. `"{oops"`)
     renders the empty-state message without throwing [4.5].
2. **Implement (green):** `ExpenseList` (presentational, props-driven: takes
   `expenses: Expense[]`, renders a `<ul>` with one `<li>` per expense — amount,
   date, description, category as plain text — and the empty-state message
   instead of the list when the array is empty) and a `"use client"`
   `app/page.tsx` that holds the list in React state and seeds it from
   `loadExpenses()` in a mount `useEffect` — not during render, which would
   break SSR — then renders `<ExpenseList />`. No form yet (T8a).
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T8a — UI: `ExpenseForm` submit → validate, persist, show in the list

- **Status:** `[ ]`
- **Traces to:** 1.1 (UI half: a valid submission is created and stored), 2.2,
  4.1 (wiring `saveExpenses` on create), 4.3 → Design → UI (`ExpenseForm`,
  `app/page.tsx`)
- **Depends on:** T2, T4, T7

**Objective:** The user can register a valid expense end to end — the form
offers only the fixed categories, submission runs `createExpense`, persists via
`saveExpenses`, and the new row appears in the list without a reload.

**TDD plan:**

1. **Test (red):** `src/components/ExpenseForm.test.tsx` (jsdom, set up in T7),
   plus one page-level case in `app/page.test.tsx`. Query inputs by their
   accessible labels (`screen.getByLabelText`) and drive them with RTL's
   `fireEvent.change` / `fireEvent.click` — no `@testing-library/user-event`
   dependency is added here or in T9. Clear `localStorage` in `beforeEach` (T7's
   convention), so the persistence assertions start from an empty store —
   - the category field is a `<select>` whose selectable category values are
     exactly `CATEGORIES` — no value outside the fixed list is offered (a
     non-category placeholder option such as an empty `""` is allowed) [2.2].
     Assert it concretely: take the select via
     `screen.getByLabelText("Categoría")`, read
     `within(select).getAllByRole("option")`, map each to its `value`, drop an
     empty placeholder value, and compare the result to `[...CATEGORIES]` — so
     the test fails both on a missing category and on an extra one;
   - filling valid values (amount, date, description, category) and submitting
     calls the form's `onSubmit` prop exactly once, with an object carrying the
     four field values as typed (amount arrives as the input's string, e.g.
     `"25000"` — T2 already accepts numeric strings, so no parsing lives in the
     component);
   - **the reset contract, tested here because it is implemented here:** with a
     fake `onSubmit` returning `true` (accepted), the four inputs are empty /
     back to their placeholder after submitting; with a fake returning `false`
     (rejected), every input still holds the typed value. This is what lets the
     page — which alone knows whether `createExpense`/`saveExpenses` succeeded —
     drive the reset while the form keeps owning the typed values, and it is the
     contract T8b's error cases and T9's select-prefill rely on;
   - on the page: the row is **not** present before submitting; after filling
     valid values and submitting, `await screen.findByText…` finds a row with
     those values in the still-mounted tree — no reload, no manual refresh
     [4.3] — and the expense is persisted: `localStorage` under `STORAGE_KEY`
     (imported from `src/storage/expenseStorage`) holds exactly one entry whose
     amount/date/description/category match and whose `id` is a non-empty
     string [1.1, 4.1].
2. **Implement (green):** `ExpenseForm` (props-driven: `amount` as
   `<input type="number">`, `date` as `<input type="date">` — which yields an
   already-normalized `YYYY-MM-DD` value — a description input, a
   `CATEGORIES`-driven `<select>`, and a submit button that calls
   `onSubmit(values)` and prevents the default form navigation). The form holds
   the typed values in its own state and clears them **only** when `onSubmit`
   returns `true`; type the prop as
   `onSubmit: (values: ExpenseInput) => boolean` so the caller must state
   whether the submission was accepted. Give every field an accessible label
   (`Monto`, `Fecha`, `Descripción`, `Categoría`) via `<label htmlFor>` so T8b
   and T9 have a stable query. Page wiring lives in `app/page.tsx`, which owns
   the domain calls and renders `<ExpenseForm>` above the existing
   `<ExpenseList>` from T7: on submit it runs `createExpense`; on `ok`, it calls
   `saveExpenses([...current, expense])`, appends the expense to React state,
   and returns `true`. On `{ ok: false }` it returns `false` and does nothing
   else — that early `return false` is required *here*, not deferred to T8b:
   the `onSubmit` prop is typed `=> boolean`, so a handler that falls through
   infers `boolean | undefined` and fails `npm run typecheck` at step 3.
   *Rendering* the field messages, holding `errors`/`saveError` state, and
   catching a throwing `saveExpenses` are T8b; the happy path plus that bare
   `false` is enough here.
3. **Verify:** `npm run typecheck` && `npm test`; then `npm run dev`, register
   one expense manually, reload, and confirm it is still listed.

**Decision log:**

**Outcome:**

### T8b — UI: validation and save errors are shown without losing input

- **Status:** `[ ]`
- **Traces to:** 1.6 (UI half: errors shown per field, entered values
  preserved, nothing stored), 4.6 (UI half: a failed save is reported and input
  is kept) → Design → UI (`ExpenseForm`, `app/page.tsx`), Design → Error
  handling
- **Depends on:** T3, T8a

**Objective:** A rejected submission annotates every invalid field and a failed
`saveExpenses` shows an error message — in both cases nothing is added to the
list or to storage, and every value the user typed stays in the form.

**TDD plan:**

1. **Test (red):** extend `src/components/ExpenseForm.test.tsx` /
   `app/page.test.tsx` (jsdom, set up in T7), querying inputs by their labels
   (`screen.getByLabelText`) as in T8a. One query mechanic this task forces:
   validation message copy comes from the domain's `ValidationError.message`
   (T3 only guarantees it is non-empty), so do **not** assert that copy — assert
   the *link* instead. An invalid field's input carries an `aria-describedby`
   whose target element renders non-empty text; a valid field's input carries
   none (`expect(input.getAttribute("aria-describedby")).toBeNull()`). The
   save-error message, by contrast, is copy this task owns, so fix it here —
   `No se pudo guardar el gasto. Vuelve a intentarlo.` — and query it with
   `await screen.findByText(...)`.
   - submitting with several invalid fields at once (negative amount + empty
     description, valid date and category) renders one message per invalid
     field — assert `Monto` and `Descripción` each resolve through
     `aria-describedby` to a non-empty message and that `Fecha` and `Categoría`
     have none — each input still holds the value the user typed, the list gains
     no row, and `localStorage` under `STORAGE_KEY` is unchanged (still absent,
     or still the pre-seeded value) [1.6];
   - correcting the two fields and resubmitting clears both messages (both
     inputs are back to no `aria-describedby`) and adds the row — errors are not
     sticky: they are recomputed from the latest `createExpense` result, not
     accumulated;
   - a failed write: make `saveExpenses` throw by stubbing the browser API it
     uses rather than mocking the module the page also loads from —
     `vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw
     new Error("QuotaExceededError"); })` — then submit valid values and assert
     the spy was called (the save was attempted, not skipped), the save-error
     message above is shown to the user, the list gains no row, and every input
     keeps its entered value [4.6]; restore the spy afterwards
     (`vi.restoreAllMocks()`), and install it *after* any `localStorage` seeding
     in `beforeEach` so the seeding itself does not throw.
2. **Implement (green):** the page owns the failure state and the form renders
   it, keeping `ExpenseForm` props-driven as in T8a:
   - `app/page.tsx` holds `errors: ValidationError[]` and `saveError: string |
     null`; on submit it runs `createExpense`, and on `{ ok: false }` sets
     `errors` (no `saveExpenses`, no state append). On `ok` it wraps
     `saveExpenses([...current, expense])` in try/catch — on throw it sets
     `saveError` and skips the list update, so nothing is added anywhere; on
     success it clears both `errors` and `saveError` before appending.
   - `ExpenseForm` receives `errors` and `saveError` as props and renders each
     validation message next to the input matching `error.field`, linking them
     with `aria-describedby` (and omitting the attribute entirely when that
     field has no error, which is what the red test asserts), plus the save
     message once above/below the submit button. Declare both props
     **optional** (`errors?: ValidationError[]` defaulting to `[]`,
     `saveError?: string | null` defaulting to `null`): T8a's tests already
     render `<ExpenseForm>` without them, and required props would break
     `npm run typecheck` on those existing files.
   - The form inputs remain the single source of the typed values and are
     **never** reset on a failed submit; only a successful submit may clear
     them. This is exactly T8a's `onSubmit: (values) => boolean` contract: T8a
     already returns a bare `false` on `{ ok: false }`; this task keeps that
     `false`, adds the `errors` state around it, and returns `false` from the
     new throwing-`saveExpenses` branch too — `true` only after a successful
     save, and the form clears its inputs solely on a `true` result.
   - Put `noValidate` on the `<form>` (and avoid `required` / native
     constraints on the fields) so the browser does not block submission of
     invalid values — otherwise the submit handler never runs and the red test
     cannot reach `createExpense`. Domain validation stays the single source of
     truth [1.6].
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

**Outcome:**

### T9 — UI: AI suggestion wiring ("Sugerir")

- **Status:** `[ ]`
- **Traces to:** 3.2, 3.3, 3.5 (client half: no call on empty description),
  3.6 (client half: failure never blocks manual entry), 3.7 (client half: the
  browser reaches the AI only through `fetch` to the route — first client
  caller exists here) → Design → UI (`ExpenseForm`)
- **Depends on:** T6, T8a

**Objective:** A "Sugerir" action posts the description to
`/api/suggest-category` and prefills the category select with the response;
the user can still override it, and empty descriptions or failed requests
leave manual registration fully working.

**TDD plan:**

1. **Test (red):** in `src/components/ExpenseForm.test.tsx` and, for the
   override case, `app/page.test.tsx` (both jsdom, set up in T7) with a stubbed
   global `fetch` and RTL's `fireEvent` — no new test dependency beyond T7's.
   Install the stub with `vi.stubGlobal("fetch", …)` in the `beforeEach` of
   **each** file that exercises a suggestion (the page-level case below needs it
   too) and drop it with `vi.unstubAllGlobals()` in `afterEach`. The stub must
   resolve a `fetch`-shaped object (`{ ok: true, status: 200, json: async () =>
   ({ category: "Comida" }) }`), because the green step checks `res.ok` before
   reading the payload; a bare `{ category }` would make the happy-path test
   fail for the wrong reason.
   - clicking "Sugerir" with description `"Almuerzo con cliente"` calls `fetch`
     once with `/api/suggest-category`, method `POST`, and a JSON body parsing
     back to `{ description: "Almuerzo con cliente" }`; the category select then
     holds `Comida` — assert it with `await screen.findByDisplayValue("Comida")`
     (or `waitFor`), since the state update lands only after the `fetch` promise
     resolves; a synchronous `getByDisplayValue` fails and raises an `act`
     warning. The expense must **not** be submitted: the form's `onSubmit` prop
     is never called [3.2];
   - the override wins, asserted at page level in `app/page.test.tsx` with the
     same `fetch` stub installed: fill amount, date and description, click
     "Sugerir", wait for the select to show `Comida`, then change it to
     `Transporte` and submit. The persisted entry under `STORAGE_KEY` and the
     rendered row both carry `Transporte` — the user's final choice, never the
     suggestion [3.3];
   - with an empty/whitespace description, clicking "Sugerir" does not call
     `fetch` at all and leaves the select at the user's current value, still
     editable [3.5];
   - a stubbed `fetch` that rejects (the shape a network failure or timeout
     takes on the client), and one that resolves `{ ok: false, status: 502,
     json: async () => ({ error: "…" }) }`, both leave the form usable: no
     thrown error or unhandled rejection surfacing in the test run; the
     "Sugerir" button is not left disabled — assert it explicitly once the
     failure has settled, e.g. `await waitFor(() => expect((screen.getByRole(
     "button", { name: "Sugerir" }) as HTMLButtonElement).disabled).toBe(
     false))`; and the user then selects a category manually and submits
     successfully (this last assertion is the one that really proves "does not
     block registration") [3.6].
2. **Implement (green):** a "Sugerir" button in `ExpenseForm`, declared
   `type="button"` — inside a `<form>` the HTML default is `submit`, so an
   untyped button would submit the expense on click and break [3.2] outright.
   Guard on the trimmed description (skip the request entirely when empty),
   `fetch` POST with a JSON body and `Content-Type: application/json`, check
   `res.ok` before reading the payload, on success set the category state from
   `body.category`, and on rejection or non-`ok` response swallow the failure
   and leave the form untouched — always clearing any pending flag in a
   `finally`, so no failure path can leave the button disabled.
3. **Verify:** `npm run typecheck` && `npm test`; then re-run T6's static
   key-safety check now that a client caller exists [3.7]: grep `app/` and
   `src/` for `ANTHROPIC_API_KEY` and for `NEXT_PUBLIC_` — expect **zero**
   matches in both trees (the SDK reads the key implicitly from the
   environment; its only home is the git-ignored `.env.local`), and any match
   that does turn up must sit in a server-only module
   (`src/ai/suggestCategory.ts` or `app/api/**/route.ts`) and never carry a
   `NEXT_PUBLIC_` prefix. Also confirm no client module (`"use client"`
   component) imports `src/ai/` or `app/api/` — the browser reaches the AI only
   via `fetch`. Then, with `ANTHROPIC_API_KEY` in `.env.local`, `npm run dev`
   and manually confirm one real suggestion end to end.

**Decision log:**

**Outcome:**

---

## Open items

- Feature dependencies are installed by the task that first needs them:
  `@anthropic-ai/sdk` at T5, `jsdom` + `@testing-library/react` at T7. T1 only
  installs the Next.js/TypeScript/Vitest baseline. No
  `@testing-library/jest-dom` and no `@testing-library/user-event` are added.
- The git repository root is the **parent** directory; this project lives in the
  `01-mis-finanzas/` subfolder. Root-level tooling files (`.gitignore`,
  `.env.local`, `package.json`) belong in the project folder, not the repo root.
- No `@/*` path alias exists (T1 hand-scaffolds `tsconfig.json`): modules are
  imported by relative path, which is also what T6's `vi.mock` specifier
  depends on. If an alias is ever wanted, it must be added to **both**
  `tsconfig.json` (`paths`) and `vitest.config.ts` (`resolve.alias`), and T6's
  mock note updated in lockstep.
- Shared UI contract fixed by T7 and relied on by T8a/T8b/T9: the list is a
  `<ul>` with one `<li>` per expense (`getAllByRole("listitem")`), the empty
  state reads `Aún no hay gastos registrados.`, and amounts/dates render as the
  stored values verbatim (no currency or locale formatting — out of scope).
  T8b extends the contract: the save-error copy is
  `No se pudo guardar el gasto. Vuelve a intentarlo.`, and per-field validation
  messages are linked with `aria-describedby` (the message text itself comes
  from the domain, so tests assert the link, not the copy).
- End-to-end verification with a real `ANTHROPIC_API_KEY` is a manual step at
  T9; set the key in `.env.local` (git-ignored, created in T1) before running
  `npm run dev`.
- Criterion 3.7 is verified statically twice: at T6 (server side, before any
  client caller exists) and at T9 (first client caller — the browser must reach
  the AI only via `fetch` to the route). Both tasks trace to 3.7. The check
  expects **zero** occurrences of `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_` under
  `app/` and `src/` — the literal is not required to appear in source, since
  the SDK reads it from the environment.
