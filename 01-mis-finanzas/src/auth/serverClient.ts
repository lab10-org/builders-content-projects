import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  PERSIST_COOKIE,
  applyPersistence,
  persistCookie,
  readsAsPersistent,
} from "./cookies";
import { readSupabaseEnv } from "./env";

/**
 * The one Supabase client the Server Actions use, wired to the request's
 * cookie store.
 *
 * `persist` is passed only when a sign-in or sign-up is *establishing* a
 * session — it is the "Remember me" answer, and it is recorded so later
 * refreshes can honour it. Omitted, the client is merely *serving* an existing
 * session: it then reads the recorded choice and leaves it alone, because
 * overwriting it here would silently re-decide something the user decided.
 */
export async function createAuthClient(persist?: boolean) {
  const { url, publishableKey } = readSupabaseEnv();
  const store = await cookies();

  const establishing = persist !== undefined;
  const shouldPersist = establishing
    ? persist
    : readsAsPersistent(
        store.getAll().find(({ name }) => name === PERSIST_COOKIE)?.value,
      );

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
              shouldPersist,
            ),
          );
        }

        if (establishing) {
          const marker = persistCookie(shouldPersist);
          store.set(marker.name, marker.value, marker.options);
        }
      },
    },
  });
}
