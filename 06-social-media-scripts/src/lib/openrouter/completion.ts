import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import type { z } from 'zod'

/** The response did not conform to the schema, twice. T16/T17 branch on this
 *  to mark one reel failed; it is never a FatalRunError. */
export class SchemaValidationError extends Error {
  constructor(model: string, cause?: unknown) {
    super(`Model ${model} returned a response that did not match the expected schema, twice.`)
    this.name = 'SchemaValidationError'
    this.cause = cause
  }
}

export interface CompleteArgs<T> {
  model: string
  prompt: string
  schema: z.ZodType<T>
}

export interface CompletionClient {
  complete<T>(args: CompleteArgs<T>): Promise<T>
}

/**
 * Test seam. Hands back the model's raw object as `unknown` so `complete` — not
 * the SDK — decides whether it conforms, which is what makes the retry rule
 * ours and observable.
 */
export type ObjectGenerator = (args: CompleteArgs<unknown>) => Promise<unknown>

/**
 * The AI SDK's own validation failures, matched by name rather than by
 * importing the error classes: the SDK prefixes them `AI_` and the set has
 * changed across majors, so a name test survives an upgrade that a hard import
 * would not.
 */
const isSchemaRejection = (error: unknown): boolean =>
  /NoObjectGenerated|TypeValidation|JSONParse/i.test((error as { name?: string })?.name ?? '')

export function createCompletionClient(
  apiKey: string,
  generate?: ObjectGenerator,
): CompletionClient {
  const doGenerate: ObjectGenerator =
    generate ??
    (async ({ model, prompt, schema }) => {
      const openrouter = createOpenRouter({ apiKey })
      const { object } = await generateObject({
        model: openrouter.chat(model),
        prompt,
        schema: schema as z.ZodType<unknown>,
      })
      return object
    })

  return {
    async complete<T>(args: CompleteArgs<T>): Promise<T> {
      // Exactly two attempts: one retry on rejection, then give up (3.3, 4.4).
      let lastCause: unknown
      for (let attempt = 1; attempt <= 2; attempt++) {
        let raw: unknown
        try {
          raw = await doGenerate(args as CompleteArgs<unknown>)
        } catch (error) {
          // A transport failure is not a schema rejection and is not retried here.
          if (!isSchemaRejection(error)) throw error
          lastCause = error
          continue
        }

        const parsed = args.schema.safeParse(raw)
        if (parsed.success) return parsed.data
        lastCause = parsed.error
      }

      throw new SchemaValidationError(args.model, lastCause)
    },
  }
}
