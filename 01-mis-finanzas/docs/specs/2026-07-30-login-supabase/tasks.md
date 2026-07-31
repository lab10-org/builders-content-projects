# Tasks — Sign in and sign up with Supabase Auth

**Status:** Implemented
**Date:** 2026-07-30
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

- [x] **T1** — Auth env: `readSupabaseEnv` reads and validates the Supabase settings
- [x] **T2** — Auth cookies: persistence rule (`applyPersistence`, `readsAsPersistent`, `persistCookie`)
- [x] **T3** — Auth errors: `mapAuthError` turns SDK failures into screen copy
- [x] **T4** — Domain: `validateNewCredentials` adds the 6-character password rule
- [x] **T5** — Auth server client: `createAuthClient` wired to Next's cookie store
- [x] **T6** — Server Action: `signIn`
- [x] **T7** — Server Action: `signUp`
- [x] **T8** — Middleware client: `refreshSession` refreshes tokens and preserves persistence
- [x] **T9** — Root `middleware.ts` runs `refreshSession` on navigable requests
- [x] **T10** — Extract `BrandPanel` out of the login page
- [x] **T11** — `LoginForm`: "Create an account" becomes a link to `/signup`, `onSubmit` returns `void`
- [x] **T12** — `SignupForm` component
- [x] **T13** — `/login` page calls `signIn`; delete `sessionStorage.ts`
- [x] **T14** — `/signup` page calls `signUp`

## Requirements coverage

| Requirement criterion | Task(s)        |
|-----------------------|----------------|
| 1.1                   | T6, T13        |
| 1.2                   | T6, T13        |
| 1.3                   | T6, T13        |
| 1.4                   | T3, T6, T13    |
| 1.5                   | T13            |
| 1.6                   | T6, T13        |
| 2.1                   | T11            |
| 2.2                   | T12            |
| 2.3                   | T7, T14        |
| 2.4                   | T7, T14        |
| 2.5                   | T4, T7, T14    |
| 2.6                   | T4, T7, T14    |
| 2.7                   | T3, T7, T14    |
| 2.8                   | T12, T14       |
| 2.9                   | T10, T12, T14  |
| 3.1                   | T5, T6         |
| 3.2                   | T13            |
| 3.3                   | T2, T5, T6     |
| 3.4                   | T2, T5, T6     |
| 3.5                   | T7             |
| 3.6                   | T8, T9         |
| 3.7                   | T2, T8         |
| 3.8                   | T8             |
| 4.1                   | T3             |
| 4.2                   | T3, T14        |
| 4.3                   | T3, T14        |
| 4.4                   | T3             |
| 4.5                   | T3             |
| 4.6                   | T3, T6         |
| 4.7                   | T12, T13, T14  |
| 4.8                   | T13, T14       |
| 5.1                   | T1             |
| 5.2                   | T1             |
| 5.3                   | T1             |

---

## Tasks

### T1 — Auth env: `readSupabaseEnv` reads and validates the Supabase settings

- **Status:** `[x]`
- **Traces to:** 5.1, 5.2, 5.3 → Design → `src/auth/env.ts`
- **Depends on:** none

**Objective:** `src/auth/env.ts` turns a plain environment record into a
validated `SupabaseEnv`, or throws an error naming the exact variable that is
missing, so no request is ever attempted against a half-configured connection.

**TDD plan:**

1. **Test (red):** `src/auth/env.test.ts` — `readSupabaseEnv` with both
   `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` present returns
   `{ url, publishableKey }`; with `SUPABASE_URL` absent it throws an `Error`
   whose message contains `SUPABASE_URL`; with `SUPABASE_PUBLISHABLE_KEY` absent
   it throws naming that variable; an empty string or whitespace-only value is
   treated exactly like absent (one case per variable). Plus two 5.3 cases: a
   record holding only `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
   still throws (the browser-exposed names are not accepted as a fallback), and
   a record that also holds `SUPABASE_SERVICE_ROLE_KEY` returns an object with
   exactly the two documented keys, so the secret is never carried out of the
   module.
2. **Implement (green):** `src/auth/env.ts` exporting `SupabaseEnv` and
   `readSupabaseEnv(env = process.env)`, defaulting to `process.env` only in the
   parameter so every test passes its own record. Add the two variables to the
   local `.env.local` (git-ignored) with the values from `supabase status`; do
   not add any service-role or secret key anywhere in the tree.
3. **Verify:** `npm run typecheck` && `npm test`. Plus
   `grep -rn "service_role\|SERVICE_ROLE\|sb_secret" src app` returns nothing,
   confirming 5.3 for the source tree.

**Decision log:**

- The internal helper was first named `require`, which shadows the CJS global
  and reads as an import at a glance. Renamed to `readVar`.
- The helper `.trim()`s the value it returns, not just the one it tests. A
  trailing space in `.env.local` would otherwise reach the SDK inside the URL.
- The 5.3 grep hits `src/auth/env.test.ts` twice, and that is correct: the
  fixture `"sb_secret_do-not-leak"` is the literal the test asserts is *not*
  carried out of the module. No real secret is in the tree.

**Outcome:** Done. `src/auth/env.ts` exports `SupabaseEnv` and
`readSupabaseEnv(env = process.env)`; `src/auth/env.test.ts` covers 7 cases
(both present, each absent, each blank/whitespace, `NEXT_PUBLIC_` names
rejected as a fallback, and exactly two keys returned alongside a service-role
key). `npm run typecheck` clean, `npm test` 652 passed / 33 files.
`.env.local` (git-ignored) gained `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` from `supabase status`; no secret or service-role
key was added anywhere.

### T2 — Auth cookies: persistence rule (`applyPersistence`, `readsAsPersistent`, `persistCookie`)

- **Status:** `[x]`
- **Traces to:** 3.3, 3.4, 3.7 → Design → `src/auth/cookies.ts`
- **Depends on:** none

**Objective:** One pure module owns "Remember me" as a cookie-lifetime decision:
persistent cookies get an explicit `maxAge`, browser-session cookies carry no
lifetime at all, and the choice itself is recorded in `mis-finanzas:persist` so a
later refresh can honour it.

**TDD plan:**

1. **Test (red):** `src/auth/cookies.test.ts` —
   - `PERSIST_COOKIE === "mis-finanzas:persist"` and
     `PERSIST_MAX_AGE === 400 * 24 * 60 * 60` (assert the number, not just that
     `applyPersistence` echoes the constant, so the 400-day rule can actually
     fail);
   - `applyPersistence(options, true)` returns options with
     `maxAge === PERSIST_MAX_AGE`;
   - `applyPersistence({ maxAge: 34560000, expires: someDate }, false)` returns
     options with **neither** `maxAge` nor `expires` present (the `@supabase/ssr`
     default must not be inherited — this is the assertion 3.4 lives on), and
     does not mutate the input object;
   - both branches pass every other option through untouched — given
     `{ httpOnly: true, sameSite: "lax", path: "/", secure: false }` the result
     still carries all four (T5 and T8 assert those attributes on cookies that
     went through this function);
   - `readsAsPersistent("1")` is `true`; `undefined`, `"0"`, `""` and `"true"`
     are all `false`;
   - `persistCookie(true)` returns `{ name: PERSIST_COOKIE, value: "1", options }`
     with `maxAge === PERSIST_MAX_AGE`, and `persistCookie(false)` returns value
     `"0"` with no `maxAge`/`expires`; both carry `path: "/"` so the middleware
     reads the same cookie on every route.
2. **Implement (green):** install `@supabase/ssr` (the first module that needs
   it — the only new runtime dependency this feature adds; it brings
   `@supabase/supabase-js` as its peer), then write `src/auth/cookies.ts` with
   `PERSIST_COOKIE`, `PERSIST_MAX_AGE`, `applyPersistence`, `readsAsPersistent`
   and `persistCookie`, importing only the `CookieOptions` **type** so the module
   stays pure and framework-free.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- `applyPersistence` strips the lifetime with a rest-destructure rather than
  `delete`, so it returns a new object. The same options object is handed to us
  once per cookie in a batch, and mutating it would leak one cookie's decision
  into the next.
- `persistCookie` sets `sameSite: "lax"` alongside `path: "/"`. It is not a
  session cookie, but leaving `sameSite` unset would let it default per browser,
  and a persistence marker that disagrees with the session cookies it describes
  is worse than one that matches them.
- `@supabase/ssr@0.12.4` installed here (T2 is the first module that needs it);
  it pulls `@supabase/supabase-js` as a peer. Only the `CookieOptions` **type**
  is imported, so the module stays pure.

**Outcome:** Done. `src/auth/cookies.ts` exports `PERSIST_COOKIE`,
`PERSIST_MAX_AGE`, `applyPersistence`, `readsAsPersistent` and `persistCookie`;
`src/auth/cookies.test.ts` covers 16 cases, including the 3.4 assertion that
both `maxAge` and `expires` are absent on the non-persistent branch (the
`@supabase/ssr` 400-day default must not be inherited), non-mutation of the
input, and every non-lifetime option passing through untouched in both
branches. `npm run typecheck` clean.

### T3 — Auth errors: `mapAuthError` turns SDK failures into screen copy

- **Status:** `[x]`
- **Traces to:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, and the message half of 1.4 and
  2.7 → Design → `src/auth/errors.ts`, Error handling table
- **Depends on:** none

**Objective:** `mapAuthError(error, screen)` maps every row of the design's error
table to an `AuthFailure` — a banner or a field annotation — and flags anything
it does not recognize so the caller can log the raw detail without showing it.

**TDD plan:**

1. **Test (red):** `src/auth/errors.test.ts`, one case per row, constructing
   plain objects (no SDK error classes):
   - `{ code: "invalid_credentials" }` → banner `"Invalid email or password."`,
     `recognized: true` (4.1);
   - `{ code: "user_already_exists" }` and `{ code: "email_exists" }` → banner
     `"That email is already registered. Sign in instead."` (4.2, 2.7);
   - `{ code: "weak_password", message: "Password should be at least 6 characters" }`
     → `{ kind: "field", field: "password" }` whose message carries the stated
     requirement (4.3); and `{ code: "weak_password" }` with **no** `message` →
     still a `password` field failure, falling back to the literal
     `"Password must be at least 6 characters."` so 4.3 never degrades to an
     empty annotation;
   - `{ code: "over_request_rate_limit" }` and `{ status: 429 }` → banner
     `"Too many attempts. Wait a moment and try again."` (4.4);
   - `{ name: "AuthRetryableFetchError", status: 0 }` and a bare `TypeError`
     from `fetch` → banner `"Could not reach the server. Please try again."`
     (4.5);
   - `{ code: "banana", message: "SECRET-DETAIL-42" }` → banner
     `"Something went wrong. Please try again."`, `recognized: false`, and
     `failure.message` does **not** contain `"banana"` or `"SECRET-DETAIL-42"`
     (4.6);
   - `undefined`, `null` and a bare string `"boom"` are handled as unrecognized
     (same generic banner, `recognized: false`) rather than throwing, and the
     string's own text does not reach `failure.message` (4.6).
   Run the whole table twice, once with `screen: "sign-in"` and once with
   `screen: "sign-up"`, asserting an identical result for every row — today no
   row differs by screen, and that assertion is what will fail the day someone
   makes one diverge silently.
2. **Implement (green):** `src/auth/errors.ts` with `Screen`, `AuthFailure`,
   `MappedAuthError` and `mapAuthError`, narrowing structurally on
   `code`/`status`/`name` and importing `CredentialsField` from
   `src/domain/credentials.ts`. Keep every literal message in one `const` map so
   the pages and tests never re-spell them. Do not import `MIN_PASSWORD_LENGTH`
   (it arrives in T4); the weak-password fallback stays a literal here.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- A bare `TypeError` is detected by `name === "TypeError"`, not `instanceof`.
  The module reads errors structurally so tests can build plain objects; mixing
  the two styles would make one row of the table special for no reason.
- `mapAuthError` takes the screen but does not branch on it (`_screen`). Every
  row is screen-independent today; the parameter stays because the copy is a
  product decision that may diverge, and the paired-screen assertion in the test
  is what would catch a silent divergence.
- `weak_password` prefers the service's own `message` over the local literal: if
  the service's minimum changes before ours does, its wording is the true one.

**Outcome:** Done. `src/auth/errors.ts` exports `Screen`, `AuthFailure`,
`MappedAuthError` and `mapAuthError`, every literal in one `MESSAGES` map.
`src/auth/errors.test.ts` — 16 cases, each run against **both** screens and
asserted identical. Unrecognized input (`undefined`, `null`, a string, a number,
an array) is handled without throwing, and neither the code `"banana"` nor the
detail `"SECRET-DETAIL-42"` reaches `failure.message`.

### T4 — Domain: `validateNewCredentials` adds the 6-character password rule

- **Status:** `[x]`
- **Traces to:** 2.5, 2.6 (domain half) → Design → `src/domain/credentials.ts` (extended)
- **Depends on:** none

**Objective:** Sign-up gets its own validator, built on top of
`validateCredentials` so the email rule cannot drift, rejecting passwords shorter
than `MIN_PASSWORD_LENGTH` on the `password` field.

**TDD plan:**

1. **Test (red):** extend `src/domain/credentials.test.ts` with a
   `validateNewCredentials` describe —
   - `{ email: "ana@example.com", password: "12345" }` fails with a single error
     on `password` whose message states the 6-character minimum (2.6);
   - `password: "123456"` succeeds and returns the normalized, lowercased email
     and the password verbatim (2.3 input shape);
   - a malformed email still fails on `email` (reuse one address from the
     existing table) (2.5);
   - a malformed email **and** a short password aggregate both errors, in form
     order (`["email", "password"]`), in the same shape `validateCredentials`
     uses;
   - an empty / whitespace-only / non-string password yields exactly **one**
     error on `password` — the base required-field check and the length check
     must not both fire;
   - `MIN_PASSWORD_LENGTH === 6`, mirroring `minimum_password_length` in
     `supabase/config.toml`, so the client rule cannot be stricter or looser than
     the auth service's.
2. **Implement (green):** add `MIN_PASSWORD_LENGTH` and `validateNewCredentials`
   to `src/domain/credentials.ts`, delegating to `validateCredentials` and
   layering only the length check on the value it returns (no copy of the email
   regex, no second required-field message). Reuse the exact literal
   `"Password must be at least 6 characters."` that T3's `weak_password`
   fallback uses, so the same rejection reads identically whether it came from
   this client-side check or from the SDK.
3. **Verify:** `npm run typecheck` && `npm test` — the existing
   `credentials.test.ts` cases must stay green, including "does not impose a
   minimum length", proving the sign-in rule was not changed.

**Decision log:**

- The length check is layered *outside* the delegation rather than inside a
  rewritten validator: `validateNewCredentials` calls `validateCredentials`,
  then appends a password error only when the password is present, non-blank
  and short. That is what keeps an empty password to exactly one error — the
  required-field check and the length check would otherwise both describe the
  same input.
- Appending last (instead of merging by field) is what preserves form order:
  `["email", "password"]` for a submit that is wrong on both counts.
- The message is built from `MIN_PASSWORD_LENGTH` but resolves to the exact
  literal T3 falls back to, so a client-side rejection and a service-side one
  read identically.
- The first version of the "exactly one error" case used
  `it.each([["", "empty"], ...])`, which passes under Vitest but fails `tsc`
  (tuple arity). Rewritten as `it.each([{ label, password }])` with `$label`.
  Tests passing is not the gate — typecheck is part of it.

**Outcome:** Done. `src/domain/credentials.ts` gained `MIN_PASSWORD_LENGTH = 6`
and `validateNewCredentials`; `src/domain/credentials.test.ts` grew from 32 to
41 cases. All 32 pre-existing cases stayed green untouched — including "does not
impose a minimum length" — which is the proof the sign-in rule was not changed.
`npm run typecheck` clean, `npm test` 693 passed.

### T5 — Auth server client: `createAuthClient` wired to Next's cookie store

- **Status:** `[x]`
- **Traces to:** 3.1, and the write half of 3.3/3.4 → Design →
  `src/auth/serverClient.ts`
- **Depends on:** T1, T2

**Objective:** `createAuthClient(persist?)` builds the one Supabase client the
Server Actions use, reading the request cookie store and writing session cookies
through `applyPersistence`, plus the `mis-finanzas:persist` cookie when a
persistence choice is being made.

**TDD plan:**

1. **Test (red):** `src/auth/serverClient.test.ts` — `vi.mock("@supabase/ssr")`
   to capture the `cookies` adapter handed to `createServerClient`, and
   `vi.mock("next/headers")` with a fake awaited cookie store exposing
   `getAll` and `set` (the persist choice is read through the same `getAll`, so
   the fake needs no other method). Assert:
   - `createAuthClient(true)` passes the URL and key returned by
     `readSupabaseEnv` as `createServerClient`'s first two arguments (3.1);
   - invoking the captured `setAll([{ name: "sb-x-auth-token", value: "v", options: {} }])`
     writes that cookie on the store with `maxAge` set, `httpOnly: true`,
     `sameSite: "lax"`, `path: "/"` and `secure: false` for the
     `http://127.0.0.1` URL, and also writes `PERSIST_COOKIE` with value `"1"`
     (3.3);
   - `createAuthClient(false)` writes the same session cookie with **no**
     `maxAge` and no `expires`, and `PERSIST_COOKIE` with `"0"` (3.4);
   - `createAuthClient()` (no argument) preserves the existing choice: with the
     fake store returning `PERSIST_COOKIE = "1"`, `setAll` still stamps
     `maxAge` and the persist cookie is not rewritten to `"0"`; with the persist
     cookie absent, the session cookie is written with neither `maxAge` nor
     `expires` (the safe default of `readsAsPersistent`);
   - the adapter's `getAll` reads through to the store's `getAll`.
2. **Implement (green):** `src/auth/serverClient.ts` exporting
   `createAuthClient(persist?: boolean)`, using `createServerClient` from
   `@supabase/ssr`, `await cookies()` from `next/headers`, `readSupabaseEnv` and
   the T2 helpers (`applyPersistence`, `readsAsPersistent`, `persistCookie`).
   `secure` is derived from the configured URL, so it stays off on
   `http://127.0.0.1`.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- "Establishing" vs "serving" a session is distinguished by
  `persist !== undefined`, not by the boolean's truthiness. `createAuthClient(false)`
  is an explicit choice and must write `PERSIST_COOKIE = "0"`; `createAuthClient()`
  must write no marker at all. Collapsing the two would let a page render
  silently re-decide what the user chose at sign-in.
- `secure` follows the configured URL (`https://`), not `NODE_ENV`. The local
  stack is plain http on 127.0.0.1, where a `Secure` cookie is simply dropped —
  the session would vanish with no error to explain it.
- The mocked `createServerClient` is typed with a rest parameter. A zero-arg
  `vi.fn` records calls as the empty tuple, so indexing `mock.calls[0][0]`
  passes Vitest but fails `tsc` (TS2493).

**Outcome:** Done. `src/auth/serverClient.ts` exports `createAuthClient(persist?)`,
building the SDK client over `await cookies()` and stamping every written cookie
with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, URL-derived `secure`, and
the lifetime `applyPersistence` decides. `src/auth/serverClient.test.ts` — 7
cases covering 3.1, 3.3, 3.4 and both no-argument branches (recorded choice
preserved; absent marker defaulting to a browser session, with no marker
rewritten either way). `npm run typecheck` clean, `src/auth/` 46 tests green.

### T6 — Server Action: `signIn`

- **Status:** `[x]`
- **Traces to:** 1.1, 1.2 (session half), 1.3 (server re-validation), 1.4, 1.6,
  3.1, 3.3, 3.4, 4.6 (logging) → Design → `src/auth/actions.ts`
- **Depends on:** T3, T5

**Objective:** `signIn({ email, password, remember })` re-validates server-side,
authenticates against the auth service with the persistence the user chose, and
returns `{ ok: true }` or `{ ok: false, failure }` — never a redirect, never a
leaked error.

**TDD plan:**

1. **Test (red):** `src/auth/actions.test.ts` (`signIn` describe), with
   `vi.mock("./serverClient")` returning a fake client whose
   `auth.signInWithPassword` is a spy, and `vi.mock("./errors", async (importOriginal) => …)`
   wrapping the **real** `mapAuthError` in a `vi.fn` (a spy over the actual
   implementation, not a stub) so the same cases can assert both the screen
   argument and the real copy that reaches the caller:
   - valid input → `createAuthClient` called with `true` when `remember: true`
     and `false` when `remember: false` (3.3/3.4); `signInWithPassword` called
     once with the **normalized** (trimmed, lowercased) email and the password
     verbatim; returns `{ ok: true }` (1.1, 1.2);
   - malformed email → returns a `field` failure on `email`, and
     `signInWithPassword` is **never** called and `createAuthClient` is never
     called (1.3); same for an empty password, on the `password` field;
   - SDK returns `{ error: { code: "invalid_credentials" } }` → returns
     `{ ok: false, failure }` with the banner from `mapAuthError`, and the result
     is identical whether the email exists or not (1.4); assert the spied
     `mapAuthError` was called with that error and the `"sign-in"` screen;
   - `signInWithPassword` **rejecting** (e.g. a `TypeError` from `fetch`) →
     `signIn` resolves with `{ ok: false, failure }` rather than propagating, so
     an unreachable service surfaces as copy (4.5 surface) and not a server
     crash; `createAuthClient` throwing (missing env) is **not** caught — assert
     it propagates, per the design's "the action never runs" for 5.2;
   - unrecognized error → `console.error` (spied) is called with the raw error
     and the returned message is the generic one (4.6); assert the spied log
     arguments do not contain the password (1.6), and that `console.error` is
     **not** called on the recognized `invalid_credentials` path;
   - the returned object never contains the password on any path (1.6).
2. **Implement (green):** `src/auth/actions.ts` with `"use server"`,
   `AuthResult`, and `signIn` only — `signUp` arrives in T7. Validate with
   `validateCredentials`, then `await createAuthClient(remember)` outside the
   `try`, and wrap only the `signInWithPassword` call so a thrown transport error
   goes through `mapAuthError` like a returned one.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- Only `validated.errors[0]` is returned. `AuthFailure` describes one failure,
  and the server path is the one reached without the form, where reporting the
  first problem is enough; the page still annotates every field at once from its
  own validation.
- `console.error` logs the error alone, never the input. The password is not in
  scope at that point, which is a stronger guarantee than remembering to strip
  it.
- `createAuthClient` is awaited outside the `try` on purpose: a missing env
  variable must surface as a real error (5.2), not be dressed up as a failed
  sign-in the user could retry forever.

**Outcome:** Done. `src/auth/actions.ts` (`"use server"`) exports `AuthResult`
and `signIn`; `src/auth/actions.test.ts` — 13 cases covering the happy path with
a normalized email and verbatim password, the remember flag reaching
`createAuthClient`, both server-side re-validation refusals (service never
contacted), the identical banner for wrong credentials, a rejected call
resolving as copy, a configuration error propagating, and the unrecognized-error
log carrying the detail but not the password. `npm run typecheck` clean.

### T7 — Server Action: `signUp`

- **Status:** `[x]`
- **Traces to:** 2.3, 2.4, 2.5, 2.6 (server re-validation), 2.7, 3.5 → Design →
  `src/auth/actions.ts`, "Registered but no session returned"
- **Depends on:** T4, T6

**Objective:** `signUp({ email, password })` registers the account with a
persistent session, refuses to report success when no session came back, and
returns the already-registered failure instead of establishing anything.

**TDD plan:**

1. **Test (red):** `src/auth/actions.test.ts` (`signUp` describe), same fake
   client with `auth.signUp` spied:
   - valid input → `createAuthClient` called with `true` (3.5); `signUp` called
     once with the normalized (trimmed, lowercased) email and the password
     verbatim; response carrying a session → `{ ok: true }` (2.3, 2.4);
   - password of 5 characters → `field` failure on `password`, and neither
     `createAuthClient` nor `auth.signUp` is called (2.6); malformed email →
     `field` failure on `email`, same two spies never called (2.5);
   - error `{ code: "user_already_exists" }` → `{ ok: false }` with the
     already-registered banner from `mapAuthError(error, "sign-up")` (2.7);
   - response with `{ data: { user: {...}, session: null }, error: null }` →
     `{ ok: false }` with the generic banner and `console.error` called, i.e.
     treated as an unrecognized failure rather than success (2.4 guard);
   - on every path the returned object and the spied `console.error` arguments
     contain no password.
2. **Implement (green):** add `signUp` to `src/auth/actions.ts`, sharing the
   validate → call → map pipeline with `signIn` but using
   `validateNewCredentials` and `persist: true`.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- The no-session guard is expressed as `toFailure(new Error(...), "sign-up")`
  rather than a bespoke branch, so it inherits the generic banner *and* the
  server log for free. The Error's message names the likely cause
  (`enable_confirmations`), which is what the person who flipped that flag will
  need to read in the log.
- `signUp` shares `fieldFailure`/`toFailure` with `signIn` but not a generic
  helper: the two differ in validator, persistence and the session check, and
  factoring that into one parameterized function would hide all three
  differences behind flags.

**Outcome:** Done. `signUp` added to `src/auth/actions.ts`, using
`validateNewCredentials` and `createAuthClient(true)` (3.5). Tests grew to 19:
registration with a normalized email, the 5-character password and the malformed
email both refused before any call, the already-registered banner mapped with
the `"sign-up"` screen, the registered-but-no-session response reported as a
failure *and* logged, and the password absent from both the result and the log.
`npm run typecheck` clean.

### T8 — Middleware client: `refreshSession` refreshes tokens and preserves persistence

- **Status:** `[x]`
- **Traces to:** 3.6, 3.7, 3.8 → Design → `src/auth/middlewareClient.ts`
- **Depends on:** T1, T2

**Objective:** `refreshSession(request)` returns a response carrying any
refreshed session cookies, written with the lifetime the session was established
with, and never lets a failed refresh fail the request.

**TDD plan:**

1. **Test (red):** `src/auth/middlewareClient.test.ts`, building a real
   `new NextRequest("http://127.0.0.1:3000/onboarding/profile")` (Vitest's
   default `node` environment is enough — no jsdom docblock) and mocking
   `@supabase/ssr` to capture the cookie adapter and to control `auth.getUser`:
   - `createServerClient` receives the URL and key from `readSupabaseEnv`, and
     the captured `getAll` reads through to `request.cookies`;
   - `getUser()` is called (this is the call that actually performs the
     refresh, 3.6);
   - invoking the captured `setAll` with a refreshed token writes the cookie on
     **both** the request and the returned response;
   - with `PERSIST_COOKIE = "1"` on the request the written cookie carries
     `maxAge`; with `"0"` or absent it carries neither `maxAge` nor `expires`
     (3.7);
   - `refreshSession` never writes `PERSIST_COOKIE` itself — after a refresh the
     persist cookie on the response is unchanged, so a browser session cannot
     become persistent and a persistent one cannot degrade (3.7);
   - `getUser()` **resolving** `{ data: { user: null }, error: { code: "refresh_token_not_found" } }`
     — the shape the SDK actually returns for an unusable refresh token —
     `refreshSession` still resolves with a `NextResponse` and does not throw,
     and whatever cookies `setAll` wrote on that path (including cookie
     clearing) are still on the response, i.e. the user is simply signed out
     (3.8);
   - `getUser()` **rejecting** (transport failure) → same guarantee:
     `refreshSession` resolves with a `NextResponse` and does not throw, and the
     response is still usable as the middleware's return value (3.8).
2. **Implement (green):** `src/auth/middlewareClient.ts` with
   `createServerClient` from `@supabase/ssr` over `request.cookies`,
   `NextResponse.next({ request })`, `readSupabaseEnv`, and
   `readsAsPersistent`/`applyPersistence` from T2 to decide each written
   cookie's lifetime, plus a `try/catch` around `getUser` (the returned-error
   shape needs no branch — it is simply not inspected).
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- The canonical Supabase snippet reassigns `response = NextResponse.next(...)`
  *inside* `setAll`. Not done here: cookies are written onto the single response
  object this function returns, which is both simpler and testable — a
  reassigned response would leave the caller holding the pre-refresh one.
- `getUser()`'s result is not inspected at all. Whatever the outcome — user,
  error, or clearing — the SDK has already written the cookies it implies
  through `setAll`, so branching on it would only add a way to disagree with it.
- `it.each` over cookie fixtures needed an explicit `Record<string, string>`
  type argument: TS otherwise infers a union with an optional key from
  `[{ [PERSIST_COOKIE]: "0" }, {}]` and rejects it.

**Outcome:** Done. `src/auth/middlewareClient.ts` exports `refreshSession`;
`src/auth/middlewareClient.test.ts` — 10 cases over a real `NextRequest`,
covering the connection, read-through, `getUser()` being called (3.6), the
double write onto request *and* response, persistence preserved in both
directions, the marker never rewritten (3.7), and both unrefreshable paths —
SDK-reported and thrown — still resolving to a usable response (3.8).

### T9 — Root `middleware.ts` runs `refreshSession` on navigable requests

- **Status:** `[x]`
- **Traces to:** 3.6 (wiring) → Design → `middleware.ts` (project root)
- **Depends on:** T8

**Objective:** Every navigable request passes through the middleware, which does
exactly one thing — delegate to `refreshSession` — while static assets and API
routes are excluded by the matcher. The new root-level files are brought under
`tsc`'s `include` so `npm run typecheck` actually covers them.

**TDD plan:**

1. **Test (red):** `middleware.test.ts` at the project root — with
   `vi.mock("./src/auth/middlewareClient")` returning a spy `refreshSession`
   that resolves a sentinel `NextResponse`:
   - `middleware(new NextRequest(new URL("http://localhost:3000/login")))`
     resolves to that exact sentinel and calls `refreshSession` once with the
     request (delegation, and no redirect of its own — assert the returned
     response has no `location` header, since route guards are out of scope);
   - building `new RegExp("^" + config.matcher[0] + "$")`, the paths `/`,
     `/login`, `/signup` and `/onboarding/profile` match, while
     `/_next/static/chunk.js`, `/_next/image`, `/favicon.ico` and
     `/api/suggest-category` do not.
   The file runs in Vitest's default `node` environment (no jsdom docblock) and
   is picked up by the default `include` glob, which is repo-root relative.
2. **Implement (green):** `middleware.ts` at the project root exporting
   `middleware` and `config` exactly as the design specifies (matcher
   `["/((?!_next/static|_next/image|favicon.ico|api/).*)"]`), delegating to
   `refreshSession`. Because `app/` sits at the repo root, Next only picks the
   file up there — it cannot live under `src/`. Add `"middleware.ts"` and
   `"middleware.test.ts"` to `include` in `tsconfig.json`, whose current entries
   (`app/**`, `src/**`, `next-env.d.ts`, `.next/types/**`) match neither file, so
   both would otherwise be silently skipped by `tsc`.
3. **Verify:** `npm run typecheck` && `npm test`. Confirm typecheck really sees
   the new files: `npx tsc --noEmit --listFiles | grep -c "/middleware\.\(test\.\)\?ts$"`
   reports both. Manual: `npm run dev`, load `/login`, confirm the page renders
   and the server logs no middleware error.

**Decision log:**

- `middleware.ts` sits at the project root and imports `./src/auth/middlewareClient`.
  Next only picks the file up beside `app/`, which is at the root here, so it
  cannot live under `src/` no matter how much it looks like it belongs there.
- `tsconfig.json`'s `include` gained both `middleware.ts` and
  `middleware.test.ts`. Neither matched `app/**` or `src/**`, so `tsc` had been
  skipping them silently — verified after the change with
  `npx tsc --noEmit --listFiles | grep -c "/middleware\.\(test\.\)\?ts$"` → 2.
- The "redirects nobody" case is not busywork: it is the assertion that fails
  the day a route guard is added here without a spec change.

**Outcome:** Done. `middleware.ts` exports `middleware` (pure delegation to
`refreshSession`) and `config` with the matcher from the design.
`middleware.test.ts` — 10 cases: delegation and identity of the returned
response, no `location` header, and the matcher regex accepting `/`, `/login`,
`/signup`, `/onboarding/profile` while rejecting `/_next/static/chunk.js`,
`/_next/image`, `/favicon.ico` and `/api/suggest-category`. `npm run typecheck`
clean, `npm test` 739 passed. The manual `npm run dev` pass is folded into
T14's end-to-end smoke.

### T10 — Extract `BrandPanel` out of the login page

- **Status:** `[x]`
- **Traces to:** 2.9 → Design → `src/components/BrandPanel.tsx` (extracted)
- **Depends on:** none

**Objective:** The teal half of the split lives in its own component so the
sign-up screen renders the identical panel, with no behaviour or markup change to
`/login`.

**TDD plan:**

1. **Test (red):** `src/components/BrandPanel.test.tsx`, opening with the
   `// @vitest-environment jsdom` docblock every UI test in this repo uses
   (`vitest.config` defaults to `node`) — rendering `<BrandPanel />` on its own
   shows the wordmark (`"Northstar"`), the tagline
   `"Build the financial future you deserve."` and the supporting copy
   (`/turns everyday money decisions/`), and lists the three reassurances
   verbatim as `listitem`s in order; and `queryAllByRole("heading")` is empty
   (the display copy must stay a `<p>`, as the current comment explains, so the
   panel can never open a page with an `<h2>` — `Wordmark` renders a `<span>`,
   so an empty heading list is the real assertion here). The test fails because
   the module does not exist.
2. **Implement (green):** move `BrandPanel` and `REASSURANCES` verbatim out of
   `app/login/page.tsx` into `src/components/BrandPanel.tsx` (exporting
   `BrandPanel`), import it in the login page, and drop the now-unused `Icon` and
   `Wordmark` imports there. No markup or class changes, and no `"use client"`
   directive: the component holds no state and is only rendered from client pages.
3. **Verify:** `npm run typecheck` && `npm test` — the existing
   `app/login/page.test.tsx` brand-panel describe must stay green untouched,
   which is the proof the extraction changed nothing.

**Decision log:**

- Moved verbatim, including the comment explaining why the tagline is a `<p>`
  and not a heading. That comment is the reason the "opens no heading of its
  own" case exists, and separating the two would strand both.
- The panel's own test asserts the reassurances as an ordered list of
  `listitem` text, not three `getByText` calls: order is part of the design, and
  three independent lookups would pass on a shuffled panel.

**Outcome:** Done. `src/components/BrandPanel.tsx` holds `BrandPanel` and
`REASSURANCES`; `app/login/page.tsx` imports it and no longer imports `Icon` or
`Wordmark`. `src/components/BrandPanel.test.tsx` — 3 cases. The pre-existing
brand-panel `describe` in `app/login/page.test.tsx` stayed green untouched,
which is the proof the extraction changed nothing.

### T11 — `LoginForm`: "Create an account" becomes a link to `/signup`, `onSubmit` returns `void`

- **Status:** `[x]`
- **Traces to:** 2.1 → Design → Changed and removed (`LoginForm`,
  `app/login/page.tsx`)
- **Depends on:** none

**Objective:** The sign-in screen has a real door to the sign-up screen, and
`LoginForm`'s `onSubmit` no longer pretends its return value is used.

**TDD plan:**

1. **Test (red):** in `src/components/LoginForm.test.tsx` — extend the existing
   "offers the account-recovery and sign-up routes" case: "Create an account" is
   a link (`screen.getByRole("link", { name: "Create an account" })`) whose
   `href` is `/signup`, and `queryByRole("button", { name: "Create an account" })`
   is `null`. Assert the `href` only — do not click it: `next/link` needs the App
   Router context to navigate, and the routing itself is Next's, not ours. This
   is the first `next/link` rendered under test in this repo; if the render
   throws for lack of an App Router context, `vi.mock("next/link")` with a plain
   anchor forwarding `href` and children, and note it in the Decision log (T12
   and T14 will reuse the same approach). All other existing cases stay as they
   are.
2. **Implement (green):** replace the inert `<button>` with `<Link href="/signup">`
   from `next/link`, keeping the same classes; narrow the `onSubmit` prop type
   from `(submission: LoginSubmission) => boolean` to
   `(submission: LoginSubmission) => void` and update the doc comment that says
   the return value reports acceptance. Leave "Forgot password?" inert (out of
   scope).
3. **Verify:** `npm run typecheck` && `npm test`. Note that TypeScript still
   accepts a value-returning function where a `void` return is expected, so
   neither `app/login/page.tsx`'s `handleSubmit` nor the test's
   `vi.fn(() => true)` / `mockReturnValue(false)` will fail to compile — leave
   both untouched here (T13 rewrites the page's handler). The green signal is
   the new link assertion plus every existing `LoginForm` case still passing.

**Decision log:**

- `next/link` rendered under jsdom with no App Router context and no mock, so
  the fallback the plan allowed for (`vi.mock("next/link")`) was not needed.
  T12 and T14 follow the same approach: assert the `href`, never click.
- As the plan predicted, narrowing `onSubmit` to `void` broke no caller —
  TypeScript accepts a value-returning function where `void` is expected — so
  the page's handler and the existing `vi.fn(() => true)` were left untouched
  for T13 to rewrite.

**Outcome:** Done. `LoginForm` renders `<Link href="/signup">` in place of the
inert button, `onSubmit` is typed `=> void`, and the doc comment no longer
claims the return value reports acceptance. `LoginForm.test.tsx` grew to 15
cases; "Forgot password?" stays inert, per scope.

### T12 — `SignupForm` component

- **Status:** `[x]`
- **Traces to:** 2.2, 2.8 (component half), 2.9, 4.7 → Design →
  `src/components/SignupForm.tsx`
- **Depends on:** none

**Objective:** A sign-up form column exists with the same `TextField`,
`PasswordField` and `Button` as `LoginForm`, no "Remember me" or "Forgot
password?", a link back to `/login`, per-field error annotation and a
`role="alert"` banner row — and it never clears what the user typed.

**TDD plan:**

1. **Test (red):** `src/components/SignupForm.test.tsx`, opening with the
   `// @vitest-environment jsdom` docblock (Vitest's default environment is
   `node`, and every component test in `src/components/` carries this line):
   - renders an Email field, a Password field and a submit button named
     "Create account", and **no** checkbox and no "Forgot password?" control
     (2.9);
   - typing and submitting calls `onSubmit` once with
     `{ email, password }` exactly as typed (no trimming or casing in the
     component — normalization belongs to the domain layer), and the submit
     event's default is prevented;
   - submitting with both fields empty still calls `onSubmit` with the empty
     strings (`noValidate`, mirroring `LoginForm`) — otherwise the browser would
     block the submission and `validateNewCredentials` in T14 would never see it;
   - after a submit the typed email and password are still in the inputs, i.e.
     the component never clears itself (2.8 — the page can only keep the values
     if the form does);
   - `errors={[{ field: "password", message: "…" }]}` renders that message and
     marks the password input `aria-invalid`, leaving the email input with no
     `aria-invalid`; the same, mirrored, for `field: "email"` (this is the
     surface 4.3 lands on in T14);
   - `saveError="Boom"` renders `"Boom"` inside a `role="alert"` node, and
     `queryByRole("alert")` is `null` when `saveError` is `null` (4.7);
   - a link named "Sign in" whose `href` is `/login` (2.2). Assert the `href`
     only — do not click it: `next/link` needs the App Router context to
     navigate, and the routing itself is Next's, not ours.
2. **Implement (green):** `src/components/SignupForm.tsx` mirroring `LoginForm`'s
   structure and Tailwind classes, exporting `SignupSubmission` and taking
   `onSubmit`, `errors` and `saveError` exactly as the design's interface says,
   with `noValidate`, `autoComplete="email"` / `autoComplete="new-password"`,
   the same `errorFor` helper returning `undefined` (not `""`) so the fields omit
   the aria attributes, and a `next/link` `<Link href="/login">` styled like
   `LoginForm`'s sign-up line. Import `CredentialsError`/`CredentialsField` types
   from `src/domain/credentials.ts` (both already exist — no domain change is
   needed here). The component performs no validation of its own. **Open user
   decision — copy is not fixed by requirements.md, design.md or any mockup:**
   use heading "Create your account", subtitle "Start building your Northstar
   plan.", submit button "Create account" and the sign-in line "Already have an
   account? Sign in" only after the user confirms or supplies alternatives (see
   Open items); record the final choice in the Decision log so T14's page test
   can be written against it.
3. **Verify:** `npm run typecheck` && `npm test`.

**Decision log:**

- **Copy confirmed by the user** and now fixed in `design.md`
  (§ `SignupForm` → *Copy*), which is the source of truth T14 asserts against:
  heading "Create your account", subtitle "Start building your Northstar plan.",
  submit "Create account", footer "Already have an account?" + "Sign in",
  password placeholder "Create a password".
- `autoComplete="new-password"` rather than `current-password`: this is where a
  password manager should offer to generate one.
- The "exactly as typed" case had to be corrected mid-task. `input[type=email]`
  sanitizes surrounding whitespace in the DOM itself, so the email arrives
  trimmed however the component is written. The assertion now pins what is
  actually ours — no lowercasing, and a password whose spaces survive — and says
  why in a comment.

**Outcome:** Done. `src/components/SignupForm.tsx` mirrors `LoginForm`'s
structure and classes without "Remember me" or "Forgot password?", with
`noValidate`, per-field `aria-invalid` annotation, a `role="alert"` banner row
and a `<Link href="/login">`. `src/components/SignupForm.test.tsx` — 11 cases
including the never-clears-itself guarantee (2.8) and the empty-fields submit
that keeps the browser from blocking what `validateNewCredentials` must judge.
`npm run typecheck` clean.

### T13 — `/login` page calls `signIn`; delete `sessionStorage.ts`

- **Status:** `[x]`
- **Traces to:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.2, 4.7, 4.8 → Design → Data
  flow (sign-in), Changed and removed
- **Depends on:** T6, T10, T11

**Objective:** The sign-in screen authenticates for real: it validates, calls the
`signIn` action, navigates only on success, renders the failure in the existing
alert row, and the app keeps no record of who is signed in outside the cookies.

**TDD plan:**

1. **Test (red):** rewrite `app/login/page.test.tsx` with
   `vi.mock("../../src/auth/actions")` and a `useRouter` mock exposing **both**
   `push` and `refresh` (today it exposes only `push`). `handleSubmit` becomes
   async, so every assertion after a submit must await the microtask —
   `await screen.findBy…` / `await waitFor(...)` — rather than asserting
   synchronously after `fireEvent`. Cases:
   - a valid submit calls `signIn` once with the normalized email
     (`" Ana@Example.COM "` → `ana@example.com`), the password verbatim, and
     `remember: true` when the checkbox is ticked / `false` when it is not
     (1.1, 3.3/3.4 pass-through), then `router.push("/onboarding/profile")`
     followed by `router.refresh()` (1.2);
   - an invalid email annotates the field and `signIn` is **never** called and
     nothing navigates (1.3); the existing "stops annotating a field once it is
     corrected" and empty-password cases stay, now against the action mock;
   - `signIn` resolving `{ ok: false, failure: { kind: "banner", message: "Invalid email or password." } }`
     renders that message in a `role="alert"` node, does **not** navigate, and
     the typed email and password are still in the inputs (1.4, 1.5, 4.7);
   - a `field` failure (`{ kind: "field", field: "password", message: "…" }`)
     lands on the named input and does not navigate;
   - a second submit clears the previous banner before the new call resolves
     (4.8);
   - no test may reference `SESSION_KEY`/`loadSession`, and a case asserts that
     after a successful sign-in `localStorage` and `sessionStorage` are both
     empty and the page wrote nothing about the user anywhere (3.2), and that
     the password appears in no argument other than the `signIn` call (1.6).
   - the brand-panel `describe` stays as it is (T10 left it green); it is the
     proof the rewrite changed only the submit path.
2. **Implement (green):** make `handleSubmit` async (`Promise<void>`), drop
   `saveSession` and the `SAVE_ERROR_MESSAGE` constant, clear `errors` and
   `saveError` at the top of every submit, `await signIn({ email: result.credentials.email, password, remember })`,
   route the returned `AuthFailure` to either `saveError` (`kind: "banner"`) or
   `errors` (`kind: "field"`), and on `ok` call `router.push("/onboarding/profile")`
   then `router.refresh()`. Delete `src/storage/sessionStorage.ts` and
   `src/storage/sessionStorage.test.ts`, and fix the stale comment in
   `src/storage/profileStorage.ts:6`, which names the deleted module.
3. **Verify:** `npm run typecheck` && `npm test`; `grep -rn "sessionStorage" src app`
   returns only the browser-native uses in `app/onboarding/know-me/*`.

**Decision log:**

- Both state resets moved to the *top* of `handleSubmit`, before validation.
  Clearing them per-branch was what allowed a stale banner to sit next to a
  fresh field error (4.8).
- The three "when the session cannot be stored" cases were deleted rather than
  ported: quota failures were a property of `localStorage`, and there is no
  browser write left to fail. Their role is taken by the new
  auth-service-rejection cases.
- `grep` still reports `sessionStorage` in `app/login/page.test.tsx` — the
  browser-native API, used by the case asserting both stores stay empty. That is
  the 3.2 assertion itself, not a leftover of the deleted module.
- The comment in `profileStorage.ts` that named `sessionStorage` now names
  `transactionStorage`, the key scheme it actually mirrors.

**Outcome:** Done. `app/login/page.tsx` awaits `signIn`, routes the returned
failure to the banner or the field, and navigates with `push` + `refresh` only
on success. `src/storage/sessionStorage.ts` and its test are deleted (`git rm`).
`app/login/page.test.tsx` rewritten: 21 cases — normalized email, remember flag
passed through, `refresh` called, browser storage left empty, password confined
to the action, format errors never reaching the service, and the banner/field/
clearing cases. `npm run typecheck` clean, `npm test` 740 passed.

### T14 — `/signup` page calls `signUp`

- **Status:** `[x]`
- **Traces to:** 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 4.2, 4.3, 4.7, 4.8 →
  Design → `app/signup/page.tsx`
- **Depends on:** T7, T10, T12

**Objective:** `/signup` exists as the mirror of `/login`: same two-panel layout,
`validateNewCredentials` before any call, the `signUp` action behind it, and a
successful registration lands on `/onboarding/profile`.

**TDD plan:**

1. **Test (red):** `app/signup/page.test.tsx`, opening with the
   `// @vitest-environment jsdom` docblock every UI test in this repo carries
   (Vitest's default environment is `node`), `vi.mock("../../src/auth/actions")`
   for `signUp`, and a `next/navigation` mock built from `vi.hoisted` spies
   exposing **both** `push` and `refresh` (the existing login test hoists only
   `push`). `handleSubmit` is async, so every assertion after a submit must await
   the microtask — `await screen.findBy…` / `await waitFor(...)` — rather than
   asserting synchronously after `fireEvent`. Cases:
   - renders `BrandPanel` and `SignupForm` in the same two-panel layout as the
     login page (2.9);
   - a valid submit calls `signUp` once with the normalized email
     (`" Ana@Example.COM "` → `ana@example.com`) and the password verbatim, then
     `router.push("/onboarding/profile")` followed by `router.refresh()`, with no
     intermediate confirmation step rendered (2.3, 2.4);
   - a malformed email annotates the email field, `signUp` is **never** called
     and nothing navigates (2.5);
   - a 5-character password annotates the password field, `signUp` is **never**
     called and nothing navigates (2.6);
   - `{ ok: false, failure: { kind: "banner", message: "That email is already registered. Sign in instead." } }`
     renders that message in a `role="alert"` node, does not navigate, and leaves
     the typed values in place (2.7, 2.8, 4.7); the copy comes from `mapAuthError`
     (T3), so the page itself spells no failure message (4.2);
   - a `field` failure on `password` (the `weak_password` shape) annotates the
     password input and marks it `aria-invalid`, and nothing navigates (4.3);
   - a second submit clears the previous banner before the new call resolves
     (4.8);
   - the "Sign in" link is asserted by `href` only, never clicked: `next/link`
     needs the App Router context to navigate, and the routing is Next's, not
     ours (T12 owns that assertion at the component level).
2. **Implement (green):** `app/signup/page.tsx` — a `"use client"` component
   mirroring the login page against `validateNewCredentials`, `signUp` and
   `SignupForm`: `handleSubmit` is `async (submission) => Promise<void>`, clears
   `errors` and `saveError` at the top of every submit, passes
   `result.credentials.email` (normalized) and the password verbatim to `signUp`,
   and routes the returned `AuthFailure` to either `saveError` (`kind: "banner"`)
   or `errors` (`kind: "field"`). It renders `BrandPanel` inside the same
   `<main>` / max-width wrapper markup as `app/login/page.tsx`. No new
   `tsconfig.json` entry is needed — `include` already covers `app/**`.
3. **Verify:** `npm run typecheck` && `npm test`. Manual smoke with the local
   stack up (`supabase start`, `npm run dev`): register a fresh address, land on
   `/onboarding/profile`, confirm in devtools that `sb-…-auth-token` cookies
   exist with an expiry and `localStorage` holds no session. This is the one
   manual end-to-end pass over the feature; its automated equivalent belongs to
   `/verify-implementation`.

**Decision log:**

- The page is a near-mirror of `app/login/page.tsx` rather than a shared
  abstraction: the two differ in validator, action, submission shape and copy,
  and folding them into one parameterized page would hide all four behind flags.
- Manual smoke run against the live stack (`supabase start` already up,
  `npm run dev` on **:3001** — port 3000 was taken by another app): registering
  `smoke-2026073001@example.com` landed on `/onboarding/profile` with no
  confirmation step; `auth.users` holds the row, confirmed;
  `document.cookie` exposes only `mis-finanzas:persist=1` — the session token is
  absent from JS, which is the httpOnly guarantee holding — and both
  `localStorage` and `sessionStorage` are empty (3.2). The only console error was
  a 404 for `/favicon.ico`. This also covers T9's manual check: the middleware
  ran on every one of those navigations without error.

**Outcome:** Done. `app/signup/page.tsx` renders `BrandPanel` + `SignupForm` in
the login page's layout, validates with `validateNewCredentials`, calls `signUp`
and navigates with `push` + `refresh`. `app/signup/page.test.tsx` — 11 cases
covering the mirrored layout, the single `<h1>`, the sign-in link, the
normalized-email registration, no confirmation step, both client-side refusals,
the already-registered banner, values preserved, the weak-password field
annotation and the banner clearing. `npm run typecheck` clean, `npm test` 751
passed / 41 files.

---

## Open items

- The two environment variables live only in the git-ignored `.env.local`;
  nothing committed documents them. Consider a committed `.env.example` or a
  README line in a follow-up — the design does not call for one.
- End-to-end proof that the cookies reach the browser and that Supabase accepts
  the credentials is deliberately outside these tasks: it belongs to the
  `/verify-implementation` loop, whose sign-in case must first register a unique
  email through the UI (no seeded password hash in the repo). T13's Verify step
  additionally records a manual Remember-me cookie-expiry smoke pass over
  `/login` + `signIn`.
- Route guards, sign-out and password reset stay out of scope; `middleware.ts`
  (T9) is the single place a future guard will edit.
- ~~Open user decision: the sign-up screen's copy.~~ **Resolved 2026-07-30.**
  The user confirmed the wording T12 proposed, and it is now fixed in
  `design.md` (§ `src/components/SignupForm.tsx` → *Copy*) rather than living
  only here: heading "Create your account", subtitle "Start building your
  Northstar plan.", submit button "Create account", footer "Already have an
  account?" + "Sign in" link, password placeholder "Create a password". T12 and
  T14 assert against those exact strings; `design.md` is the source of truth if
  they ever change.

