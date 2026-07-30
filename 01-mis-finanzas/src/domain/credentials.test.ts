import { describe, expect, it } from "vitest";

import { validateCredentials } from "./credentials";

/** Keeps the happy-path cases from repeating a valid counterpart field. */
const VALID = { email: "ana@example.com", password: "s3cret-pass" };

function errorFields(input: { email: unknown; password: unknown }) {
  const result = validateCredentials(input);
  return result.ok ? [] : result.errors.map((error) => error.field);
}

describe("validateCredentials", () => {
  it("accepts a well-formed email and password", () => {
    const result = validateCredentials(VALID);

    expect(result).toEqual({
      ok: true,
      credentials: { email: "ana@example.com", password: "s3cret-pass" },
    });
  });

  it("normalizes the email by trimming and lowercasing it", () => {
    const result = validateCredentials({
      ...VALID,
      email: "  Ana.Perez@Example.COM  ",
    });

    expect(result.ok && result.credentials.email).toBe("ana.perez@example.com");
  });

  it("keeps the password exactly as typed", () => {
    // Passwords are literal secrets: trimming or lowercasing one would silently
    // change what the user entered.
    const result = validateCredentials({ ...VALID, password: "  Spaced Pass  " });

    expect(result.ok && result.credentials.password).toBe("  Spaced Pass  ");
  });

  describe("email", () => {
    it.each([
      ["an empty string", ""],
      ["only whitespace", "   "],
      ["a missing @", "anaexample.com"],
      ["a missing local part", "@example.com"],
      ["a missing domain", "ana@"],
      ["a domain with no dot", "ana@example"],
      ["a one-letter TLD", "ana@example.c"],
      ["two @ signs", "ana@@example.com"],
      ["an inner space", "ana perez@example.com"],
      ["a trailing dot", "ana@example.com."],
      ["a leading dot in the domain", "ana@.example.com"],
      ["a non-string", 42],
      ["null", null],
      ["undefined", undefined],
    ])("rejects %s", (_case, email) => {
      expect(errorFields({ ...VALID, email })).toEqual(["email"]);
    });

    it.each([
      ["a subdomain", "ana@mail.example.com"],
      ["a plus tag", "ana+finanzas@example.com"],
      ["a hyphenated domain", "ana@my-bank.example.com"],
      ["a dotted local part", "ana.perez@example.com"],
      ["digits", "ana2026@example.com"],
    ])("accepts %s", (_case, email) => {
      expect(validateCredentials({ ...VALID, email }).ok).toBe(true);
    });

    it("explains the problem in its message", () => {
      const result = validateCredentials({ ...VALID, email: "nope" });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors[0].message).toMatch(/email/i);
    });
  });

  describe("password", () => {
    it.each([
      ["an empty string", ""],
      ["only whitespace", "   "],
      ["a non-string", 1234],
      ["null", null],
      ["undefined", undefined],
    ])("rejects %s", (_case, password) => {
      expect(errorFields({ ...VALID, password })).toEqual(["password"]);
    });

    it("does not impose a minimum length", () => {
      // This is a sign-in form, not a sign-up form: the length policy belongs
      // wherever the account was created, and enforcing one here would only
      // reject a legitimate existing password.
      expect(validateCredentials({ ...VALID, password: "a" }).ok).toBe(true);
    });

    it("explains the problem in its message", () => {
      const result = validateCredentials({ ...VALID, password: "" });

      expect(!result.ok && result.errors[0].message).toMatch(/password/i);
    });
  });

  it("reports every invalid field at once, in form order", () => {
    // The form annotates all fields in one pass, so a single submit must not
    // hide the second problem behind the first.
    expect(errorFields({ email: "nope", password: "" })).toEqual([
      "email",
      "password",
    ]);
  });

  it("returns no credentials when validation fails", () => {
    const result = validateCredentials({ email: "nope", password: "" });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("credentials");
  });
});
