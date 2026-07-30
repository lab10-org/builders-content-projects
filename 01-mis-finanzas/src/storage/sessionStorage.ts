/**
 * Who is signed in. Deliberately holds no secret: there is no auth backend, so
 * there is no token to keep, and storing one in web storage would be the wrong
 * habit to establish.
 */
export interface Session {
  email: string;
}

/**
 * The key both stores use. Exported so tests and the UI assert against the
 * constant rather than duplicating the literal, matching `expenseStorage`.
 */
export const SESSION_KEY = "mis-finanzas:session";

export interface SaveSessionOptions {
  /**
   * The login screen's "Remember me" checkbox. `true` keeps the session in
   * `localStorage` so it survives closing the browser; `false` keeps it in
   * `sessionStorage`, so it dies with the tab.
   */
  remember: boolean;
}

/**
 * Read back from storage, so untrusted: it may predate a shape change or have
 * been edited by hand. An entry that fails this check is treated as "nobody is
 * signed in" rather than surfacing as a `Session` with a missing email.
 */
function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.email === "string" && candidate.email.length > 0;
}

/**
 * Tolerates every failure mode — absent key, malformed JSON, wrong shape — and
 * never throws, so a corrupt entry degrades to a signed-out state.
 *
 * Web storage is touched only inside these functions, never at module scope, so
 * importing this during server rendering cannot crash.
 */
function read(store: Storage): Session | null {
  try {
    const raw = store.getItem(SESSION_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) return null;

    // Rebuilt rather than returned as-is, so fields from an older shape are
    // dropped instead of riding along.
    return { email: parsed.email };
  } catch {
    return null;
  }
}

/** The persistent store wins: it is the one the user explicitly asked for. */
export function loadSession(): Session | null {
  return read(localStorage) ?? read(sessionStorage);
}

/**
 * Writes to exactly one store and clears the other first.
 *
 * Clearing is the load-bearing part: without it, signing in once with "remember
 * me" and later without it would leave the original session in `localStorage`,
 * where `loadSession` would keep preferring it long after the tab closed.
 *
 * A quota or serialization failure is deliberately not caught — the caller
 * surfaces it while keeping the user on the form, as `saveExpenses` does.
 */
export function saveSession(
  session: Session,
  { remember }: SaveSessionOptions,
): void {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;

  other.removeItem(SESSION_KEY);
  target.setItem(SESSION_KEY, JSON.stringify({ email: session.email }));
}

/** Clears both stores: only one should hold a session, but never assume it. */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
