import type { AuthResult } from "./actions";
import { AUTH_MESSAGES } from "./errors";

/**
 * Calls a Server Action from a screen and guarantees a result to render.
 *
 * A Server Action can *reject* rather than return: the browser is offline, the
 * POST never lands, or the action threw before its own `try` — which
 * `signIn`/`signUp` do on purpose when the environment is unconfigured. Awaited
 * bare, that rejection is unhandled and the screen shows nothing at all, so the
 * button simply looks dead.
 *
 * Both screens need the identical guard, so it lives here once. Everything the
 * action itself already mapped comes back untouched; only a rejection is turned
 * into copy, and into the one banner that describes it honestly.
 */
export async function runAuthAction(
  action: () => Promise<AuthResult>,
): Promise<AuthResult> {
  try {
    return await action();
  } catch (thrown) {
    // Client-side, so this reaches the browser console rather than a server
    // log — but a configuration fault has to leave a trace somewhere, and the
    // banner deliberately says nothing about it.
    console.error("[auth] the action did not complete", thrown);
    return {
      ok: false,
      failure: { kind: "banner", message: AUTH_MESSAGES.unreachable },
    };
  }
}
