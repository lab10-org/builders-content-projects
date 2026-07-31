import type { CookieOptions } from "@supabase/ssr";

/**
 * Where the "Remember me" answer is remembered.
 *
 * The choice has to outlive the sign-in request: the middleware refreshes
 * tokens long afterwards and must write the new cookies with the same
 * lifetime. It cannot infer that from the existing cookie — a server reads
 * cookie *values*, never their attributes — so the answer is stored as a value
 * of its own.
 */
export const PERSIST_COOKIE = "mis-finanzas:persist";

/**
 * 400 days: the browser cap on cookie lifetime (and Supabase's own default).
 * Anything longer is silently clamped, so asking for more would only make the
 * intent less honest than the behaviour.
 */
export const PERSIST_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * Turns "Remember me" into a cookie lifetime — the whole of the persistence
 * rule, in one pure function both the actions and the middleware go through.
 *
 * The non-persistent branch is the load-bearing one: `@supabase/ssr` defaults
 * its cookies to a 400-day `maxAge`, so a browser session only stays a browser
 * session if both lifetime fields are actively removed. Inheriting that
 * default is exactly the bug this function exists to prevent.
 *
 * Returns a new object; the input is never mutated, because the same options
 * object is handed to us once per cookie in a batch.
 */
export function applyPersistence(
  options: CookieOptions,
  persist: boolean,
): CookieOptions {
  if (persist) return { ...options, maxAge: PERSIST_MAX_AGE };

  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest;
}

/**
 * Read back from a cookie, so untrusted. Only the exact marker counts as
 * persistent: an absent, blank or hand-edited value degrades to a browser
 * session, which is the failure that costs the user least.
 */
export function readsAsPersistent(value: string | undefined): boolean {
  return value === "1";
}

/** The persistence choice itself, shaped for whatever cookie store writes it. */
export function persistCookie(
  persist: boolean,
  secure: boolean,
): {
  name: string;
  value: string;
  options: CookieOptions;
} {
  return {
    name: PERSIST_COOKIE,
    value: persist ? "1" : "0",
    options: applyPersistence(
      {
        // `path` is not cosmetic: the middleware reads this cookie on every
        // route, and a narrower scope would read as absent there — silently
        // downgrading a remembered session on the first navigation.
        path: "/",
        sameSite: "lax",
        // Locked down exactly like the session cookies it governs. Only the
        // server reads this marker, and the middleware treats it as the
        // authoritative lifetime for every refreshed token — so a script that
        // could write it could promote a deliberately-ephemeral session to 400
        // days, which is the promotion the marker exists to prevent.
        httpOnly: true,
        secure,
      },
      persist,
    ),
  };
}
