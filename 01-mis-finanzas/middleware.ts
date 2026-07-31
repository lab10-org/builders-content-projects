import type { NextRequest } from "next/server";

import { refreshSession } from "./src/auth/middlewareClient";

/**
 * Runs before every navigable route and does exactly one thing: keep the
 * session fresh, so a route that renders after an access token expired still
 * sees a signed-in user.
 *
 * It deliberately redirects nobody. Route guards are a separate feature; when
 * one arrives, this is the single place it goes — which is the whole reason the
 * middleware exists this early.
 *
 * Lives at the project root rather than under `src/`, because `app/` is at the
 * root and Next only looks for it beside the app directory.
 */
export async function middleware(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  // Static assets and API routes are excluded: no session is read from them,
  // and refreshing a token per asset is a real round trip to the auth service,
  // not a local token decode. The extension list matters as much as the
  // `_next/` prefixes — anything served straight out of `public/` has no prefix
  // to exclude it by.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|txt|xml|json|webmanifest)$).*)",
  ],
};
