import type { CredentialsField } from "../domain/credentials";

/** Which door the user came through. Kept explicit so copy can diverge later. */
export type Screen = "sign-in" | "sign-up";

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

/** Every literal the screens can show, in one place so nothing is re-spelled. */
const MESSAGES = {
  invalidCredentials: "Invalid email or password.",
  alreadyRegistered: "That email is already registered. Sign in instead.",
  weakPassword: "Password must be at least 6 characters.",
  rateLimited: "Too many attempts. Wait a moment and try again.",
  unreachable: "Could not reach the server. Please try again.",
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
 * Pure, and deliberately never given the credentials: the only inputs are the
 * error and which screen asked, so no password can reach a message or a log
 * through here.
 *
 * The default is the generic banner with `recognized: false` — an unmapped
 * failure must degrade to "something went wrong", never to the raw text, which
 * is as likely to be a stack trace as a sentence.
 */
export function mapAuthError(error: unknown, _screen: Screen): MappedAuthError {
  const { code, status, name } = asErrorLike(error);

  switch (code) {
    case "invalid_credentials":
      return banner(MESSAGES.invalidCredentials);
    case "user_already_exists":
    case "email_exists":
      return banner(MESSAGES.alreadyRegistered);
    case "weak_password":
      return {
        // The service states the requirement it enforced; preferring its
        // wording keeps the annotation true even if the minimum changes there
        // before it changes here.
        failure: {
          kind: "field",
          field: "password",
          message: asErrorLike(error).message ?? MESSAGES.weakPassword,
        },
        recognized: true,
      };
    case "over_request_rate_limit":
      return banner(MESSAGES.rateLimited);
  }

  if (status === 429) return banner(MESSAGES.rateLimited);

  // A transport failure arrives either as the SDK's retryable wrapper or, when
  // `fetch` itself gives up, as a bare TypeError with no code at all.
  if (name === "AuthRetryableFetchError" || status === 0 || name === "TypeError") {
    return banner(MESSAGES.unreachable);
  }

  return banner(MESSAGES.unknown, false);
}
