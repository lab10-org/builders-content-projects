import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../../lib/preflight'
import { listActors, loadActorProfile } from '../../lib/profiles'
import type { RunDeps } from '../deps'
import { preflight } from './preflight'

// Never process.env, never the repo's real profiles/.
const okEnv = { IG_SESSIONID: 'cookie', OPENROUTER_API_KEY: 'key' }
const runInput = { account: 'morningbrew', actor: 'juanse', scan: 20, top: 3 }

describe('preflight', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'preflight-profiles-'))
    await writeFile(join(dir, 'juanse.md'), '# juanse\n\nDirect.\n')
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const deps = (over: Partial<RunDeps> = {}): RunDeps =>
    ({
      env: okEnv,
      probe: { isAvailable: vi.fn().mockResolvedValue(true) },
      profilesDir: dir,
      profiles: { listActors, loadActorProfile },
      ...over,
    }) as unknown as RunDeps

  it('carries the run input through and adds the loaded profile (7.1)', async () => {
    const state = await preflight(runInput, deps())

    expect(state).toMatchObject({
      account: 'morningbrew',
      actor: 'juanse',
      scan: 20,
      top: 3,
      profile: { name: 'juanse', markdown: '# juanse\n\nDirect.\n' },
    })
  })

  it('rejects unwrapped on a missing IG_SESSIONID, before reading any profile (7.2)', async () => {
    const loadActorProfileSpy = vi.fn()

    const error = await preflight(
      runInput,
      deps({
        env: { ...okEnv, IG_SESSIONID: '' },
        profiles: { listActors, loadActorProfile: loadActorProfileSpy } as never,
      }),
    ).catch((e) => e)

    expect(error).toBeInstanceOf(FatalRunError)
    expect(error.code).toBe('missing-ig-session')
    expect(error.message).toContain('IG_SESSIONID')
    // Preconditions come first — no profile is read.
    expect(loadActorProfileSpy).not.toHaveBeenCalled()
  })

  it('rejects when ffmpeg is unavailable', async () => {
    // Per-code coverage lives in T3; what this layer adds is that the step
    // delegates and does not swallow.
    const error = await preflight(
      runInput,
      deps({ probe: { isAvailable: vi.fn().mockResolvedValue(false) } }),
    ).catch((e) => e)

    expect(error).toBeInstanceOf(FatalRunError)
    expect(error.code).toBe('ffmpeg-unavailable')
  })

  it('rejects with unknown-actor, naming the actor (4.5)', async () => {
    const error = await preflight({ ...runInput, actor: 'nadie' }, deps()).catch((e) => e)

    expect(error).toBeInstanceOf(FatalRunError)
    expect(error.code).toBe('unknown-actor')
    expect(error.message).toContain('nadie')
  })

  it('never turns a fatal into a reel-style value', async () => {
    // This is a run-level step; withReelFailure is for per-reel steps only.
    const result = await preflight(runInput, deps({ env: {} })).then(
      (value) => value,
      (error) => error,
    )

    expect(result).toBeInstanceOf(FatalRunError)
    expect(result).not.toHaveProperty('status')
  })
})
