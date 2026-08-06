import { describe, expect, it } from "vitest";

import { readSupabaseEnv } from "./env";

const VALID = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-key",
};

describe("readSupabaseEnv", () => {
  it("reads both variables from the given record", () => {
    expect(readSupabaseEnv(VALID)).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_test-key",
    });
  });

  it("throws naming SUPABASE_URL when it is absent", () => {
    const { SUPABASE_URL: _omitted, ...rest } = VALID;

    expect(() => readSupabaseEnv(rest)).toThrowError(/SUPABASE_URL/);
  });

  it("throws naming SUPABASE_PUBLISHABLE_KEY when it is absent", () => {
    const { SUPABASE_PUBLISHABLE_KEY: _omitted, ...rest } = VALID;

    expect(() => readSupabaseEnv(rest)).toThrowError(
      /SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  // A variable declared but left blank is the likelier mistake than a missing
  // line, and it must fail the same way rather than reaching the SDK as "".
  it("treats an empty or whitespace-only SUPABASE_URL as absent", () => {
    expect(() => readSupabaseEnv({ ...VALID, SUPABASE_URL: "" })).toThrowError(
      /SUPABASE_URL/,
    );
    expect(() =>
      readSupabaseEnv({ ...VALID, SUPABASE_URL: "   " }),
    ).toThrowError(/SUPABASE_URL/);
  });

  it("treats an empty or whitespace-only SUPABASE_PUBLISHABLE_KEY as absent", () => {
    expect(() =>
      readSupabaseEnv({ ...VALID, SUPABASE_PUBLISHABLE_KEY: "" }),
    ).toThrowError(/SUPABASE_PUBLISHABLE_KEY/);
    expect(() =>
      readSupabaseEnv({ ...VALID, SUPABASE_PUBLISHABLE_KEY: "  " }),
    ).toThrowError(/SUPABASE_PUBLISHABLE_KEY/);
  });

  // 5.3: the browser-exposed names are not a fallback. Accepting them would
  // silently reward publishing the connection to the bundle.
  it("does not accept the NEXT_PUBLIC_ names as a fallback", () => {
    expect(() =>
      readSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toThrowError(/SUPABASE_URL/);
  });

  // 5.3: whatever else lives in the environment stays there. The secret key
  // must not be able to ride along inside the returned object.
  it("returns exactly the two documented keys, carrying no secret along", () => {
    const result = readSupabaseEnv({
      ...VALID,
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_do-not-leak",
      SUPABASE_JWT_SECRET: "super-secret",
    });

    expect(Object.keys(result).sort()).toEqual(["publishableKey", "url"]);
    expect(JSON.stringify(result)).not.toContain("sb_secret_do-not-leak");
  });
});
