# Requirements — Sign in and sign up with Supabase Auth

**Status:** Draft
**Date:** 2026-07-30
**Author:** Juan Sebastian Henao Parra

## Introduction

The app already has a sign-in screen, but it authenticates nobody: it only
checks that the email looks like an email and the password is non-empty, then
records the typed address in browser storage and moves on. Anyone can "sign in"
as anyone. This feature replaces that placeholder with real authentication
against a Supabase Auth instance running locally, and adds the missing other
half — creating an account — so a user can go from never having used the app to
an authenticated session without anyone touching the database by hand.

The value is foundational rather than user-visible: once a real session exists
and the server can read it, everything downstream (protecting the onboarding
flow, storing a financial profile per user instead of per browser, signing out)
becomes possible. Those are deliberately *not* part of this feature — this spec
covers exactly the two doors into the app, sign-in and sign-up, and the session
they produce.

## Glossary

- **Auth service** — the Supabase Auth API of the local Supabase stack, reached
  at the configured Supabase URL.
- **Account** — an email/password identity held by the auth service.
- **Session** — the credentials proving an account is signed in (an access
  token plus a refresh token), issued by the auth service.
- **Session cookies** — the HTTP cookies the app uses to carry the session
  between browser and server.
- **Persistent session** — a session whose cookies carry an explicit expiry, so
  it survives closing the browser.
- **Browser session** — a session whose cookies carry no expiry, so it ends when
  the browser closes.
- **Format validation** — the existing client-side check that an email is
  well-formed and a password non-empty, performed before any network call.
- **Sign-in screen** — the existing `/login` route.
- **Sign-up screen** — the new `/signup` route.

## Requirements

### Requirement 1 — Sign in to an existing account

**User story:** As a returning user, I want to sign in with my email and
password, so that the app knows who I am instead of taking my word for it.

**Acceptance criteria:**

1.1. WHEN a user submits the sign-in screen with credentials that pass format
     validation THE SYSTEM SHALL ask the auth service to authenticate that
     email and password.
1.2. WHEN the auth service accepts the credentials THE SYSTEM SHALL establish a
     session for that account and navigate to `/onboarding/profile`.
1.3. IF the submitted credentials fail format validation THEN THE SYSTEM SHALL
     annotate the offending field, SHALL NOT contact the auth service, and SHALL
     NOT navigate.
1.4. IF the auth service rejects the credentials THEN THE SYSTEM SHALL report a
     single failure message that does not reveal whether the email is
     registered, SHALL NOT establish a session, and SHALL NOT navigate.
1.5. WHEN a sign-in attempt fails for any reason THE SYSTEM SHALL keep the user
     on the sign-in screen with the values they entered still present.
1.6. THE SYSTEM SHALL send the password only to the auth service, and SHALL NOT
     store it, log it, or include it in any other request.

### Requirement 2 — Create an account

**User story:** As a new user, I want to create an account from the sign-in
screen, so that I can start using the app without anyone provisioning me.

**Acceptance criteria:**

2.1. WHEN a user activates "Create an account" on the sign-in screen THE SYSTEM
     SHALL navigate to the sign-up screen.
2.2. WHEN a user activates the sign-in link on the sign-up screen THE SYSTEM
     SHALL navigate to the sign-in screen.
2.3. WHEN a user submits the sign-up screen with a well-formed email and a
     password of at least 6 characters THE SYSTEM SHALL ask the auth service to
     register a new account with those credentials.
2.4. WHEN the auth service registers the account THE SYSTEM SHALL establish a
     session for it and navigate to `/onboarding/profile`, with no intermediate
     confirmation step.
2.5. IF the submitted email is not well-formed THEN THE SYSTEM SHALL annotate
     the email field, SHALL NOT contact the auth service, and SHALL NOT
     navigate.
2.6. IF the submitted password is shorter than 6 characters THEN THE SYSTEM
     SHALL annotate the password field, SHALL NOT contact the auth service, and
     SHALL NOT navigate.
2.7. IF the auth service reports the email already has an account THEN THE
     SYSTEM SHALL report that the email is already registered and point the user
     at signing in, SHALL NOT establish a session, and SHALL NOT navigate.
2.8. WHEN a sign-up attempt fails for any reason THE SYSTEM SHALL keep the user
     on the sign-up screen with the values they entered still present.
2.9. THE SYSTEM SHALL present the sign-up screen with the same two-panel layout,
     visual style, and field components as the sign-in screen.

### Requirement 3 — Carry the session in cookies

**User story:** As a user, I want the app to remember that I signed in, so that
I am not asked again on every page — and so the server, not just the browser,
knows it is me.

**Acceptance criteria:**

3.1. WHEN a session is established THE SYSTEM SHALL carry it in HTTP cookies
     that the server can read on subsequent requests.
3.2. THE SYSTEM SHALL NOT keep any app-managed record of who is signed in
     outside those cookies.
3.3. WHERE "Remember me" is selected WHEN sign-in succeeds THE SYSTEM SHALL
     establish a persistent session.
3.4. WHERE "Remember me" is not selected WHEN sign-in succeeds THE SYSTEM SHALL
     establish a browser session, so closing the browser ends it.
3.5. WHEN account creation succeeds THE SYSTEM SHALL establish a persistent
     session.
3.6. WHILE a session exists WHEN its access token has expired THE SYSTEM SHALL
     obtain a refreshed session from the auth service and write it back to the
     cookies, without interrupting the user's navigation.
3.7. WHEN a session is refreshed THE SYSTEM SHALL preserve the persistence
     choice the session was established with, so a browser session never becomes
     persistent and a persistent session never degrades.
3.8. IF a session cannot be refreshed THEN THE SYSTEM SHALL treat the user as
     signed out and SHALL NOT fail the request being served.

### Requirement 4 — Report authentication failures honestly

**User story:** As a user, I want to be told what went wrong in words I can act
on, so that I know whether to retype my password, sign in instead, or try again
later.

**Acceptance criteria:**

4.1. IF the auth service reports invalid credentials THEN THE SYSTEM SHALL
     display "Invalid email or password."
4.2. IF the auth service reports the account already exists THEN THE SYSTEM
     SHALL display a message stating the email is already registered and
     inviting the user to sign in.
4.3. IF the auth service rejects the password as too weak THEN THE SYSTEM SHALL
     annotate the password field with the requirement that was not met.
4.4. IF the auth service reports the request was rate-limited THEN THE SYSTEM
     SHALL display a message asking the user to wait and try again.
4.5. IF the auth service cannot be reached THEN THE SYSTEM SHALL display a
     message saying the server could not be reached and inviting a retry.
4.6. IF the auth service returns a failure the app does not recognize THEN THE
     SYSTEM SHALL display a generic retry message, SHALL NOT display the raw
     error text or code, and SHALL record the underlying detail in the server
     log.
4.7. THE SYSTEM SHALL present every failure message from this requirement in a
     way assistive technology announces without the user having to move focus.
4.8. THE SYSTEM SHALL clear a previously displayed failure message when a new
     attempt is submitted, so no stale message describes the current state.

### Requirement 5 — Configure the connection to the auth service

**User story:** As a developer running the app, I want a missing or wrong
Supabase configuration to say so plainly, so that I do not debug an
authentication failure that is really a missing environment variable.

**Acceptance criteria:**

5.1. THE SYSTEM SHALL read the auth service URL and its public API key from
     environment variables.
5.2. IF either variable is absent or empty THEN THE SYSTEM SHALL fail with a
     message naming the missing variable, instead of attempting a request.
5.3. THE SYSTEM SHALL NOT include the Supabase secret or service-role key in
     the source tree or in anything sent to the browser.

## Out of scope

- **Route guards** — protecting `/`, `/onboarding/*`, or any other route from
  signed-out users. The infrastructure this feature builds makes it a small
  follow-up, but no route changes access behavior here.
- **Signing out.**
- **Password reset** — the "Forgot password?" control stays inert.
- **Social / OAuth / magic-link sign-in.**
- **Email confirmation flows** — the local stack has confirmations disabled, and
  this feature does not add a confirmation screen or a resend flow.
- **Storing user data server-side** — the financial profile, transactions and
  plan keep living in browser storage; associating them with the account is a
  later feature.
- **Connecting to a hosted (non-local) Supabase project.**
- **Password strength rules beyond the auth service's own minimum.**

## Open questions

None. The design decisions this spec depends on (cookie-based sessions, a
dedicated sign-up screen, dropping the placeholder session store) were settled
during brainstorming.
