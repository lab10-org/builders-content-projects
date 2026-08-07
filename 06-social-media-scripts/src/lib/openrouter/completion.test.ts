import { describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../preflight'
import { reelAnalysisSchema, reelScriptSchema } from '../types'
import { SchemaValidationError, createOpenRouterClients } from './index'

const analysis = { objective: 'explain', highlights: ['a', 'b'], targetAudience: 'founders' }
const script = { hook: 'wait', body: 'because', closing: 'follow' }

const completionWith = (generate: unknown) =>
  createOpenRouterClients({ apiKey: 'sk-test' }, { generate: generate as never }).completion

const ask = (schema: unknown) => ({
  model: 'anthropic/claude-opus-5',
  prompt: 'PROMPT TEXT',
  schema: schema as never,
})

describe('complete', () => {
  it('returns the parsed value on a conforming first response', async () => {
    const generate = vi.fn().mockResolvedValue(analysis)

    await expect(completionWith(generate).complete(ask(reelAnalysisSchema))).resolves.toEqual(analysis)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('passes the model and prompt through, and re-asks with the same request', async () => {
    const generate = vi.fn().mockResolvedValueOnce({ objective: 'x' }).mockResolvedValue(analysis)

    await completionWith(generate).complete(ask(reelAnalysisSchema))

    // The retry must not mutate the request.
    const [first, second] = generate.mock.calls
    expect(first[0].model).toBe('anthropic/claude-opus-5')
    expect(first[0].prompt).toBe('PROMPT TEXT')
    expect(second[0].model).toBe(first[0].model)
    expect(second[0].prompt).toBe(first[0].prompt)
  })

  it('retries exactly once when the response violates the schema (3.2, 3.3)', async () => {
    // Missing targetAudience.
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ objective: 'x', highlights: ['a'] })
      .mockResolvedValue(analysis)

    await expect(completionWith(generate).complete(ask(reelAnalysisSchema))).resolves.toEqual(analysis)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('throws SchemaValidationError after two violations (3.4, 4.4)', async () => {
    const generate = vi.fn().mockResolvedValue({ objective: 'x' })

    const error = await completionWith(generate).complete(ask(reelAnalysisSchema)).catch((e) => e)

    expect(generate).toHaveBeenCalledTimes(2)
    // T16/T17 branch on this to label the reel failed — never a run abort.
    expect(error).toBeInstanceOf(SchemaValidationError)
    expect(error).not.toBeInstanceOf(FatalRunError)
  })

  it.each([
    'AI_NoObjectGeneratedError',
    'AI_TypeValidationError',
    'AI_JSONParseError',
  ])('treats the SDK error %s as a schema rejection, not a transport failure', async (name) => {
    // Schema-constrained generation throws these when the model returns
    // something unparseable; without this case 3.3/4.4 would only hold for the
    // shapes our fake happens to return.
    const sdkError = Object.assign(new Error('bad object'), { name })
    const generate = vi.fn().mockRejectedValueOnce(sdkError).mockResolvedValue(analysis)

    await expect(completionWith(generate).complete(ask(reelAnalysisSchema))).resolves.toEqual(analysis)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('applies the same rule to the script schema (4.3)', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ hook: 'h', body: 'b' }) // no closing
      .mockResolvedValue(script)

    await expect(completionWith(generate).complete(ask(reelScriptSchema))).resolves.toEqual(script)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('does not retry a transport-level error', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('network'))

    const error: unknown = await completionWith(generate)
      .complete(ask(reelAnalysisSchema))
      .catch((e) => e)

    expect(generate).toHaveBeenCalledTimes(1)
    expect((error as Error).message).toBe('network')
    expect(error).not.toBeInstanceOf(SchemaValidationError)
  })
})

describe('createOpenRouterClients', () => {
  it('exposes both halves of the design factory', () => {
    const clients = createOpenRouterClients({ apiKey: 'sk-test' })

    expect(typeof clients.transcription.transcribe).toBe('function')
    expect(typeof clients.completion.complete).toBe('function')
  })
})
