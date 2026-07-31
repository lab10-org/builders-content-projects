import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { PERSIST_COOKIE, applyPersistence, readsAsPersistent } from "./cookies";
import { readSupabaseEnv } from "./env";

/**
 * Refreshes the session on every navigation and hands back the response that
 * carries the new cookies.
 *
 * Two writes per cookie, and both matter: onto the **request** so the route
 * about to render sees the refreshed session, and onto the **response** so the
 * browser keeps it for the next one.
 *
 * The lifetime comes from the choice recorded at sign-in, never from a fresh
 * decision — that is what stops a refresh from quietly promoting a browser
 * session to a persistent one, or demoting a remembered one. This function
 * never writes `PERSIST_COOKIE` itself; only an actual sign-in gets to decide
 * it.
 */
export async function refreshSession(
  request: NextRequest,
): Promise<NextResponse> {
  const { url, publishableKey } = readSupabaseEnv();

  const response = NextResponse.next({ request });
  const persist = readsAsPersistent(
    request.cookies.get(PERSIST_COOKIE)?.value,
  );
  const secure = url.startsWith("https://");

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          response.cookies.set(
            name,
            value,
            applyPersistence(
              { ...options, httpOnly: true, sameSite: "lax", path: "/", secure },
              persist,
            ),
          );
        }
      },
    },
  });

  try {
    // The call that actually redeems an expired refresh token. Its result is
    // deliberately not inspected: whether it returns a user or an error, the
    // SDK has already written whatever cookies the outcome implies — including
    // clearing them — and this function's job ends there.
    await supabase.auth.getUser();
  } catch {
    // 3.8: a request must never fail because a session could not be refreshed.
    // The user is simply signed out for it.
  }

  return response;
}
