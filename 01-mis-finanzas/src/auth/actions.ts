"use server";

import {
  validateCredentials,
  validateNewCredentials,
} from "../domain/credentials";
import { AUTH_MESSAGES, type AuthFailure, mapAuthError } from "./errors";
import { createAuthClient } from "./serverClient";

/**
 * What a screen gets back. Deliberately never carries the credentials, and
 * deliberately not a redirect: the action reports, the page navigates, so
 * "nothing navigates on failure" stays one rule in one place.
 */
export type AuthResult = { ok: true } | { ok: false; failure: AuthFailure };

/** Field errors from the domain, shaped as the failure a screen can render. */
function fieldFailure(error: {
  field: "email" | "password";
  message: string;
}): AuthResult {
  return {
    ok: false,
    failure: { kind: "field", field: error.field, message: error.message },
  };
}

/**
 * Turns a returned-or-thrown error into a result, logging only what the screen
 * is not being told. A recognized failure is already fully described by its
 * copy; logging it too would be noise around the one line that matters.
 */
function toFailure(error: unknown): AuthResult {
  const { failure, recognized } = mapAuthError(error);
  if (!recognized) {
    // The error only — never the credentials, which are not in scope here.
    console.error("[auth] unrecognized failure", error);
  }
  return { ok: false, failure };
}

/**
 * Authenticates against the auth service and establishes a session with the
 * lifetime the user asked for.
 *
 * Re-validates first: a Server Action is reachable without the page, so the
 * form's own check is an affordance rather than a guarantee. It goes through
 * the same domain function as the page, so there is one rule, not two.
 *
 * `createAuthClient` is awaited *outside* the try: a missing environment
 * variable is a deployment fault (5.2) and must surface as an error, not be
 * dressed up as a failed sign-in.
 */
export async function signIn({
  email,
  password,
  remember,
}: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<AuthResult> {
  const validated = validateCredentials({ email, password });
  if (!validated.ok) return fieldFailure(validated.errors[0]);

  const supabase = await createAuthClient(remember);

  try {
    const { error } = await supabase.auth.signInWithPassword({
      // The normalized email, and the password exactly as typed.
      email: validated.credentials.email,
      password: validated.credentials.password,
    });

    if (error) return toFailure(error);
  } catch (thrown) {
    // A transport failure arrives as a rejection rather than a returned error;
    // both are the same event to the user, so both go through one mapping.
    return toFailure(thrown);
  }

  return { ok: true };
}

/**
 * Registers a new account and establishes its session.
 *
 * Persistence is not asked for here — the sign-up screen has no "Remember me"
 * — so a fresh account is remembered: the user just committed to the app, and
 * making them sign in again on the next launch would be a strange reward.
 *
 * The session check is the guard for the day `enable_confirmations` is turned
 * on in `supabase/config.toml`. The service would then return a user with no
 * session, and reporting `ok` would navigate an unauthenticated visitor into
 * the app. It keeps them out — but with the one instruction that actually gets
 * them in, because "something went wrong" would send them round a loop of
 * retrying an account that already exists.
 */
export async function signUp({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const validated = validateNewCredentials({ email, password });
  if (!validated.ok) return fieldFailure(validated.errors[0]);

  const supabase = await createAuthClient(true);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: validated.credentials.email,
      password: validated.credentials.password,
    });

    if (error) return toFailure(error);

    if (!data?.session) {
      // Not routed through `toFailure`: this is not an error the service
      // reported, it is a configuration the operator chose, so it gets its own
      // copy — and still its own log line, since the flag was likely flipped by
      // someone who did not expect this screen to change.
      console.error("[auth] sign-up returned no session — email confirmation?");
      return {
        ok: false,
        failure: { kind: "banner", message: AUTH_MESSAGES.confirmEmail },
      };
    }
  } catch (thrown) {
    return toFailure(thrown);
  }

  return { ok: true };
}
