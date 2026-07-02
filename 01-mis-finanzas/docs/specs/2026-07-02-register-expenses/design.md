# Design — Register expenses (with AI-suggested category)

**Status:** Draft
**Date:** 2026-07-02
**Requirements:** ./requirements.md

## Overview

A single-page Next.js (App Router) web app that lets a user record expenses and
persist them in the browser's `localStorage`. Expense fields are amount, date,
description, and a category chosen from a fixed list. A server-side Route
Handler calls Claude (Haiku 4.5) to suggest a category from the description; the
API key stays on the server and never reaches the browser.

Design goals:

- **Testable domain core** — validation and category logic are pure TypeScript,
  independent of React, storage, and network, so Vitest can exercise them
  directly (the project's TDD requirement, requirements 1.x / 2.x / 3.4).
- **Graceful AI degradation** — the suggestion is an optional convenience; every
  failure path falls back to manual selection without blocking registration
  (requirements 3.5, 3.6).
- **Isolation** — domain, storage, AI-prompt logic, the API route, and the UI
  are separate units with narrow interfaces.

## Architecture

```
┌─────────────────────────── Browser (client) ───────────────────────────┐
│  app/page.tsx (client component)                                        │
│    ├── ExpenseForm  ──(1) POST /api/suggest-category {description}       │
│    │        │                                                           │
│    │        └──(4) createExpense(input)  → src/domain/expense.ts        │
│    │                     │                                              │
│    │                     └──(5) saveExpense() → src/storage/…           │
│    └── ExpenseList  ◀────(6) loadExpenses() ── localStorage             │
└─────────────────────────────────────────────────────────────────────────┘
                    │ (2) fetch
                    ▼
┌─────────────────────────── Server (Next.js) ───────────────────────────┐
│  app/api/suggest-category/route.ts                                      │
│    └──(3) suggestCategory(description) → src/ai/suggestCategory.ts       │
│              └── Anthropic Messages API (claude-haiku-4-5)               │
│              key from process.env.ANTHROPIC_API_KEY (server only)        │
└─────────────────────────────────────────────────────────────────────────┘
```

Control flow for a registration with suggestion:

1. User types a description and requests a suggestion.
2. The client `fetch`es the Route Handler.
3. The handler calls `suggestCategory`, which prompts Claude and normalizes the
   result to a valid category (or `Otros`).
4. The client prefills the category; the user submits; `createExpense` validates.
5. On success, `saveExpense` writes to `localStorage`.
6. `ExpenseList` re-renders from the in-memory list (kept in React state).

## Components and interfaces

### Domain — `src/domain/expense.ts`

- **Responsibility:** Define the `Expense` shape, the fixed category list, and
  the validated constructor. Pure — no React, storage, or network. Satisfies
  requirements 1.1–1.7, 2.1, 2.3.
- **Interface:**

```ts
export const CATEGORIES = [
  "Comida", "Transporte", "Vivienda", "Ocio", "Salud", "Otros",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string;
  amount: number;        // positive
  date: string;          // normalized YYYY-MM-DD
  description: string;   // non-empty, trimmed
  category: Category;
}

export interface ExpenseInput {
  amount: unknown;
  date: unknown;
  description: unknown;
  category: unknown;
}

export type ValidationError = { field: keyof ExpenseInput; message: string };

export type CreateExpenseResult =
  | { ok: true; expense: Expense }
  | { ok: false; errors: ValidationError[] };

export function isCategory(value: unknown): value is Category;
export function createExpense(input: ExpenseInput): CreateExpenseResult;
```

- **Notes:** `createExpense` validates every field and returns *all* errors at
  once so the form can preserve and annotate the user's input (requirement 1.6).
  `id` is generated with `crypto.randomUUID()`. `amount` is parsed and rejected
  unless it is a finite number `> 0` (1.2). `date` is rejected unless it parses
  to a real calendar date, then normalized to `YYYY-MM-DD` (1.4, 1.7).
- **Depends on:** nothing (standard library only).

### Storage — `src/storage/expenseStorage.ts`

- **Responsibility:** Persist and load the expense list in `localStorage` behind
  a small interface. Tolerates missing/corrupt data. Satisfies 4.1, 4.2, 4.5, 4.6.
- **Interface:**

```ts
export function loadExpenses(): Expense[];        // [] if absent/corrupt (4.5)
export function saveExpenses(expenses: Expense[]): void; // throws on write failure (4.6)
```

- **Notes:** One JSON array under a single key (e.g. `mis-finanzas:expenses`).
  `loadExpenses` wraps `JSON.parse` in try/catch and validates each entry with
  `isCategory` + shape checks, dropping anything malformed and never throwing
  (4.5). `saveExpenses` lets a quota/serialization error propagate so the caller
  can surface it while keeping the user's entered values (4.6). The page adds a
  new expense by calling `saveExpenses([...current, newExpense])`.
- **Depends on:** `src/domain/expense.ts` (types, `isCategory`).

### AI prompt logic — `src/ai/suggestCategory.ts`

- **Responsibility:** Build the classification prompt, call Claude, and normalize
  the reply to a valid `Category`. Isolated from the HTTP layer so it is unit-
  testable (the normalization/fallback path, requirement 3.4). Satisfies 3.1, 3.4.
- **Interface:**

```ts
// Pure normalization — unit tested directly.
export function normalizeCategory(raw: string): Category; // fallback "Otros" (3.4)

// Calls the Anthropic API; injectable client for tests.
export async function suggestCategory(
  description: string,
  client?: Anthropic,
): Promise<Category>;
```

- **Notes:** Uses `@anthropic-ai/sdk`. `new Anthropic()` reads
  `process.env.ANTHROPIC_API_KEY`. Model `claude-haiku-4-5`, `max_tokens` small
  (e.g. 16 — the answer is one word). The system/user prompt lists the fixed
  categories and asks for exactly one. The text reply is passed through
  `normalizeCategory`, which trims, case-folds, matches against `CATEGORIES`, and
  falls back to `Otros` for anything off-list (3.4). Errors are **not** swallowed
  here — they propagate to the route, which decides the HTTP response.
- **Depends on:** `@anthropic-ai/sdk`, `src/domain/expense.ts` (`CATEGORIES`).

### API route — `app/api/suggest-category/route.ts`

- **Responsibility:** Server endpoint holding the API key. Validates the request,
  calls `suggestCategory`, returns `{ category }`. Satisfies 3.1, 3.5, 3.7.
- **Interface:** `POST /api/suggest-category`
  - Request: `{ description: string }`
  - Success: `200 { category: Category }`
  - Empty/whitespace description: `400` (client skips the call anyway, 3.5)
  - AI failure: `502 { error: string }` — client degrades gracefully (3.6)
- **Notes:** Runs server-side only, so `ANTHROPIC_API_KEY` is never bundled into
  client code (3.7). Wraps `suggestCategory` in try/catch to convert exceptions
  into a `502` the client can ignore.
- **Depends on:** `src/ai/suggestCategory.ts`.

### UI — `app/page.tsx` + `ExpenseForm`, `ExpenseList` (client components)

- **Responsibility:** Render the form and the list; hold the expense list in
  React state; wire suggestion, validation, persistence. Satisfies 2.2, 3.2, 3.3,
  3.6, 4.2, 4.3, 4.4.
- **Notes:** Client components (`"use client"`) because `localStorage` is
  browser-only. On mount, `loadExpenses()` seeds state (4.2). The category field
  is a `<select>` populated from `CATEGORIES` (2.2). A "Sugerir" button posts the
  current description to the route and, on success, sets the select to the
  suggestion (3.2) — which the user can still change (3.3). If the request fails
  or the description is empty, nothing blocks manual entry (3.5, 3.6). On submit,
  `createExpense` runs; on `ok`, `saveExpenses` persists and state updates so the
  list re-renders without reload (4.3); on error, field messages show and inputs
  are preserved (1.6). A failed `saveExpenses` shows an error without losing input
  (4.6).
- **Depends on:** domain, storage, and the API route (via `fetch`).

## Data models

```ts
export const CATEGORIES = [
  "Comida", "Transporte", "Vivienda", "Ocio", "Salud", "Otros",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string;          // crypto.randomUUID()
  amount: number;      // invariant: Number.isFinite(amount) && amount > 0
  date: string;        // invariant: matches /^\d{4}-\d{2}-\d{2}$/, real calendar date
  description: string; // invariant: trimmed, length > 0
  category: Category;  // invariant: one of CATEGORIES
}
```

Persistence schema: `localStorage["mis-finanzas:expenses"]` = JSON-encoded
`Expense[]`. No migrations in this feature.

## Data flow

**Register with AI suggestion (happy path):**

1. User enters `amount=25000`, `date=2026-07-02`, `description="Almuerzo con cliente"`.
2. User clicks "Sugerir" → `POST /api/suggest-category { description }`.
3. Route calls `suggestCategory` → Claude replies `"Comida"` → `normalizeCategory`
   confirms it is in `CATEGORIES` → `200 { category: "Comida" }` (3.1).
4. Form prefills the category select to `Comida` (3.2); user leaves it as-is.
5. Submit → `createExpense` returns `{ ok: true, expense }` (1.1) → `saveExpenses`
   appends to `localStorage` (4.1) → state updates, list shows the new row (4.3, 4.4).

**Register without AI (degraded / manual):**

1. User skips "Sugerir" (or it returns `502`) and picks `Transporte` manually (3.6).
2. Submit → `createExpense` → `saveExpenses` → list updates. AI never required.

## Error handling

| Condition | Handling | Related requirement |
|-----------|----------|---------------------|
| Amount missing / NaN / ≤ 0 | `createExpense` rejects with an amount error; input preserved | 1.2, 1.6 |
| Empty/whitespace description | `createExpense` rejects with a description error | 1.3, 1.6 |
| Missing / invalid date | `createExpense` rejects with a date error | 1.4, 1.6 |
| Category off the fixed list | `createExpense` rejects with a category error | 1.5, 2.3 |
| AI returns an off-list word | `normalizeCategory` falls back to `Otros` | 3.4 |
| Empty description on "Sugerir" | Client skips the call; route also returns `400` | 3.5 |
| AI request fails / times out | Route returns `502`; client ignores, manual entry proceeds | 3.6 |
| Corrupt `localStorage` data | `loadExpenses` returns `[]`, no crash | 4.5 |
| `localStorage` write fails | `saveExpenses` throws; UI shows error, keeps input | 4.6 |

## Testing strategy

Per the project's TDD workflow, a failing test precedes each implementation.

- **Unit — domain (`createExpense`, `isCategory`):** valid input produces a
  normalized `Expense`; each invalid field (amount ≤ 0, NaN amount, empty
  description, bad date, off-list category) yields the right error; multiple
  errors returned together; date normalization to `YYYY-MM-DD`. Covers 1.1–1.7,
  2.1, 2.3.
- **Unit — `normalizeCategory`:** exact match, case/whitespace variants, and
  off-list input falling back to `Otros`. Covers 3.4.
- **Unit — `suggestCategory`:** with an injected fake Anthropic client, a valid
  reply maps through; an off-list reply becomes `Otros`; a thrown client error
  propagates (so the route can turn it into `502`). Covers 3.1, 3.4.
- **Unit — `expenseStorage`:** round-trip save/load; corrupt JSON → `[]`; a
  write failure propagates. Covers 4.1, 4.2, 4.5, 4.6.
- **Lighter coverage:** the API route and UI components. The route's happy path
  and its `400`/`502` branches can be exercised by invoking the handler with a
  stubbed `suggestCategory`.

## Design decisions and trade-offs

- **Decision:** Next.js Route Handler for the AI call — **Rationale:** keeps
  `ANTHROPIC_API_KEY` server-side (3.7) while staying in one framework;
  **Alternative considered:** calling Claude directly from the browser with a
  Vite env key — rejected because the key would be exposed in the bundle.
- **Decision:** `localStorage` (no backend DB) — **Rationale:** simplest store
  that satisfies "persist across reloads" for a single-device personal tool;
  **Alternative considered:** a database — rejected as out of scope for the first
  feature (multi-device is explicitly out of scope).
- **Decision:** `claude-haiku-4-5` for suggestion — **Rationale:** classification
  into a fixed 6-item list is a small, latency- and cost-sensitive task where
  Haiku is a good fit; **Alternative considered:** a larger model — unnecessary
  for one-word classification.
- **Decision:** plain text reply normalized against the list, rather than the
  structured-outputs API — **Rationale:** the output space is six known strings;
  a trim + case-fold + membership check with an `Otros` fallback is simpler and
  fully covers 3.4 without extra request configuration; **Alternative
  considered:** `output_config.format` with an enum schema — viable, but adds
  configuration for no behavioral gain here.
- **Decision:** `createExpense` returns all errors at once instead of throwing on
  the first — **Rationale:** the form can annotate every bad field in one pass and
  preserve input (1.6); **Alternative considered:** throw-on-first — rejected for
  worse form UX.
