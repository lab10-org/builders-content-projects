import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthResult } from "./actions";
import { runAuthAction } from "./runAuthAction";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runAuthAction", () => {
  it.each<AuthResult>([
    { ok: true },
    { ok: false, failure: { kind: "banner", message: "Invalid email or password." } },
    {
      ok: false,
      failure: { kind: "field", field: "password", message: "Too short." },
    },
  ])("returns what the action returned, untouched (%o)", async (result) => {
    expect(await runAuthAction(async () => result)).toEqual(result);
  });

  // 4.5 for the case `mapAuthError` can never see: the action never ran, or its
  // POST never landed, so there is no error object on the server to map.
  it("turns a rejection into the unreachable banner", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runAuthAction(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "banner",
        message: "Could not reach the server. Please try again.",
      },
    });
  });

  // 5.2: `signIn`/`signUp` deliberately let a missing variable throw. Without
  // this the screen showed nothing at all and the button simply looked dead.
  it("gives a deployment fault the same banner rather than no banner", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runAuthAction(() => {
      throw new Error("Missing SUPABASE_URL. Set it in .env.local");
    });

    expect(result).toMatchObject({ ok: false, failure: { kind: "banner" } });
    // The operator gets the detail; the user gets none of it.
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("SUPABASE_URL");
  });

  it("does not swallow the detail of what it caught", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = new Error("SECRET-DETAIL-42");

    await runAuthAction(() => Promise.reject(thrown));

    expect(log).toHaveBeenCalledWith(expect.any(String), thrown);
  });
});
