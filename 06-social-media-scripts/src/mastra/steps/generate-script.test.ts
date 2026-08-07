import { describe, expect, it, vi } from 'vitest'
import { MODELS } from '../../lib/models'
import { SchemaValidationError } from '../../lib/openrouter'
import { reelScriptSchema } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { generateScript } from './generate-script'

const script = { hook: 'ojo con esto', body: 'porque', closing: 'probalo' }
const analysis = {
  objective: 'THE-OBJECTIVE-MARKER',
  highlights: ['HIGHLIGHT-MARKER-ONE', 'HIGHLIGHT-MARKER-TWO'],
  targetAudience: 'THE-AUDIENCE-MARKER',
}
const profile = { name: 'juanse', markdown: '# juanse\n\nPROFILE-MARKER-LINE-9f3\n' }

const ready: ReelState = {
  status: 'pending',
  rank: 1,
  shortcode: 'DAddd',
  mediaId: '7',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 99, likes: 9, comments: 3 },
  transcript: 't',
  analysis,
  profile,
}

const failedEarlier: ReelState = {
  status: 'failed',
  failedStep: 'transcribe',
  reason: 'provider timeout',
  rank: 1,
  shortcode: 'DAddd',
  thumbnailUrl: '',
  metrics: { views: 99, likes: 9, comments: 3 },
}

const deps = (complete: unknown): RunDeps =>
  ({ completion: { complete } }) as unknown as RunDeps

describe('generate-script', () => {
  it('asks once, with the generation model, script schema and a prompt carrying profile and analysis', async () => {
    const complete = vi.fn().mockResolvedValue(script)

    await generateScript(ready, deps(complete))

    // Exactly one call: the single retry lives in the completion client (T10)
    // and this step must not add a second (4.4).
    expect(complete).toHaveBeenCalledTimes(1)
    const [args] = complete.mock.calls[0]
    expect(args.model).toBe(MODELS.generation)
    expect(args.schema).toBe(reelScriptSchema)
    expect(args.prompt).toContain('PROFILE-MARKER-LINE-9f3') // 4.2
    expect(args.prompt).toContain('THE-OBJECTIVE-MARKER')
    expect(args.prompt).toContain('HIGHLIGHT-MARKER-ONE')
    expect(args.prompt).toContain('HIGHLIGHT-MARKER-TWO')
    expect(args.prompt).toContain('THE-AUDIENCE-MARKER')
    expect(args.prompt).toMatch(/spanish|español/i) // 4.6
  })

  it('reads the profile from the state, never from disk', async () => {
    // No profile loader is injected, so a filesystem read would throw.
    await expect(
      generateScript(ready, deps(vi.fn().mockResolvedValue(script))),
    ).resolves.toMatchObject({ status: 'ok' })
  })

  it('produces the ok outcome carrying analysis and script (4.1, 6.1)', async () => {
    const next = await generateScript(ready, deps(vi.fn().mockResolvedValue(script)))

    expect(next).toMatchObject({
      status: 'ok',
      analysis,
      script,
      rank: 1,
      shortcode: 'DAddd',
      thumbnailUrl: 'https://cdn/t.jpg',
      metrics: { views: 99, likes: 9, comments: 3 },
    })
  })

  it('maps the client giving up to the fixed reason (4.4, 6.1)', async () => {
    const next = await generateScript(
      ready,
      deps(vi.fn().mockRejectedValue(new SchemaValidationError(MODELS.generation))),
    )

    expect(next).toMatchObject({
      status: 'failed',
      failedStep: 'generate-script',
      reason: 'invalid script response',
      rank: 1,
      shortcode: 'DAddd',
    })
  })

  it('keeps a transport error message instead of the fixed string (6.1)', async () => {
    const next = await generateScript(
      ready,
      deps(vi.fn().mockRejectedValue(new Error('provider unavailable'))),
    )

    expect(next).toMatchObject({ status: 'failed', failedStep: 'generate-script' })
    expect((next as { reason: string }).reason).toContain('provider unavailable')
  })

  it('passes an already-failed reel through without calling the client', async () => {
    const complete = vi.fn()

    await expect(generateScript(failedEarlier, deps(complete))).resolves.toEqual(failedEarlier)
    expect(complete).not.toHaveBeenCalled()
  })
})
