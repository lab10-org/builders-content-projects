/**
 * The OpenRouter model backing each step, in one place so all three are
 * swappable without touching the modules that use them.
 *
 * Pinned against OpenRouter's live model list on 2026-08-06:
 *
 *   openai/whisper-large-v3   transcription
 *   anthropic/claude-opus-5   analysis    ($5 / $25 per M tokens, 1M ctx)
 *   anthropic/claude-opus-5   generation  ($5 / $25 per M tokens, 1M ctx)
 *
 * Cost lever, deliberately NOT taken by default: `anthropic/claude-sonnet-5`
 * is roughly 2.5x cheaper ($2 / $10 per M) and is a credible swap for the
 * analysis step, which is bounded structured extraction from a short
 * transcript. Downgrading is a product decision — make it explicitly here
 * rather than by accident.
 */
export const MODELS = {
  transcription: 'openai/whisper-large-v3',
  analysis: 'anthropic/claude-opus-5',
  generation: 'anthropic/claude-opus-5',
} as const

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
