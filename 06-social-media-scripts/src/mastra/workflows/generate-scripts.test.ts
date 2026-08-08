import { describe, expect, it, vi } from 'vitest'
import type { DiscoveredReel } from '../../lib/instagram'
import { MODELS } from '../../lib/models'
import { FatalRunError } from '../../lib/preflight'
import type { RunDeps } from '../deps'
import { MAX_REEL_CONCURRENCY, runGenerateScripts } from './generate-scripts'

const PROFILE_MARKER = 'PROFILE-MARKER-LINE-7c1'
const profile = { name: 'juanse', markdown: `# juanse\n\n${PROFILE_MARKER}\n` }
const analysis = { objective: 'o', highlights: ['h'], targetAudience: 't' }
const script = { hook: 'h', body: 'b', closing: 'c' }

const reel = (shortcode: string, views: number): DiscoveredReel => ({
  shortcode,
  mediaId: `m-${shortcode}`,
  views,
  likes: 1,
  comments: 0,
  thumbnailUrl: `https://cdn/${shortcode}.jpg`,
  takenAt: '2026-08-01T00:00:00.000Z',
})

const input = { account: 'nasa', actor: 'juanse', scan: 20, top: 3 }

/** Fakes for everything, with per-adapter overrides. */
const makeDeps = (over: Record<string, unknown> = {}, reels = [reel('a', 30), reel('b', 20), reel('c', 10)]) => {
  const prompts: Array<{ model: string; prompt: string }> = []

  const deps = {
    env: { IG_SESSIONID: 'cookie', OPENROUTER_API_KEY: 'key' },
    probe: { isAvailable: vi.fn().mockResolvedValue(true) },
    profilesDir: '/fake/profiles',
    profiles: {
      listActors: vi.fn().mockResolvedValue(['juanse']),
      loadActorProfile: vi.fn().mockResolvedValue(profile),
    },
    instagram: {
      discoverReels: vi.fn().mockResolvedValue(reels),
      hydrateReel: vi.fn().mockResolvedValue({ caption: 'c', videoUrl: 'u', durationSeconds: 1 }),
      downloadVideo: vi.fn().mockResolvedValue(undefined),
    },
    media: { extractAudio: vi.fn(async (_v: string, p: string) => ({ path: p, sizeBytes: 10 })) },
    transcription: { transcribe: vi.fn().mockResolvedValue('said') },
    completion: {
      complete: vi.fn(async ({ model, prompt }: { model: string; prompt: string }) => {
        prompts.push({ model, prompt })
        return prompt.includes('recording the script') || prompts.filter((p) => p.model === model).length % 2 === 0
          ? script
          : analysis
      }),
    },
    files: { remove: vi.fn().mockResolvedValue(undefined) },
    tmpDir: '/tmp/test-run',
    ...over,
  } as unknown as RunDeps

  return { deps, prompts }
}

/**
 * Distinguishes the two LLM calls. Not by model id — analysis and generation
 * are pinned to the same one — and not by the word "hook", which the analysis
 * prompt also contains. The script prompt's opening line is the only unambiguous
 * marker.
 */
const SCRIPT_PROMPT_MARKER = 'You are writing a script'
const smartComplete = () => {
  const prompts: Array<{ model: string; prompt: string }> = []
  const complete = vi.fn(async ({ model, prompt }: { model: string; prompt: string }) => {
    prompts.push({ model, prompt })
    return prompt.includes(SCRIPT_PROMPT_MARKER) ? script : analysis
  })
  return { complete, prompts }
}

describe('generateScriptsWorkflow', () => {
  it('delivers the successful reels when one fails (6.1, 6.2, 5.4)', async () => {
    const { complete } = smartComplete()
    const downloadVideo = vi.fn(async (_url: string, dest: string) => {
      if (dest.includes('b.mp4')) throw new Error('video not available (404)')
    })
    const transcribe = vi.fn().mockResolvedValue('said')
    const { deps } = makeDeps({
      completion: { complete },
      transcription: { transcribe },
      instagram: {
        discoverReels: vi.fn().mockResolvedValue([reel('a', 30), reel('b', 20), reel('c', 10)]),
        hydrateReel: vi.fn().mockResolvedValue({ caption: 'c', videoUrl: 'u', durationSeconds: 1 }),
        downloadVideo,
      },
    })

    const result = await runGenerateScripts(input, deps)

    expect(result.account).toBe('nasa')
    expect(result.actor).toBe('juanse')
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt)

    expect(result.reels.map((r) => [r.rank, r.status])).toEqual([
      [1, 'ok'],
      [2, 'failed'],
      [3, 'ok'],
    ])
    expect(result.reels[0]).toMatchObject({
      status: 'ok',
      analysis,
      script,
      shortcode: 'a',
      thumbnailUrl: 'https://cdn/a.jpg',
      metrics: { views: 30, likes: 1, comments: 0 },
    })
    expect(result.reels[1]).toMatchObject({ status: 'failed', failedStep: 'download' })

    // The rank-3 reel kept going after rank-2 failed.
    expect(transcribe).toHaveBeenCalledTimes(2)
  })

  it("wires preflight's profile through to generation (4.2 end to end)", async () => {
    const { complete, prompts } = smartComplete()
    const { deps } = makeDeps({ completion: { complete } })

    await runGenerateScripts(input, deps)

    const generation = prompts.filter((p) => p.prompt.includes(SCRIPT_PROMPT_MARKER))
    expect(generation.length).toBeGreaterThan(0)
    expect(generation.every((p) => p.model === MODELS.generation)).toBe(true)
    expect(generation.every((p) => p.prompt.includes(PROFILE_MARKER))).toBe(true)
  })

  it('resolves even when every reel fails (6.2)', async () => {
    const { deps } = makeDeps({
      instagram: {
        discoverReels: vi.fn().mockResolvedValue([reel('a', 30), reel('b', 20), reel('c', 10)]),
        hydrateReel: vi.fn().mockRejectedValue(new Error('no video URL')),
        downloadVideo: vi.fn(),
      },
    })

    const result = await runGenerateScripts(input, deps)

    expect(result.reels).toHaveLength(3)
    expect(result.reels.every((r) => r.status === 'failed')).toBe(true)
  })

  describe('a FatalRunError aborts the run, keeping its code', () => {
    const expectFatal = async (over: Record<string, unknown>, code: string) => {
      const { deps } = makeDeps(over)
      const error = await runGenerateScripts(input, deps).catch((e) => e)

      expect(error).toBeInstanceOf(FatalRunError)
      // T24b maps this onto status: 'aborted' with error: { code, message }.
      expect(error.code).toBe(code)
      return deps
    }

    it('unknown actor aborts before any reel is retrieved (4.5)', async () => {
      const discoverReels = vi.fn()
      await expectFatal(
        {
          profiles: {
            listActors: vi.fn(),
            loadActorProfile: vi.fn().mockRejectedValue(new FatalRunError('unknown-actor', 'no profile for "nadie"')),
          },
          instagram: { discoverReels, hydrateReel: vi.fn(), downloadVideo: vi.fn() },
        },
        'unknown-actor',
      )
      expect(discoverReels).not.toHaveBeenCalled()
    })

    it('a 403 aborts with ig-session-expired (7.3)', async () => {
      const hydrateReel = vi.fn()
      await expectFatal(
        {
          instagram: {
            discoverReels: vi.fn().mockRejectedValue(new FatalRunError('ig-session-expired', 'rotate')),
            hydrateReel,
            downloadVideo: vi.fn(),
          },
        },
        'ig-session-expired',
      )
      expect(hydrateReel).not.toHaveBeenCalled()
    })

    it('an empty account aborts with account-not-found (1.5)', async () => {
      await expectFatal(
        {
          instagram: {
            discoverReels: vi.fn().mockRejectedValue(new FatalRunError('account-not-found', 'no reels')),
            hydrateReel: vi.fn(),
            downloadVideo: vi.fn(),
          },
        },
        'account-not-found',
      )
    })

    it('a missing precondition aborts before any adapter runs (7.2)', async () => {
      const discoverReels = vi.fn()
      await expectFatal(
        {
          env: { OPENROUTER_API_KEY: 'key' },
          instagram: { discoverReels, hydrateReel: vi.fn(), downloadVideo: vi.fn() },
        },
        'missing-ig-session',
      )
      expect(discoverReels).not.toHaveBeenCalled()
    })
  })
})

describe('concurrency (6.3)', () => {
  it('exports the limit as a named constant', () => {
    expect(MAX_REEL_CONCURRENCY).toBe(3)
  })

  it('keeps at most three reels in flight and drops none', async () => {
    // Seven reels with top: 7 — with the default top: 3 only three are ever
    // selected, so this test would pass with no cap at all.
    const reels = Array.from({ length: 7 }, (_, i) => reel(`r${i}`, 100 - i))
    let active = 0
    let entered = 0
    let peak = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const { complete } = smartComplete()
    const { deps } = makeDeps(
      {
        completion: { complete },
        instagram: {
          discoverReels: vi.fn().mockResolvedValue(reels),
          hydrateReel: vi.fn(async () => {
            entered++
            active++
            peak = Math.max(peak, active)
            await gate
            active--
            return { caption: 'c', videoUrl: 'u', durationSeconds: 1 }
          }),
          downloadVideo: vi.fn().mockResolvedValue(undefined),
        },
      },
      reels,
    )

    const running = runGenerateScripts({ ...input, top: 7 }, deps)

    // Flush ticks until three reels are in flight, then a few more so a missing
    // cap gets the chance to start a fourth. No fixed sleeps.
    for (let i = 0; i < 200 && entered < MAX_REEL_CONCURRENCY; i++) {
      await new Promise((r) => setTimeout(r, 0))
    }
    for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 0))

    expect(entered).toBe(MAX_REEL_CONCURRENCY)
    expect(peak).toBe(MAX_REEL_CONCURRENCY)

    release()
    const result = await running

    // Throttled, not dropped.
    expect(result.reels).toHaveLength(7)
    expect(result.reels.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(result.reels.every((r) => r.status === 'ok')).toBe(true)
    expect(peak).toBe(MAX_REEL_CONCURRENCY)
  })
})
