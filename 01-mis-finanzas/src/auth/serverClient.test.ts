import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERSIST_COOKIE, PERSIST_MAX_AGE } from "./cookies";
import { createAuthClient } from "./serverClient";

const { createServerClient } = vi.hoisted(() => ({
  // Typed with a rest parameter so `mock.calls` is indexable: a zero-arg
  // `vi.fn` records calls as the empty tuple, which `tsc` rejects on access.
  createServerClient: vi.fn((..._args: unknown[]) => ({ auth: {} })),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

/** Stands in for Next's request cookie store: only `getAll` and `set` are used. */
const store = vi.hoisted(() => ({
  entries: [] as { name: string; value: string }[],
  getAll: vi.fn(function (this: void) {
    return store.entries;
  }),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => store }));

vi.mock("./env", () => ({
  readSupabaseEnv: () => ({
    url: "http://127.0.0.1:54321",
    publishableKey: "sb_publishable_test-key",
  }),
}));

beforeEach(() => {
  store.entries = [];
  store.getAll.mockClear();
  store.set.mockClear();
  createServerClient.mockClear();
});

/** The cookie adapter `createAuthClient` handed to the SDK. */
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

/** What the store was asked to write for a given cookie name. */
function written(name: string) {
  const call = store.set.mock.calls.find(([written]) => written === name);
  return call?.[2] as Record<string, unknown> | undefined;
}

function writeSessionCookie() {
  adapter().setAll([
    { name: "sb-127-auth-token", value: "token-value", options: {} },
  ]);
}

describe("createAuthClient", () => {
  it("builds the client from the configured connection (3.1)", async () => {
    await createAuthClient(true);

    expect(createServerClient.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:54321",
    );
    expect(createServerClient.mock.calls[0]?.[1]).toBe(
      "sb_publishable_test-key",
    );
  });

  it("reads cookies through the request store", async () => {
    store.entries = [{ name: "sb-127-auth-token", value: "existing" }];

    await createAuthClient(true);

    expect(adapter().getAll()).toEqual(store.entries);
  });

  it("writes a persistent session and records the choice (3.3)", async () => {
    await createAuthClient(true);
    writeSessionCookie();

    expect(written("sb-127-auth-token")).toMatchObject({
      maxAge: PERSIST_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });
    expect(store.set).toHaveBeenCalledWith(
      PERSIST_COOKIE,
      "1",
      expect.objectContaining({ maxAge: PERSIST_MAX_AGE }),
    );
  });

  it("writes a browser session with no lifetime at all (3.4)", async () => {
    await createAuthClient(false);
    writeSessionCookie();

    const options = written("sb-127-auth-token");
    expect(options).not.toHaveProperty("maxAge");
    expect(options).not.toHaveProperty("expires");
    expect(options).toMatchObject({ httpOnly: true, path: "/" });
    expect(store.set).toHaveBeenCalledWith(
      PERSIST_COOKIE,
      "0",
      expect.not.objectContaining({ maxAge: expect.anything() }),
    );
  });

  // The marker governs the lifetime of every cookie the middleware later
  // refreshes, so a script that could write it could promote an ephemeral
  // session to 400 days.
  it("locks the recorded choice down exactly like the session it governs", async () => {
    await createAuthClient(false);
    writeSessionCookie();

    expect(written(PERSIST_COOKIE)).toMatchObject({
      httpOnly: true,
      secure: false,
      path: "/",
    });
  });
});
