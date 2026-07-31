import type { CredentialsField } from "../domain/credentials";

/**
 * What a screen must render. Two shapes because Requirement 4 has two kinds of
 * message: most failures describe the attempt as a whole (a banner), while a
 * rejected password describes one input. Modelling it as a union lets a page
 * route the failure without inspecting error codes it has no business knowing.
 */
export type AuthFailure =
  | { kind: "banner"; message: string }
  | { kind: "field"; field: CredentialsField; message: string };

export interface MappedAuthError {
  failure: AuthFailure;
  /** `false` → the caller logs the raw detail server-side (4.6). */
  recognized: boolean;
}

/**
 * Every literal the screens can show, in one place so nothing is re-spelled.
 *
 * Exported because two failures are known to their caller rather than to the
 * mapping: a sign-up that came back without a session, and an action whose
 * promise rejected before any error object existed.
 */
export const AUTH_MESSAGES = {
  invalidCredentials: "Invalid email or password.",
  alreadyRegistered: "That email is already registered. Sign in instead.",
  weakPassword: "Password must be at least 6 characters.",
  rateLimited: "Too many attempts. Wait a moment and try again.",
  unreachable: "Could not reach the server. Please try again.",
  confirmEmail: "Check your email to confirm your account, then sign in.",
  unknown: "Something went wrong. Please try again.",
} as const;

/**
 * The SDK's error shape, read structurally rather than with `instanceof`: a
 * rejected promise can carry anything, and tests should be able to construct a
 * case as a plain object instead of importing SDK error classes.
 */
interface ErrorLike {
  code?: string;
  status?: number;
  name?: string;
  message?: string;
}

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error !== "object" || error === null) return {};
  const { code, status, name, message } = error as Record<string, unknown>;
  return {
    code: typeof code === "string" ? code : undefined,
    status: typeof status === "number" ? status : undefined,
    name: typeof name === "string" ? name : undefined,
    message: typeof message === "string" ? message : undefined,
  };
}

function banner(message: string, recognized = true): MappedAuthError {
  return { failure: { kind: "banner", message }, recognized };
}

/**
 * Turns whatever the SDK returned or threw into copy for the screen.
 *
 * Pure, and deliberately never given the credentials: the only input is the
 * error, so no password can reach a message or a log through here. It is also
 * not told which screen asked — sign-in and sign-up want the same words for the
 * same failure, and the day one of them does not, that is a branch to add here
 * rather than an argument to have carried all along.
 *
 * The default is the generic banner with `recognized: false` — an unmapped
 * failure must degrade to "something went wrong", never to the raw text, which
 * is as likely to be a stack trace as a sentence.
 */
export function mapAuthError(error: unknown): MappedAuthError {
  const { code, status, name, message } = asErrorLike(error);

  switch (code) {
    case "invalid_credentials":
      return banner(AUTH_MESSAGES.invalidCredentials);
    case "user_already_exists":
    case "email_exists":
      return banner(AUTH_MESSAGES.alreadyRegistered);
    case "weak_password":
      return {
        // The service states the requirement it enforced; preferring its
        // wording keeps the annotation true even if the minimum changes there
        // before it changes here.
        failure: {
          kind: "field",
          field: "password",
          message: message ?? AUTH_MESSAGES.weakPassword,
        },
        recognized: true,
      };
    case "over_request_rate_limit":
      return banner(AUTH_MESSAGES.rateLimited);
    case "email_not_confirmed":
      // Only reachable once `enable_confirmations` is on, and the one failure
      // whose remedy is not "try again" — so it has to name the inbox.
      return banner(AUTH_MESSAGES.confirmEmail);
  }

  if (status === 429) return banner(AUTH_MESSAGES.rateLimited);

  // A transport failure arrives either as the SDK's retryable wrapper or, when
  // `fetch` itself gives up, as a bare TypeError with no code at all. That last
  // shape is matched on its message too: `TypeError` is also what a plain bug in
  // this code path throws, and claiming the server is unreachable would both
  // misinform the user and — because it is `recognized` — swallow the log that
  // is the only trace such a bug leaves (4.6).
  if (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    (name === "TypeError" && /fetch|network/i.test(message ?? ""))
  ) {
    return banner(AUTH_MESSAGES.unreachable);
  }

  return banner(AUTH_MESSAGES.unknown, false);
}
