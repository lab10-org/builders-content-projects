import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERSIST_COOKIE, PERSIST_MAX_AGE } from "./cookies";
import { refreshSession } from "./middlewareClient";

const { createServerClient, getUser } = vi.hoisted(() => ({
  createServerClient: vi.fn((..._args: unknown[]) => ({ auth: { getUser } })),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

vi.mock("./env", () => ({
  readSupabaseEnv: () => ({
    url: "http://127.0.0.1:54321",
    publishableKey: "sb_publishable_test-key",
  }),
}));

const TOKEN = "sb-127-auth-token";

beforeEach(() => {
  createServerClient.mockClear();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});

function request(cookies: Record<string, string> = {}) {
  const req = new NextRequest("http://127.0.0.1:3000/onboarding/profile");
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

/** The cookie adapter `refreshSession` handed to the SDK. */
function adapter() {
  const [, , options] = createServerClient.mock.calls[0] as unknown as [
    string,
    string,
    {
      cookies: {
        getAll: () => { name: string; value: string }[];
        setAll: (
          list: { name: string; value: string; options: object }[],
        ) => void;
      };
    },
  ];
  return options.cookies;
}

describe("refreshSession", () => {
  it("builds the client from the configured connection", async () => {
    await refreshSession(request());

    expect(createServerClient.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:54321",
    );
    expect(createServerClient.mock.calls[0]?.[1]).toBe(
      "sb_publishable_test-key",
    );
  });

  it("reads cookies through the incoming request", async () => {
    const req = request({ [TOKEN]: "existing" });

    await refreshSession(req);

    expect(adapter().getAll()).toEqual(req.cookies.getAll());
  });

  // getUser() is the call that actually redeems an expired refresh token.
  it("asks for the user, which is what performs the refresh (3.6)", async () => {
    await refreshSession(request());

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("writes a refreshed cookie onto both the request and the response", async () => {
    const req = request();

    const response = await refreshSession(req);
    adapter().setAll([{ name: TOKEN, value: "refreshed", options: {} }]);

    expect(req.cookies.get(TOKEN)?.value).toBe("refreshed");
    expect(response.cookies.get(TOKEN)?.value).toBe("refreshed");
  });

  it("keeps a remembered session persistent across the refresh (3.7)", async () => {
    const req = request({ [PERSIST_COOKIE]: "1" });

    const response = await refreshSession(req);
    adapter().setAll([{ name: TOKEN, value: "refreshed", options: {} }]);

    expect(response.cookies.get(TOKEN)?.maxAge).toBe(PERSIST_MAX_AGE);
  });

  it.each<Record<string, string>>([{ [PERSIST_COOKIE]: "0" }, {}])(
    "keeps a browser session mortal across the refresh (%o) (3.7)",
    async (cookies) => {
      const req = request(cookies);

      const response = await refreshSession(req);
      adapter().setAll([{ name: TOKEN, value: "refreshed", options: {} }]);

      const written = response.cookies.get(TOKEN);
      expect(written?.maxAge).toBeUndefined();
      expect(written?.expires).toBeUndefined();
    },
  );

  // The choice is the sign-in's to make. A refresh that rewrote it could
  // promote a browser session to a persistent one behind the user's back.
  it("never rewrites the persistence marker itself (3.7)", async () => {
    const req = request({ [PERSIST_COOKIE]: "1" });

    const response = await refreshSession(req);
    adapter().setAll([{ name: TOKEN, value: "refreshed", options: {} }]);

    expect(response.cookies.get(PERSIST_COOKIE)).toBeUndefined();
  });
});

describe("refreshSession — a session that cannot be refreshed (3.8)", () => {
  it("still returns a usable response when the SDK reports an unusable token", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { code: "refresh_token_not_found" },
    });
    const req = request({ [TOKEN]: "stale" });

    const response = await refreshSession(req);
    // The SDK clears the session by writing an empty value; that clearing must
    // survive onto the response, so the user is simply signed out.
    adapter().setAll([{ name: TOKEN, value: "", options: {} }]);

    expect(response.cookies.get(TOKEN)?.value).toBe("");
  });

  it("does not throw when the refresh call itself rejects", async () => {
    getUser.mockRejectedValue(new TypeError("Failed to fetch"));

    const response = await refreshSession(request());

    expect(response.headers).toBeDefined();
  });
});
