import { expect, test, type Page } from "@playwright/test";

/**
 * Sign in and sign up against the local Supabase Auth stack.
 * Plan: docs/specs/2026-07-30-login-supabase/e2e-tests-plan.md
 *
 * Nothing is stubbed here: auth is the feature under test, so every case talks
 * to the real service on http://127.0.0.1:54321. Each test starts from
 * Playwright's default fresh context, which is the plan's "no session carries
 * over" precondition.
 *
 * The one thing the suite does need in place is the account below, and it comes
 * from `supabase/seed.sql` rather than from a step in here — so `supabase db
 * reset` restores the precondition instead of quietly removing it.
 */

/**
 * The account `supabase/seed.sql` creates, so `supabase db reset` is all the
 * setup Cases 2 and 3 need. Its password is deliberately not used here: one
 * case signs in with the wrong one, the other never signs in at all.
 */
const SEEDED_EMAIL = "smoke-2026073001@example.com";

/**
 * Alerts scoped to the form.
 *
 * Next's dev server renders `#__next-route-announcer__` with `role="alert"`
 * outside the form, and `getByRole` pierces the dev overlay's shadow root, so
 * an unscoped `getByRole("alert")` matches it on every page and would make both
 * "an alert appeared" and "no alert appeared" meaningless. The app's own
 * failure banners are `<p role="alert">` inside the form, so the form is the
 * right scope.
 */
function formAlert(page: Page) {
  return page.locator("form").getByRole("alert");
}

/** Cookie names visible to scripts, read from the page. */
async function scriptVisibleCookies(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document.cookie
      .split(";")
      .map((entry) => entry.trim().split("=")[0])
      .filter(Boolean),
  );
}

/**
 * Every cookie name the browser holds, `httpOnly` ones included — read from the
 * context rather than the page, which is the only way to see them.
 */
async function storedCookies(page: Page): Promise<string[]> {
  const cookies = await page.context().cookies();
  return cookies.map(({ name }) => name);
}

// Case 1 — Create an account from the sign-in screen (happy path)
// Traces to: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2
test("registers a new account from the sign-in screen and lands in the app", async ({
  page,
}) => {
  // Unique per run: reusing a fixed address would turn this into Case 3 on the
  // second execution.
  const email = `e2e-signup-${Date.now()}@example.com`;

  await page.goto("/login");

  // An `<a href="/signup">`, not a button (2.1).
  await page.getByRole("link", { name: "Create an account" }).click();

  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  // The way back to sign-in is on this screen too (2.2).
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(formAlert(page)).toHaveCount(0);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("s3cret-pass");
  await page.getByRole("button", { name: "Create account" }).click();

  // The submit is a Server Action round trip — wait for the URL (2.3, 2.4).
  // This is also what makes "no alert at any point" checkable: a failure keeps
  // the user on /signup with a banner, so reaching this URL means none was
  // rendered.
  await expect(page).toHaveURL(/\/onboarding\/profile$/);
  await expect(formAlert(page)).toHaveCount(0);

  // No confirmation step between registering and being inside the app (2.4).
  await expect(page.getByText(/confirm/i)).toHaveCount(0);

  // The session is carried by cookies only — both web storages stay empty (3.2).
  const storageKeys = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storageKeys.local).toEqual([]);
  expect(storageKeys.session).toEqual([]);

  // The persistence marker was recorded (3.1) — checked against the stored
  // cookies, because it is `httpOnly` like the session itself.
  expect(await storedCookies(page)).toContain("mis-finanzas:persist");

  // And nothing the session is made of reaches a script (3.1).
  const scriptVisible = await scriptVisibleCookies(page);
  expect(scriptVisible.filter((name) => name.startsWith("sb-"))).toEqual([]);
  expect(scriptVisible).not.toContain("mis-finanzas:persist");
});

// Case 2 — Sign in with the wrong password (failure path)
// Traces to: 1.4, 1.5, 4.1, 4.7
test("rejects a wrong password without revealing anything or signing in", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(SEEDED_EMAIL);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Exact copy, not a loose match: a looser one would also pass on the generic
  // "Something went wrong. Please try again.", which is precisely what this
  // case exists to distinguish from a correct rejection (4.1, 4.7). The message
  // names neither the email nor which half was wrong (1.4).
  await expect(formAlert(page)).toHaveText("Invalid email or password.");

  // Nothing happened: still on the form, still holding what was typed (1.5).
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toHaveValue(SEEDED_EMAIL);
  await expect(page.getByLabel("Password")).toHaveValue(
    "definitely-not-the-password",
  );

  // And no session was established.
  //
  // The persistence marker is the falsifiable check: it is written only by the
  // Server Action that establishes a session and never by the middleware's
  // refresh, so its absence really does mean no session came into existence.
  // Read from the context, since it is `httpOnly`: asserting on what scripts can
  // see would prove nothing, because an app that *did* wrongly sign the user in
  // would show nothing there either.
  const stored = await storedCookies(page);
  expect(stored).not.toContain("mis-finanzas:persist");
  expect(stored.filter((name) => name.startsWith("sb-"))).toEqual([]);
});

// Case 3 — Register an email that already has an account (failure path)
// Traces to: 2.7, 2.8, 4.2, 4.7
test("refuses a duplicate registration and points to sign-in", async ({
  page,
}) => {
  await page.goto("/signup");

  await page.getByLabel("Email").fill(SEEDED_EMAIL);
  await page.getByLabel("Password").fill("another-pass");
  await page.getByRole("button", { name: "Create account" }).click();

  // Supabase answers this with `user_already_exists` or `email_exists`
  // depending on version; both map to the same copy (2.7, 4.2, 4.7).
  await expect(formAlert(page)).toHaveText(
    "That email is already registered. Sign in instead.",
  );

  // Nothing was created and nothing was lost (2.8).
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("Email")).toHaveValue(SEEDED_EMAIL);
  await expect(page.getByLabel("Password")).toHaveValue("another-pass");

  // The way out the message names is actually there.
  const signIn = page.getByRole("link", { name: "Sign in" });
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute("href", "/login");
});
