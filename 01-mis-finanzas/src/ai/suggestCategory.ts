import Anthropic from "@anthropic-ai/sdk";

import {
  REGISTRATION_CATEGORIES,
  type Category,
  categoryFromLabel,
  categoryLabel,
} from "../domain/transaction";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 16; // the answer is a single word

/** Requirement 3.4's fallback — the canonical value shown as "Otros". */
const FALLBACK: Category = "other";

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
 * The Spanish names the model is asked to choose from — the six of requirement
 * 2.1, which is also what the registration form offers. The onboarding-only
 * `subscriptions` category is deliberately excluded: this suggester serves the
 * `/` form, and offering a category that form cannot select would be a dead end.
 */
const PROMPT_CATEGORIES = REGISTRATION_CATEGORIES.map((value) =>
  categoryLabel(value, "es"),
);

/**
 * Maps any model reply to a canonical `Category`, falling back to `other` for
 * anything off the fixed list (3.4).
 *
 * The model answers with a Spanish *label* because that is what the prompt
 * offers, so the reply is resolved through `categoryFromLabel` and then confined
 * to the registration six — a reply of "Suscripciones" is off-list here.
 */
export function normalizeCategory(raw: string): Category {
  const resolved = categoryFromLabel(raw);
  if (resolved === null) return FALLBACK;

  return (REGISTRATION_CATEGORIES as readonly Category[]).includes(resolved)
    ? resolved
    : FALLBACK;
}

function buildPrompt(description: string): string {
  return [
    "Clasifica el siguiente gasto personal en exactamente una de estas categorías:",
    PROMPT_CATEGORIES.join(", "),
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
