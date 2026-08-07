import { describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../../lib/preflight'
import type { ReelState } from '../state'
import { withReelFailure } from './with-reel-failure'

const pending: ReelState = {
  status: 'pending',
  rank: 2,
  shortcode: 'DAaaa',
  mediaId: '123',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 10, likes: 2, comments: 1 },
}

describe('withReelFailure', () => {
  it('returns the function result when it resolves', async () => {
    const next = { ...pending, caption: 'hi' }
    const fn = vi.fn().mockResolvedValue(next)

    await expect(withReelFailure('hydrate', pending, fn)).resolves.toBe(next)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('turns a throw into a failed outcome labelled with the step (6.1)', async () => {
    const result = await withReelFailure('transcribe', pending, async () => {
      throw new Error('boom')
    })

    expect(result).toMatchObject({
      status: 'failed',
      failedStep: 'transcribe',
      // The reel's identity survives the failure — the UI still renders it.
      rank: 2,
      shortcode: 'DAaaa',
      thumbnailUrl: 'https://cdn/t.jpg',
      metrics: { views: 10, likes: 2, comments: 1 },
    })
    expect((result as { reason: string }).reason).toMatch(/boom/)
  })

  it('records a non-empty reason even when a non-Error is thrown', async () => {
    const result = await withReelFailure('analyze', pending, async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'just a string'
    })

    // 6.1's "recording the reason" must not degrade to undefined.
    expect((result as { reason: string }).reason).toBeTruthy()
    expect((result as { reason: string }).reason).toContain('just a string')
  })

  it('passes an already-failed reel through untouched, without calling fn', async () => {
    const failed: ReelState = {
      status: 'failed',
      failedStep: 'download',
      reason: 'video not available (404)',
      rank: 1,
      shortcode: 'DAbbb',
      thumbnailUrl: '',
      metrics: { views: 1, likes: 0, comments: 0 },
    }
    const fn = vi.fn()

    const result = await withReelFailure('extract-audio', failed, fn)

    expect(result).toEqual(failed)
    expect(fn).not.toHaveBeenCalled()
  })

  it('lets a FatalRunError escape rather than failing the reel', async () => {
    const fatal = new FatalRunError('ig-session-expired', 'rotate the cookie')

    await expect(
      withReelFailure('hydrate', pending, async () => {
        throw fatal
      }),
    ).rejects.toBe(fatal)
  })
})
