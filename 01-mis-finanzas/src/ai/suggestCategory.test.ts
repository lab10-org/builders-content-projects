import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CATEGORIES } from "../domain/expense";
import { normalizeCategory, suggestCategory } from "./suggestCategory";

// The SDK constructor is replaced wholesale so the tests can assert *when* it is
// called. Nothing here reaches the network: every other test injects a fake.
vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));

/**
 * Captured at file-evaluation time, right after the static import of the module
 * under test. If `suggestCategory.ts` constructed a client at module scope this
 * would already be 1 — which is the only way to catch an eager regression.
 * Asserting that an import merely *succeeds* would not: `@anthropic-ai/sdk`
 * defaults `apiKey` to `null` when the env var is absent rather than throwing,
 * so a module-scope `new Anthropic()` imports cleanly too.
 */
const constructorCallsAtImport = vi.mocked(Anthropic).mock.calls.length;

/**
 * A fake standing in for the Anthropic client. The tests never reach the
 * network and never need `ANTHROPIC_API_KEY` — the client is always injected.
 */
type CreateParams = {
  model: string;
  max_tokens: number;
  messages: { role: "user"; content: string }[];
};

function fakeClient(reply: { content: { type: string; text?: string }[] }) {
  const create = vi.fn(async (_params: CreateParams) => reply);
  return { client: { messages: { create } }, create };
}

function textReply(text: string) {
  return { content: [{ type: "text", text }] };
}

describe("normalizeCategory [3.4]", () => {
  it("maps an exact match to itself", () => {
    for (const category of CATEGORIES) {
      expect(normalizeCategory(category)).toBe(category);
    }
  });

  it.each([
    ["  comida ", "Comida"],
    ["TRANSPORTE", "Transporte"],
    ["\nVivienda\t", "Vivienda"],
    ["oCiO", "Ocio"],
  ])("folds case and whitespace: %s → %s", (raw, expected) => {
    expect(normalizeCategory(raw)).toBe(expected);
  });

  it.each([
    ["off-list word", "Groceries"],
    ["empty", ""],
    ["whitespace only", "   "],
    ["a sentence", "La categoría es Comida, creo"],
    ["a near miss", "Comidas"],
  ])("falls back to Otros for %s", (_label, raw) => {
    expect(normalizeCategory(raw)).toBe("Otros");
  });
});

describe("suggestCategory [3.1]", () => {
  it("relays the client's answer instead of guessing locally", async () => {
    // Deliberately NOT the intuitive category for this description: an
    // implementation that classifies locally would answer "Comida" and fail.
    const { client, create } = fakeClient(textReply("Transporte"));

    const result = await suggestCategory("Almuerzo con cliente", client);

    expect(result).toBe("Transporte");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("sends a prompt carrying the description and every fixed category", async () => {
    const { client, create } = fakeClient(textReply("Comida"));

    await suggestCategory("Almuerzo con cliente", client);

    const params = create.mock.calls[0][0];
    const prompt = params.messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("Almuerzo con cliente");
    for (const category of CATEGORIES) {
      expect(prompt).toContain(category);
    }
    expect(params.model).toBe("claude-haiku-4-5");
    expect(params.max_tokens).toBeLessThanOrEqual(32);
  });

  it("falls back to Otros when the model answers off-list [3.4]", async () => {
    const { client } = fakeClient(textReply("Groceries"));

    await expect(suggestCategory("Compra en el super", client)).resolves.toBe(
      "Otros",
    );
  });

  it("falls back to Otros when the reply has no text block [3.4]", async () => {
    const { client } = fakeClient({ content: [{ type: "tool_use" }] });

    await expect(suggestCategory("Compra en el super", client)).resolves.toBe(
      "Otros",
    );
  });

  it("falls back to Otros when the reply has no content at all [3.4]", async () => {
    const { client } = fakeClient({ content: [] });

    await expect(suggestCategory("Compra en el super", client)).resolves.toBe(
      "Otros",
    );
  });

  it("normalizes a case/whitespace variant from the model", async () => {
    const { client } = fakeClient(textReply("  transporte\n"));

    await expect(suggestCategory("Taxi al aeropuerto", client)).resolves.toBe(
      "Transporte",
    );
  });

  it("propagates a client failure instead of swallowing it [3.6]", async () => {
    const failure = new Error("upstream 529");
    const create = vi.fn(async (_params: CreateParams) => {
      throw failure;
    });

    await expect(
      suggestCategory("Almuerzo", { messages: { create } }),
    ).rejects.toBe(failure);
  });
});

describe("lazy client construction", () => {
  afterEach(() => {
    vi.mocked(Anthropic).mockReset();
  });

  it("constructs no SDK client at module scope", () => {
    expect(constructorCallsAtImport).toBe(0);
  });

  it("constructs the default client only when none is injected", async () => {
    vi.mocked(Anthropic).mockImplementation(
      () =>
        ({
          messages: { create: async () => textReply("Comida") },
        }) as unknown as Anthropic,
    );

    await expect(suggestCategory("Almuerzo")).resolves.toBe("Comida");
    expect(Anthropic).toHaveBeenCalledTimes(1);
  });

  it("never constructs a client when one is injected", async () => {
    const { client } = fakeClient(textReply("Ocio"));

    await expect(suggestCategory("Cine", client)).resolves.toBe("Ocio");
    expect(Anthropic).not.toHaveBeenCalled();
  });
});
