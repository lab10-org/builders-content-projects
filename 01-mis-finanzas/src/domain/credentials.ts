export interface Credentials {
  email: string; // normalized: trimmed and lowercased
  password: string; // verbatim, exactly as typed
}

export interface CredentialsInput {
  email: unknown;
  password: unknown;
}

export type CredentialsField = keyof CredentialsInput;

export type CredentialsError = { field: CredentialsField; message: string };

export type ValidateCredentialsResult =
  | { ok: true; credentials: Credentials }
  | { ok: false; errors: CredentialsError[] };

/**
 * English, unlike `expense.ts`'s Spanish messages: these surface on the login
 * screen, whose copy is taken verbatim from the mockup and is in English.
 * Mixing languages inside one screen would be worse than the split.
 */
const MESSAGES = {
  email: "Enter a valid email address.",
  password: "Enter your password.",
} as const;

/**
 * Pragmatic rather than RFC-complete — full RFC 5322 admits addresses no login
 * form should encourage, and the only authority on whether an address exists is
 * the account it belongs to.
 *
 * Requires: a non-empty local part with no whitespace or `@`, a single `@`, and
 * a domain of at least two dot-separated labels whose last label is 2+ letters.
 * Labels may not start or end with a dot or hyphen, which is what rejects
 * `ana@.example.com` and `ana@example.com.`.
 */
const EMAIL_PATTERN =
  /^[^\s@]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

function toEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  // Normalized *before* matching so a pasted address with stray whitespace or
  // capitals is accepted rather than rejected on formatting alone.
  const normalized = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

/**
 * A required-field check, not a strength check. The emptiness test trims so a
 * stray space does not read as input, but the value returned is untrimmed: the
 * password the user typed is the password, whitespace included.
 */
function toPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().length > 0 ? value : null;
}

export function validateCredentials(
  input: CredentialsInput,
): ValidateCredentialsResult {
  const errors: CredentialsError[] = [];

  const email = toEmail(input.email);
  if (email === null) errors.push({ field: "email", message: MESSAGES.email });

  const password = toPassword(input.password);
  if (password === null) {
    errors.push({ field: "password", message: MESSAGES.password });
  }

  // Both null-checks rather than `errors.length`: this is what narrows the two
  // values to `string` for the returned object.
  if (email === null || password === null) return { ok: false, errors };

  return { ok: true, credentials: { email, password } };
}
