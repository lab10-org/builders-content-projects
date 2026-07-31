import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signIn, signUp } from "./actions";

const PASSWORD = "s3cret-pass";

const { createAuthClient, signInWithPassword, signUpCall } = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signUpCall: vi.fn(),
}));

vi.mock("./serverClient", () => ({ createAuthClient }));

// A spy *over the real implementation*, not a stub: the cases below assert both
// which error was mapped and the actual copy the caller receives.
vi.mock("./errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./errors")>();
  return { ...actual, mapAuthError: vi.fn(actual.mapAuthError) };
});

const { mapAuthError } = await import("./errors");

beforeEach(() => {
  createAuthClient.mockReset();
  signInWithPassword.mockReset();
  vi.mocked(mapAuthError).mockClear();

  createAuthClient.mockResolvedValue({ auth: { signInWithPassword } });
  signInWithPassword.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signIn — the happy path", () => {
  it("authenticates the normalized email with the password verbatim (1.1)", async () => {
    const result = await signIn({
      email: "  Ana@Example.COM ",
      password: PASSWORD,
      remember: false,
    });

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: PASSWORD,
    });
    expect(result).toEqual({ ok: true });
  });

  it.each([true, false])(
    "passes the remember choice straight through (%s) (3.3/3.4)",
    async (remember) => {
      await signIn({ email: "ana@example.com", password: PASSWORD, remember });

      expect(createAuthClient).toHaveBeenCalledWith(remember);
    },
  );
});

describe("signIn — server-side re-validation (1.3)", () => {
  // A Server Action is reachable without the page, so the client-side check is
  // an affordance, not a guarantee.
  it("rejects a malformed email without contacting the service", async () => {
    const result = await signIn({
      email: "nope",
      password: PASSWORD,
      remember: false,
    });

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "field",
        field: "email",
        message: "Enter a valid email address.",
      },
    });
    expect(createAuthClient).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an empty password without contacting the service", async () => {
    const result = await signIn({
      email: "ana@example.com",
      password: "",
      remember: false,
    });

    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "field", field: "password" },
    });
    expect(createAuthClient).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signIn — failures", () => {
  it("returns the same banner whether or not the email exists (1.4)", async () => {
    const error = { code: "invalid_credentials" };
    signInWithPassword.mockResolvedValue({ data: {}, error });

    const result = await signIn({
      email: "ana@example.com",
      password: PASSWORD,
      remember: false,
    });

    expect(result).toEqual({
      ok: false,
      failure: { kind: "banner", message: "Invalid email or password." },
    });
    expect(mapAuthError).toHaveBeenCalledWith(error);
  });

  // An unreachable service must surface as copy, not as a 500.
  it("resolves rather than propagating when the call rejects (4.5)", async () => {
    signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      signIn({ email: "ana@example.com", password: PASSWORD, remember: false }),
    ).resolves.toEqual({
      ok: false,
      failure: {
        kind: "banner",
        message: "Could not reach the server. Please try again.",
      },
    });
  });

  // 5.2: a missing variable is a deployment fault, not a user-facing failure.
  // The action never runs, so it must not dress the problem up as bad copy.
  it("lets a configuration error propagate", async () => {
    createAuthClient.mockRejectedValue(new Error("Missing SUPABASE_URL."));

    await expect(
      signIn({ email: "ana@example.com", password: PASSWORD, remember: false }),
    ).rejects.toThrowError(/SUPABASE_URL/);
  });

  it("logs the raw detail of an unrecognized failure but shows none of it (4.6)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { code: "banana", message: "SECRET-DETAIL-42" };
    signInWithPassword.mockResolvedValue({ data: {}, error });

    const result = await signIn({
      email: "ana@example.com",
      password: PASSWORD,
      remember: false,
    });

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "banner",
        message: "Something went wrong. Please try again.",
      },
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).toContain("SECRET-DETAIL-42");
    // 1.6: whatever goes to the log, the password is not in it.
    expect(JSON.stringify(log.mock.calls)).not.toContain(PASSWORD);
  });

  it("does not log a failure it recognized", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials" },
    });

    await signIn({
      email: "ana@example.com",
      password: PASSWORD,
      remember: false,
    });

    expect(log).not.toHaveBeenCalled();
  });
});

describe("signIn — the password never travels further than the service (1.6)", () => {
  it.each([
    { label: "success", response: { data: {}, error: null } },
    {
      label: "rejection",
      response: { data: {}, error: { code: "invalid_credentials" } },
    },
    { label: "unknown failure", response: { data: {}, error: { code: "x" } } },
  ])("keeps it out of the returned object on $label", async ({ response }) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    signInWithPassword.mockResolvedValue(response);

    const result = await signIn({
      email: "ana@example.com",
      password: PASSWORD,
      remember: false,
    });

    expect(JSON.stringify(result)).not.toContain(PASSWORD);
  });
});

describe("signUp", () => {
  const session = { data: { user: { id: "u1" }, session: { access_token: "t" } }, error: null };

  beforeEach(() => {
    createAuthClient.mockResolvedValue({
      auth: { signInWithPassword, signUp: signUpCall },
    });
    signUpCall.mockReset();
    signUpCall.mockResolvedValue(session);
  });

  it("registers the normalized email with a persistent session (2.3, 2.4, 3.5)", async () => {
    const result = await signUp({
      email: "  Ana@Example.COM ",
      password: PASSWORD,
    });

    expect(createAuthClient).toHaveBeenCalledWith(true);
    expect(signUpCall).toHaveBeenCalledTimes(1);
    expect(signUpCall).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: PASSWORD,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a password shorter than the minimum without contacting the service (2.6)", async () => {
    const result = await signUp({ email: "ana@example.com", password: "12345" });

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "field",
        field: "password",
        message: "Password must be at least 6 characters.",
      },
    });
    expect(createAuthClient).not.toHaveBeenCalled();
    expect(signUpCall).not.toHaveBeenCalled();
  });

  it("rejects a malformed email without contacting the service (2.5)", async () => {
    const result = await signUp({ email: "nope", password: PASSWORD });

    expect(result).toMatchObject({
      ok: false,
      failure: { kind: "field", field: "email" },
    });
    expect(createAuthClient).not.toHaveBeenCalled();
    expect(signUpCall).not.toHaveBeenCalled();
  });

  it("reports an already-registered email as its own failure (2.7)", async () => {
    const error = { code: "user_already_exists" };
    signUpCall.mockResolvedValue({ data: {}, error });

    const result = await signUp({ email: "ana@example.com", password: PASSWORD });

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "banner",
        message: "That email is already registered. Sign in instead.",
      },
    });
    expect(mapAuthError).toHaveBeenCalledWith(error);
  });

  // The guard for the day `enable_confirmations` is turned on: a user without a
  // session is not signed in, and reporting success would navigate an
  // unauthenticated visitor into the app.
  it("refuses to report success when no session came back (2.4)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    signUpCall.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });

    const result = await signUp({ email: "ana@example.com", password: PASSWORD });

    // Named copy, not the generic banner: the account *was* created, so "try
    // again" would send the user round a loop that can only ever answer
    // "already registered".
    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "banner",
        message: "Check your email to confirm your account, then sign in.",
      },
    });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("keeps the password out of the result and the log on every path (1.6)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    signUpCall.mockResolvedValue({ data: {}, error: { code: "banana" } });

    const result = await signUp({ email: "ana@example.com", password: PASSWORD });

    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expect(JSON.stringify(log.mock.calls)).not.toContain(PASSWORD);
  });
});
