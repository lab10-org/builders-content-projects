import { describe, expect, it } from "vitest";

import { mapAuthError } from "./errors";

describe("mapAuthError — recognized failures", () => {
  it("maps invalid credentials to a banner that reveals nothing (4.1)", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toEqual({
      failure: { kind: "banner", message: "Invalid email or password." },
      recognized: true,
    });
  });

  it.each(["user_already_exists", "email_exists"])(
    "maps %s to the already-registered banner (4.2)",
    (code) => {
      expect(mapAuthError({ code })).toEqual({
        failure: {
          kind: "banner",
          message: "That email is already registered. Sign in instead.",
        },
        recognized: true,
      });
    },
  );

  it("annotates the password field with the service's own requirement (4.3)", () => {
    const { failure, recognized } = mapAuthError({
      code: "weak_password",
      message: "Password should be at least 6 characters",
    });

    expect(recognized).toBe(true);
    expect(failure).toEqual({
      kind: "field",
      field: "password",
      message: "Password should be at least 6 characters",
    });
  });

  // 4.3 must never degrade to an empty annotation: a field marked invalid with
  // no message tells the user nothing.
  it("falls back to a stated requirement when weak_password carries no message", () => {
    expect(mapAuthError({ code: "weak_password" })).toEqual({
      failure: {
        kind: "field",
        field: "password",
        message: "Password must be at least 6 characters.",
      },
      recognized: true,
    });
  });

  it.each([{ code: "over_request_rate_limit" }, { status: 429 }])(
    "maps rate limiting (%o) to the wait-and-retry banner (4.4)",
    (error) => {
      expect(mapAuthError(error)).toEqual({
        failure: {
          kind: "banner",
          message: "Too many attempts. Wait a moment and try again.",
        },
        recognized: true,
      });
    },
  );

  it.each([
    { name: "AuthRetryableFetchError", status: 0 },
    new TypeError("Failed to fetch"),
    new TypeError("NetworkError when attempting to fetch resource."),
  ])("maps an unreachable service (%o) to the retry banner (4.5)", (error) => {
    expect(mapAuthError(error)).toEqual({
      failure: {
        kind: "banner",
        message: "Could not reach the server. Please try again.",
      },
      recognized: true,
    });
  });

  it("names the inbox when the account exists but is unconfirmed", () => {
    expect(mapAuthError({ code: "email_not_confirmed" })).toEqual({
      failure: {
        kind: "banner",
        message: "Check your email to confirm your account, then sign in.",
      },
      recognized: true,
    });
  });
});

describe("mapAuthError — unrecognized failures (4.6)", () => {
  it("shows a generic banner and leaks neither the code nor the detail", () => {
    const result = mapAuthError({
      code: "banana",
      message: "SECRET-DETAIL-42",
    });

    expect(result).toEqual({
      failure: {
        kind: "banner",
        message: "Something went wrong. Please try again.",
      },
      recognized: false,
    });
    expect(result.failure.message).not.toContain("banana");
    expect(result.failure.message).not.toContain("SECRET-DETAIL-42");
  });

  // The SDK is not the only thing that can reach this function: a rejected
  // promise can carry anything at all, and none of it may throw here.
  it.each([undefined, null, "boom", 42, []])(
    "handles %o without throwing",
    (error) => {
      expect(mapAuthError(error)).toEqual({
        failure: {
          kind: "banner",
          message: "Something went wrong. Please try again.",
        },
        recognized: false,
      });
    },
  );

  // `TypeError` is the shape of a bug in this code path far more often than of
  // a dead network. Calling one "could not reach the server" would tell the user
  // to retry something that can never work, and — being `recognized` — would
  // suppress the one log line that reveals it.
  it("treats a TypeError that is not a transport failure as unrecognized", () => {
    expect(
      mapAuthError(new TypeError("supabase.auth.signInWithPassword is not a function")),
    ).toEqual({
      failure: {
        kind: "banner",
        message: "Something went wrong. Please try again.",
      },
      recognized: false,
    });
  });

  it("does not let a thrown string's own text reach the screen", () => {
    expect(mapAuthError("boom").failure.message).not.toContain(
      "boom",
    );
  });
});
