import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  REGISTRATION_CATEGORIES,
  categoryLabel,
} from "../domain/transaction";
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
  it("resolves the Spanish label the prompt offers to its canonical value", () => {
    for (const value of REGISTRATION_CATEGORIES) {
      expect(normalizeCategory(categoryLabel(value, "es"))).toBe(value);
    }
  });

  it("accepts a canonical value answered verbatim", () => {
    for (const value of REGISTRATION_CATEGORIES) {
      expect(normalizeCategory(value)).toBe(value);
    }
  });

  it.each([
    ["  comida ", "food"],
    ["TRANSPORTE", "transport"],
    ["\nVivienda\t", "housing"],
    ["oCiO", "leisure"],
  ])("folds case and whitespace: %s → %s", (raw, expected) => {
    expect(normalizeCategory(raw)).toBe(expected);
  });

  it.each([
    ["off-list word", "Groceries"],
    ["empty", ""],
    ["whitespace only", "   "],
    ["a sentence", "La categoría es Comida, creo"],
    ["a near miss", "Comidas"],
  ])("falls back to other for %s", (_label, raw) => {
    expect(normalizeCategory(raw)).toBe("other");
  });

  it("falls back for a real category the registration form cannot offer", () => {
    // `subscriptions` exists in the domain but is onboarding-only, so suggesting
    // it here would hand the form a value it does not list.
    expect(normalizeCategory("Suscripciones")).toBe("other");
  });

  it("keeps the fallback displaying as Otros, per requirement 3.4", () => {
    expect(categoryLabel(normalizeCategory("Groceries"), "es")).toBe("Otros");
  });
});

describe("suggestCategory [3.1]", () => {
  it("relays the client's answer instead of guessing locally", async () => {
    // Deliberately NOT the intuitive category for this description: an
    // implementation that classifies locally would answer "food" and fail.
    const { client, create } = fakeClient(textReply("Transporte"));

    const result = await suggestCategory("Almuerzo con cliente", client);

    expect(result).toBe("transport");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("sends a prompt carrying the description and every offered category", async () => {
    const { client, create } = fakeClient(textReply("Comida"));

    await suggestCategory("Almuerzo con cliente", client);

    const params = create.mock.calls[0][0];
    const prompt = params.messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("Almuerzo con cliente");
    // Spanish labels, not canonical values: the model is asked in the language
    // of the screen this serves.
    for (const value of REGISTRATION_CATEGORIES) {
      expect(prompt).toContain(categoryLabel(value, "es"));
    }
    expect(params.model).toBe("claude-haiku-4-5");
    expect(params.max_tokens).toBeLessThanOrEqual(32);
  });

  it("does not offer the onboarding-only category", async () => {
    const { client, create } = fakeClient(textReply("Comida"));

    await suggestCategory("Netflix", client);

    const prompt = create.mock.calls[0][0].messages
      .map((message) => message.content)
      .join("\n");

    expect(prompt).not.toContain("Suscripciones");
  });

  it("falls back to other when the model answers off-list [3.4]", async () => {
    const { client } = fakeClient(textReply("Groceries"));

    await expect(suggestCategory("Compra en el super", client)).resolves.toBe(
      "other",
    );
  });

  it("falls back to other when the reply has no text block [3.4]", async () => {
    const { client } = fakeClient({ content: [{ type: "tool_use" }] });

    await expect(suggestCategory("Compra en el super", client)).resolves.toBe(
      "other",
    );
  });

  it("falls back to other when the reply has no content at all [3.4]", async () => {
    const { client } = fakeClient({ content: [] });

    await expect(suggestCategory("Compra en el super", client)).resolves.toBe(
      "other",
    );
  });

  it("normalizes a case/whitespace variant from the model", async () => {
    const { client } = fakeClient(textReply("  transporte\n"));

    await expect(suggestCategory("Taxi al aeropuerto", client)).resolves.toBe(
      "transport",
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

    await expect(suggestCategory("Almuerzo")).resolves.toBe("food");
    expect(Anthropic).toHaveBeenCalledTimes(1);
  });

  it("never constructs a client when one is injected", async () => {
    const { client } = fakeClient(textReply("Ocio"));

    await expect(suggestCategory("Cine", client)).resolves.toBe("leisure");
    expect(Anthropic).not.toHaveBeenCalled();
  });
});
