import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../../lib/preflight'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { download } from './download'
import { hydrate } from './hydrate'

const pending: ReelState = {
  status: 'pending',
  rank: 1,
  shortcode: 'DAaaa',
  mediaId: '123',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 10, likes: 2, comments: 1 },
}

const failed: ReelState = {
  status: 'failed',
  failedStep: 'hydrate',
  reason: 'earlier boom',
  rank: 1,
  shortcode: 'DAaaa',
  thumbnailUrl: '',
  metrics: { views: 10, likes: 2, comments: 1 },
}

const hydrated = {
  caption: 'a caption',
  videoUrl: 'https://cdn/video.mp4',
  durationSeconds: 32.45,
}

const depsWith = (instagram: Partial<RunDeps['instagram']>): RunDeps =>
  ({ instagram, tmpDir: '/tmp/run-xyz' }) as unknown as RunDeps

describe('hydrate', () => {
  it('extends the state with caption, videoUrl and duration (2.1)', async () => {
    const hydrateReel = vi.fn().mockResolvedValue(hydrated)

    const next = await hydrate(pending, depsWith({ hydrateReel }))

    expect(hydrateReel).toHaveBeenCalledTimes(1)
    expect(hydrateReel).toHaveBeenCalledWith('123')
    expect(next).toEqual({ ...pending, ...hydrated })
  })

  it('fails only this reel when the client rejects (6.1)', async () => {
    const downloadVideo = vi.fn()
    const next = await hydrate(
      pending,
      depsWith({ hydrateReel: vi.fn().mockRejectedValue(new Error('no video URL')), downloadVideo }),
    )

    expect(next).toMatchObject({ status: 'failed', failedStep: 'hydrate' })
    expect((next as { reason: string }).reason).toContain('no video URL')
    expect(downloadVideo).not.toHaveBeenCalled()
  })

  it('passes an already-failed reel through without calling the client', async () => {
    const hydrateReel = vi.fn()

    await expect(hydrate(failed, depsWith({ hydrateReel }))).resolves.toEqual(failed)
    expect(hydrateReel).not.toHaveBeenCalled()
  })

  it('lets a FatalRunError propagate instead of failing the reel', async () => {
    const fatal = new FatalRunError('ig-session-expired', 'rotate')

    await expect(
      hydrate(pending, depsWith({ hydrateReel: vi.fn().mockRejectedValue(fatal) })),
    ).rejects.toBe(fatal)
  })
})

describe('download', () => {
  const ready: ReelState = { ...pending, ...hydrated }

  it('writes into the run-scoped temp directory and records the path (2.2)', async () => {
    const downloadVideo = vi.fn().mockResolvedValue(undefined)

    const next = await download(ready, depsWith({ downloadVideo }))

    const expectedPath = join('/tmp/run-xyz', 'DAaaa.mp4')
    // The tmpDir comes from the run state, not recomputed in the step, so T18
    // deletes the file that was actually written.
    expect(downloadVideo).toHaveBeenCalledWith('https://cdn/video.mp4', expectedPath)
    expect(next).toEqual({ ...ready, videoPath: expectedPath })
  })

  it('fails this reel on a 404, matching the design Scenario B wording', async () => {
    const next = await download(
      ready,
      depsWith({ downloadVideo: vi.fn().mockRejectedValue(new Error('video not available (404)')) }),
    )

    expect(next).toMatchObject({ status: 'failed', failedStep: 'download' })
    expect((next as { reason: string }).reason).toContain('404')
  })

  it('passes an already-failed reel through without calling the client', async () => {
    const downloadVideo = vi.fn()

    await expect(download(failed, depsWith({ downloadVideo }))).resolves.toEqual(failed)
    expect(downloadVideo).not.toHaveBeenCalled()
  })
})
