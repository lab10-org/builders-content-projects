// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  SESSION_KEY,
  clearSession,
  loadSession,
  saveSession,
} from "./sessionStorage";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("saveSession", () => {
  it("persists across browser restarts when the user asks to be remembered", () => {
    saveSession({ email: "ana@example.com" }, { remember: true });

    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("lasts only for the tab when the user does not ask to be remembered", () => {
    saveSession({ email: "ana@example.com" }, { remember: false });

    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("does not leave a persistent session behind when remember is turned off", () => {
    // The failure this guards against: sign in with "remember me", sign out,
    // sign back in without it, and the old persistent session outlives the tab.
    saveSession({ email: "ana@example.com" }, { remember: true });
    saveSession({ email: "beto@example.com" }, { remember: false });

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession()).toEqual({ email: "beto@example.com" });
  });

  it("does not leave a per-tab session behind when remember is turned on", () => {
    saveSession({ email: "ana@example.com" }, { remember: false });
    saveSession({ email: "beto@example.com" }, { remember: true });

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(loadSession()).toEqual({ email: "beto@example.com" });
  });

  it("round-trips through loadSession", () => {
    saveSession({ email: "ana@example.com" }, { remember: true });

    expect(loadSession()).toEqual({ email: "ana@example.com" });
  });
});

describe("loadSession", () => {
  it("returns null when nobody is signed in", () => {
    expect(loadSession()).toBeNull();
  });

  it("reads a per-tab session", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: "a@b.co" }));

    expect(loadSession()).toEqual({ email: "a@b.co" });
  });

  it("prefers the persistent session when both stores somehow hold one", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: "kept@b.co" }));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: "stale@b.co" }));

    expect(loadSession()).toEqual({ email: "kept@b.co" });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a JSON array", "[]"],
    ["a JSON string", '"ana@example.com"'],
    ["null", "null"],
    ["an object with no email", "{}"],
    ["a non-string email", '{"email":42}'],
    ["an empty email", '{"email":""}'],
  ])("returns null for %s rather than throwing", (_case, raw) => {
    localStorage.setItem(SESSION_KEY, raw);

    expect(loadSession()).toBeNull();
  });

  it("ignores extra fields from an older shape", () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email: "ana@example.com", legacyToken: "abc" }),
    );

    expect(loadSession()).toEqual({ email: "ana@example.com" });
  });
});

describe("clearSession", () => {
  it("signs the user out of both stores", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: "a@b.co" }));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: "c@d.co" }));

    clearSession();

    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("is safe to call when nobody is signed in", () => {
    expect(() => clearSession()).not.toThrow();
  });
});
