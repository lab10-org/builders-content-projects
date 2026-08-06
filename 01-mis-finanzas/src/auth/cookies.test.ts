import { describe, expect, it } from "vitest";

import {
  PERSIST_COOKIE,
  PERSIST_MAX_AGE,
  applyPersistence,
  persistCookie,
  readsAsPersistent,
} from "./cookies";

describe("the persistence constants", () => {
  it("names the cookie the middleware and the actions both read", () => {
    expect(PERSIST_COOKIE).toBe("mis-finanzas:persist");
  });

  // Asserted as a number rather than by echoing the constant, so the 400-day
  // rule itself can fail — 400 days is the browser cap on cookie lifetime.
  it("caps a persistent cookie at 400 days", () => {
    expect(PERSIST_MAX_AGE).toBe(400 * 24 * 60 * 60);
  });
});

describe("applyPersistence", () => {
  it("stamps maxAge when the session is persistent", () => {
    expect(applyPersistence({}, true)).toEqual({ maxAge: PERSIST_MAX_AGE });
  });

  // The assertion 3.4 lives on: @supabase/ssr defaults to a 400-day cookie, so
  // a browser session is only a browser session if both lifetime fields are
  // actively removed.
  it("strips maxAge and expires when the session is not persistent", () => {
    const options = { maxAge: 34560000, expires: new Date("2030-01-01") };

    const result = applyPersistence(options, false);

    expect(result).not.toHaveProperty("maxAge");
    expect(result).not.toHaveProperty("expires");
  });

  it("does not mutate the options it was given", () => {
    const options = { maxAge: 34560000, expires: new Date("2030-01-01") };

    applyPersistence(options, false);

    expect(options.maxAge).toBe(34560000);
    expect(options.expires).toEqual(new Date("2030-01-01"));
  });

  it("passes every other option through untouched, in both branches", () => {
    const options = {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: false,
    };

    expect(applyPersistence(options, true)).toEqual({
      ...options,
      maxAge: PERSIST_MAX_AGE,
    });
    expect(applyPersistence(options, false)).toEqual(options);
  });
});

describe("readsAsPersistent", () => {
  it("reads the persistent marker", () => {
    expect(readsAsPersistent("1")).toBe(true);
  });

  // Anything else is the safe default: a session that should have died with the
  // tab must never be resurrected by a malformed cookie.
  it.each([undefined, "0", "", "true", "yes"])(
    "treats %o as not persistent",
    (value) => {
      expect(readsAsPersistent(value)).toBe(false);
    },
  );
});

describe("persistCookie", () => {
  it("records a persistent choice with its own lifetime", () => {
    const cookie = persistCookie(true);

    expect(cookie.name).toBe(PERSIST_COOKIE);
    expect(cookie.value).toBe("1");
    expect(cookie.options.maxAge).toBe(PERSIST_MAX_AGE);
  });

  it("records a browser-session choice with no lifetime", () => {
    const cookie = persistCookie(false);

    expect(cookie.value).toBe("0");
    expect(cookie.options).not.toHaveProperty("maxAge");
    expect(cookie.options).not.toHaveProperty("expires");
  });

  // Path matters: the middleware refreshes tokens on every route, and a cookie
  // scoped anywhere narrower would read as absent there — silently downgrading
  // a remembered session.
  it.each([true, false])("scopes the cookie to the whole site (%s)", (persist) => {
    expect(persistCookie(persist).options.path).toBe("/");
  });
});
