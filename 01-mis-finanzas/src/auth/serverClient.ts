import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { applyPersistence, persistCookie } from "./cookies";
import { readSupabaseEnv } from "./env";

/**
 * The one Supabase client the Server Actions use, wired to the request's
 * cookie store.
 *
 * Every caller is *establishing* a session — sign-in and sign-up are the only
 * two — so `persist` is the "Remember me" answer, applied to each session
 * cookie and then recorded so later refreshes in the middleware can honour it.
 * There is no serving-an-existing-session mode here on purpose: the middleware
 * is where an existing session is read, and inventing a second branch for a
 * caller that does not exist would only be a guess at what it will need.
 */
export async function createAuthClient(persist: boolean) {
  const { url, publishableKey } = readSupabaseEnv();
  const store = await cookies();

  // `secure` follows the configured URL rather than NODE_ENV: the local stack
  // is plain http on 127.0.0.1, and a Secure cookie there is simply dropped.
  const secure = url.startsWith("https://");

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          store.set(
            name,
            value,
            applyPersistence(
              {
                ...options,
                // Nothing in the browser needs to read the session, so nothing
                // in the browser may.
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure,
              },
              persist,
            ),
          );
        }

        const marker = persistCookie(persist, secure);
        store.set(marker.name, marker.value, marker.options);
      },
    },
  });
}
