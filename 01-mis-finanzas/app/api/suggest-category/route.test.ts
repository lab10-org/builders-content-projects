import { beforeEach, describe, expect, it, vi } from "vitest";

import { suggestCategory } from "../../../src/ai/suggestCategory";
import { POST } from "./route";

// Mocked by the same specifier the route imports, so no network call, no API
// key, and no Next.js runtime is involved — the handler is invoked directly.
vi.mock("../../../src/ai/suggestCategory", () => ({
  suggestCategory: vi.fn(),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/suggest-category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string): Request {
  return new Request("http://localhost/api/suggest-category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.mocked(suggestCategory).mockReset();
});

describe("success [3.1]", () => {
  it("relays the description and returns the resulting category", async () => {
    vi.mocked(suggestCategory).mockResolvedValue("food");

    const response = await POST(jsonRequest({ description: "Almuerzo" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ category: "food" });
    expect(suggestCategory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(suggestCategory).mock.calls[0][0]).toBe("Almuerzo");
  });

  it("returns whatever category the AI layer resolved, not a fixed one", async () => {
    vi.mocked(suggestCategory).mockResolvedValue("leisure");

    const response = await POST(jsonRequest({ description: "Cine" }));

    await expect(response.json()).resolves.toEqual({ category: "leisure" });
  });
});

describe("invalid request [3.5]", () => {
  it.each([
    ["whitespace-only description", { description: "   " }],
    ["empty description", { description: "" }],
    ["no description field", {}],
    ["a non-string description", { description: 42 }],
    ["a null description", { description: null }],
    ["an array body", []],
    ["a null body", null],
  ])("returns 400 for %s without calling the AI", async (_label, body) => {
    const response = await POST(jsonRequest(body));

    expect(response.status).toBe(400);
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not valid JSON, without throwing", async () => {
    const response = await POST(rawRequest("{oops"));

    expect(response.status).toBe(400);
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty body", async () => {
    const response = await POST(rawRequest(""));

    expect(response.status).toBe(400);
    expect(suggestCategory).not.toHaveBeenCalled();
  });
});

describe("AI failure [3.6]", () => {
  it("turns a rejection into 502 with a string error", async () => {
    vi.mocked(suggestCategory).mockRejectedValue(new Error("upstream 529"));

    const response = await POST(jsonRequest({ description: "Almuerzo" }));

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: unknown };
    expect(typeof body.error).toBe("string");
    expect((body.error as string).length).toBeGreaterThan(0);
  });

  it("does not leak the upstream error text to the client", async () => {
    vi.mocked(suggestCategory).mockRejectedValue(
      new Error("sk-ant-secret-leaked-in-message"),
    );

    const response = await POST(jsonRequest({ description: "Almuerzo" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).not.toContain("sk-ant");
  });

  it("turns a non-Error rejection into 502 too", async () => {
    vi.mocked(suggestCategory).mockRejectedValue("timeout");

    const response = await POST(jsonRequest({ description: "Almuerzo" }));

    expect(response.status).toBe(502);
  });
});
