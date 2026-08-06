# E2E test report — Sign in and sign up with Supabase Auth

Spec: `docs/specs/2026-07-30-login-supabase/` · Plan: `e2e-tests-plan.md` · Suite: `e2e/auth.spec.ts`
Produced by the `healer` subagent — diagnosis only, no code was modified.

## Verdict

**GREEN** — all three cases pass against the real local Supabase Auth stack, twice
in a row, and each passing test asserts something falsifiable about the criteria
it traces to.

## Run

```
npm run test:e2e → 3 passed / 0 failed  (run 1, 3.9s)

Running 3 tests using 1 worker
  ✓  1 [chromium] › e2e/auth.spec.ts:42:5 › registers a new account from the sign-in screen and lands in the app (1.7s)
  ✓  2 [chromium] › e2e/auth.spec.ts:93:5 › rejects a wrong password without revealing anything or signing in (799ms)
  ✓  3 [chromium] › e2e/auth.spec.ts:122:5 › refuses a duplicate registration and points to sign-in (671ms)
  3 passed (3.9s)
```

```
npm run test:e2e → 3 passed / 0 failed  (run 2, 3.8s — flakiness check)

  ✓  1 … (1.7s)   ✓  2 … (815ms)   ✓  3 … (663ms)
  3 passed (3.8s)
```

Preconditions verified before the run: `http://localhost:3000/login` → 200,
`http://127.0.0.1:54321/auth/v1/health` → 200, `.env.local` holds
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

The suite is not merely green — it is green *against the real service*. The
account Case 1 registers really lands in `auth.users`: a password-grant request
straight at the auth service for the address the manual reproduction created
returns an access token, and so does one for the seeded account.

```
POST http://127.0.0.1:54321/auth/v1/token?grant_type=password
  healer-manual-…@example.com  → {"access_token":"eyJhbGciOiJFUzI1NiIs…
  smoke-2026073001@example.com → {"access_token":"eyJhbGciOiJFUzI1NiIs…
```

The auth container log shows the corresponding traffic (`POST /signup`,
`POST /token`, and `GET /user` on every navigation from the middleware), so no
part of the flow is being short-circuited in the app.

## Case by case

### Case 1 — Create an account from the sign-in screen · PASS · —

- **Traces to:** 2.1, 2.2, 2.3, 2.4, 3.1, 3.2
- **Observed:** Reproduced by hand. `/login` → clicking the **Create an account**
  link (`<a href="/signup">`) lands on `/signup` with the heading *"Create your
  account"* and a **Sign in** link back. Filling a unique address with
  `s3cret-pass` and submitting lands on `/onboarding/profile`. There,
  `document.cookie` is exactly `mis-finanzas:persist=1`, `localStorage` and
  `sessionStorage` are both `[]`, and no `sb-` cookie is script-visible.
- **Expected:** navigation to `/onboarding/profile` with no confirmation step, a
  session carried in cookies the server can read, and nothing about the signed-in
  user held outside those cookies.
- **Diagnosis:** Passes for the right reason, and the two assertions that could
  have been vacuous are not:
  - *The account is real.* The registered address authenticates against the auth
    service afterwards (password grant above), so `ok: true` is not a stub.
  - *A session cookie really exists and really is `httpOnly`.* Absence of `sb-`
    from `document.cookie` alone would also be satisfied by "no session at all".
    It isn't: after the sign-up, navigating to `/onboarding/profile` makes the
    middleware issue `GET /user` to the auth service, which it can only do with a
    session cookie the browser sent and scripts never saw. Cookie invisible to
    the page, readable by the server — which is exactly 3.1 + 3.2.
- **Reproduced manually:** yes (walked `/login` → `/signup` → `/onboarding/profile`
  in the browser; only console output on the flow is a `favicon.ico` 404).
- **Recommended fix:** none.

### Case 2 — Sign in with the wrong password · PASS · —

- **Traces to:** 1.4, 1.5, 4.1, 4.7
- **Observed:** Reproduced by hand. Submitting the seeded email with
  `definitely-not-the-password` leaves the URL at `/login` and renders exactly
  one alert inside the form:
  `{ tag: "P", role: "alert", text: "Invalid email or password." }`. Both fields
  still hold what was typed. In a cookie-cleared context the failed attempt wrote
  no cookie at all (`document.cookie === ""`).
- **Expected:** a single message that reveals nothing about whether the email is
  registered, no session, no navigation, typed values preserved.
- **Diagnosis:** Correct behaviour, correctly asserted. The exact-copy assertion
  is the load-bearing one — it distinguishes a real `invalid_credentials`
  mapping from the generic *"Something went wrong. Please try again."* fallback
  in `src/auth/errors.ts:103`, which a substring match would have swallowed. This
  is the only place the real SDK's error code is proven to reach `mapAuthError`.
- **Reproduced manually:** yes (see the DOM read above).
- **Recommended fix:** none required. One optional hardening, at
  `e2e/auth.spec.ts:116-117`: the closing check that no `sb-` cookie is visible
  is **unfalsifiable here** — the app sets those cookies `httpOnly`
  unconditionally (`src/auth/serverClient.ts:50`), so an app that *did* wrongly
  establish a session would pass this line too. A falsifiable stand-in for "no
  session was established" is the persistence marker, which only an establishing
  sign-in writes (`serverClient.ts:60-63`; the middleware never writes it —
  `middlewareClient.ts:18-19`):

  ```ts
  expect(cookieNames).not.toContain("mis-finanzas:persist");
  ```

  Verified by hand to hold today. This is a strengthening, not a defect — the
  case already proves 1.4, 1.5, 4.1 and 4.7 through other assertions, so it is
  `generate-tests`' call whether the loop is worth another turn for it.

### Case 3 — Register an email that already has an account · PASS · —

- **Traces to:** 2.7, 2.8, 4.2, 4.7
- **Observed:** Reproduced by hand. Submitting the seeded email with
  `another-pass` on `/signup` keeps the URL at `/signup` and renders one
  form-scoped `role="alert"` reading exactly *"That email is already registered.
  Sign in instead."* Both fields keep their values, and the **Sign in** link
  (`href="/login"`) is present.
- **Expected:** the duplicate refused with copy that routes the user to sign-in,
  nothing created, nothing lost.
- **Diagnosis:** Correct. The copy assertion again distinguishes a mapped
  `user_already_exists` / `email_exists` from the generic fallback, and the test
  asserts the escape route the message names actually exists rather than trusting
  the sentence. The case ran in ~670ms both times; the plan's warning about
  Supabase delaying duplicate-signup responses did not bite here (confirmations
  are disabled on the local stack) and, correctly, nothing in the test asserts
  timing.
- **Reproduced manually:** yes.
- **Recommended fix:** none.

## False greens

None. Each test's assertions can fail if the app misbehaves:

- The `formAlert` helper (`e2e/auth.spec.ts:26-28`) scopes alerts to the form.
  This is necessary, not cosmetic: the accessibility snapshot of every page shows
  a page-level `alert` node — Next's dev route announcer — so an unscoped
  `getByRole("alert")` would make both "an alert appeared" and "no alert
  appeared" true by construction. Scoping to the form is what keeps Case 1's
  `toHaveCount(0)` meaningful.
- Both failure cases assert **exact** copy, so they cannot be satisfied by the
  generic error banner.
- Case 1's storage assertions compare against `[]` rather than checking for the
  absence of one known key, so any app-managed record of the user would fail it.

The one assertion that proves less than it appears to is Case 2's `sb-` cookie
filter, covered under Case 2 above. It is redundant rather than misleading — the
case does not depend on it for any of its criteria.

## Blocked / not verifiable

None for the three planned cases. The criteria the plan deliberately left out
(3.3, 3.4, 3.6–3.8, 4.3–4.6, 5.1–5.3) remain covered only by the unit suites,
as the plan states; nothing in this run changes that assessment.

Side note, not a defect: each execution of Case 1 writes one more real row to
`auth.users` on the local stack, as the plan accepts. Two runs today added two.
They are harmless, but if the local stack is ever reset the seeded account
`smoke-2026073001@example.com` must be re-created or Cases 2 and 3 will fail on
a precondition rather than on behaviour.

## For the user

None. No criterion was ambiguous, no spec question arose, and the environment
was fully configured.
