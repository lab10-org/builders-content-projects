import { describe, expect, it, vi } from 'vitest'
import { assertPreconditions, createBinaryProbe, FatalRunError, type BinaryProbe } from './index'

const okEnv = { IG_SESSIONID: 'cookie', OPENROUTER_API_KEY: 'key' }
const okProbe = (): BinaryProbe => ({ isAvailable: vi.fn().mockResolvedValue(true) })

const blank = ['', '   ', undefined] as const

describe('assertPreconditions', () => {
  it('resolves when everything is configured, having probed ffmpeg by name', async () => {
    const probe = okProbe()
    await expect(assertPreconditions(okEnv, probe)).resolves.toBeUndefined()
    // 7.1 names ffmpeg specifically — assert the argument, not just the call.
    expect(probe.isAvailable).toHaveBeenCalledWith('ffmpeg')
  })

  it.each(blank)('rejects a blank IG_SESSIONID (%p), naming the variable', async (value) => {
    const error = await assertPreconditions({ ...okEnv, IG_SESSIONID: value }, okProbe()).catch((e) => e)
    expect(error).toBeInstanceOf(FatalRunError)
    expect(error.code).toBe('missing-ig-session')
    expect(error.message).toContain('IG_SESSIONID')
  })

  it.each(blank)('rejects a blank OPENROUTER_API_KEY (%p), naming the variable', async (value) => {
    const error = await assertPreconditions({ ...okEnv, OPENROUTER_API_KEY: value }, okProbe()).catch((e) => e)
    expect(error).toBeInstanceOf(FatalRunError)
    expect(error.code).toBe('missing-openrouter-key')
    expect(error.message).toContain('OPENROUTER_API_KEY')
  })

  it('rejects when ffmpeg is not on PATH', async () => {
    const probe: BinaryProbe = { isAvailable: vi.fn().mockResolvedValue(false) }
    const error = await assertPreconditions(okEnv, probe).catch((e) => e)
    expect(error.code).toBe('ffmpeg-unavailable')
    expect(error.message).toMatch(/ffmpeg/i)
    expect(error.message).toMatch(/PATH/i)
  })

  it('checks cheapest-first and reports exactly one unmet precondition', async () => {
    const probe = okProbe()
    const error = await assertPreconditions({}, probe).catch((e) => e)
    // Both env vars are missing: the first check wins...
    expect(error.code).toBe('missing-ig-session')
    // ...and no process was spawned.
    expect(probe.isAvailable).not.toHaveBeenCalled()
  })
})

describe('FatalRunError', () => {
  it('is a real Error that keeps its code and name across throw/catch', () => {
    let caught: unknown
    try {
      throw new FatalRunError('account-not-found', 'nope')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).toBeInstanceOf(FatalRunError)
    expect((caught as FatalRunError).code).toBe('account-not-found')
    expect((caught as FatalRunError).name).toBe('FatalRunError')
  })
})

describe('createBinaryProbe', () => {
  // The one assertion that exercises the real child_process path. A missing
  // binary emits an 'error' event (ENOENT) rather than a non-zero exit, so the
  // probe must translate that to `false` instead of rejecting. Nothing needs to
  // be installed for this to pass, and no test asserts ffmpeg IS present.
  it('resolves false for a missing binary instead of rejecting', async () => {
    await expect(createBinaryProbe().isAvailable('definitely-not-a-binary-xyz')).resolves.toBe(false)
  })
})
