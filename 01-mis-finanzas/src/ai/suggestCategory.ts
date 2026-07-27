import Anthropic from "@anthropic-ai/sdk";

import { CATEGORIES, type Category } from "../domain/expense";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 16; // the answer is a single word

/**
 * The slice of the Anthropic client this module actually uses.
 *
 * Declared structurally rather than as `Anthropic` so a test fake exposing only
 * `messages.create` is assignable without casts. `Pick<Anthropic, "messages">`
 * would not work: `Anthropic["messages"]` is the full SDK `Messages` class.
 */
export type SuggestClient = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      messages: { role: "user"; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
};

/**
 * Maps any model reply to a valid `Category`, falling back to `Otros` for
 * anything off the fixed list (3.4).
 */
export function normalizeCategory(raw: string): Category {
  const cleaned = raw.trim().toLowerCase();
  const match = CATEGORIES.find((category) => category.toLowerCase() === cleaned);
  return match ?? "Otros";
}

function buildPrompt(description: string): string {
  return [
    "Clasifica el siguiente gasto personal en exactamente una de estas categorías:",
    CATEGORIES.join(", "),
    "",
    `Descripción del gasto: ${description}`,
    "",
    "Responde únicamente con el nombre de la categoría, sin explicación.",
  ].join("\n");
}

/**
 * Asks the model for a category and normalizes the reply.
 *
 * Errors are deliberately **not** caught: they propagate to the route handler,
 * which turns them into a `502` (3.6).
 */
export async function suggestCategory(
  description: string,
  client?: SuggestClient,
): Promise<Category> {
  // Constructed lazily, never at module scope, so importing this module without
  // ANTHROPIC_API_KEY does not throw — and the key stays server-side by
  // construction (3.7).
  const anthropic = client ?? (new Anthropic() as unknown as SuggestClient);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildPrompt(description) }],
  });

  const firstText = response.content.find((block) => block.type === "text");
  return normalizeCategory(firstText?.text ?? "");
}
