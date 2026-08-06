import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { config, middleware } from "./middleware";

const { refreshSession, sentinel } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  sentinel: {} as unknown,
}));

vi.mock("./src/auth/middlewareClient", () => ({ refreshSession }));

beforeEach(() => {
  refreshSession.mockReset();
  refreshSession.mockResolvedValue(sentinel);
});

describe("middleware", () => {
  it("delegates to refreshSession and returns what it produced", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/login"));

    const response = await middleware(request);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledWith(request);
    expect(response).toBe(sentinel);
  });

  // Route guards are out of scope: the middleware refreshes, it does not
  // redirect. This is the assertion that fails the day one is added silently.
  it("redirects nobody of its own accord", async () => {
    refreshSession.mockResolvedValue(
      NextResponse.next({ request: new NextRequest(new URL("http://localhost:3000/")) }),
    );

    const response = await middleware(
      new NextRequest(new URL("http://localhost:3000/onboarding/profile")),
    );

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("the matcher", () => {
  const matches = (path: string) =>
    new RegExp(`^${config.matcher[0]}$`).test(path);

  it.each(["/", "/login", "/signup", "/onboarding/profile"])(
    "runs on the navigable route %s",
    (path) => {
      expect(matches(path)).toBe(true);
    },
  );

  // Refreshing a token to serve a chunk of JavaScript would be work per asset,
  // on requests no session is ever read from.
  it.each([
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/api/suggest-category",
  ])("skips %s", (path) => {
    expect(matches(path)).toBe(false);
  });
});
