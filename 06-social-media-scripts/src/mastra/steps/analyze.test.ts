import { describe, expect, it, vi } from 'vitest'
import { MODELS } from '../../lib/models'
import { SchemaValidationError } from '../../lib/openrouter'
import { reelAnalysisSchema } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { analyze } from './analyze'

const analysis = { objective: 'reframe', highlights: ['a', 'b'], targetAudience: 'builders' }

const ready: ReelState = {
  status: 'pending',
  rank: 3,
  shortcode: 'DAccc',
  mediaId: '9',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 5, likes: 1, comments: 0 },
  caption: 'THE-CAPTION-MARKER',
  transcript: 'THE-TRANSCRIPT-MARKER',
}

const failedEarlier: ReelState = {
  status: 'failed',
  failedStep: 'transcribe',
  reason: 'provider timeout',
  rank: 3,
  shortcode: 'DAccc',
  thumbnailUrl: '',
  metrics: { views: 5, likes: 1, comments: 0 },
}

const deps = (complete: unknown): RunDeps =>
  ({ completion: { complete } }) as unknown as RunDeps

describe('analyze', () => {
  it('asks the completion client once, with the analysis model, schema and prompt (3.1)', async () => {
    const complete = vi.fn().mockResolvedValue(analysis)

    await analyze(ready, deps(complete))

    // Going through `complete` — rather than a bare generation call — is what
    // keeps T10's single retry (3.3) in force for the analysis path.
    expect(complete).toHaveBeenCalledTimes(1)
    const [args] = complete.mock.calls[0]
    expect(args.model).toBe(MODELS.analysis)
    expect(args.schema).toBe(reelAnalysisSchema)
    expect(args.prompt).toContain('THE-TRANSCRIPT-MARKER')
    expect(args.prompt).toContain('THE-CAPTION-MARKER')
  })

  it('stores the analysis while the rest of the state survives', async () => {
    const next = await analyze(ready, deps(vi.fn().mockResolvedValue(analysis)))

    expect(next).toMatchObject({
      status: 'pending',
      analysis,
      transcript: 'THE-TRANSCRIPT-MARKER',
      caption: 'THE-CAPTION-MARKER',
      rank: 3,
      shortcode: 'DAccc',
      thumbnailUrl: 'https://cdn/t.jpg',
      metrics: { views: 5, likes: 1, comments: 0 },
    })
  })

  it('maps the client giving up to the fixed reason (3.4, 6.1)', async () => {
    const complete = vi.fn().mockRejectedValue(new SchemaValidationError(MODELS.analysis))

    const next = await analyze(ready, deps(complete))

    expect(next).toMatchObject({
      status: 'failed',
      failedStep: 'analyze',
      reason: 'invalid analysis response',
    })
  })

  it('keeps a transport error message instead of the fixed string (6.1)', async () => {
    const next = await analyze(ready, deps(vi.fn().mockRejectedValue(new Error('socket hang up'))))

    expect(next).toMatchObject({ status: 'failed', failedStep: 'analyze' })
    expect((next as { reason: string }).reason).toContain('socket hang up')
  })

  it('passes an already-failed reel through without calling the client', async () => {
    const complete = vi.fn()

    await expect(analyze(failedEarlier, deps(complete))).resolves.toEqual(failedEarlier)
    expect(complete).not.toHaveBeenCalled()
  })
})
