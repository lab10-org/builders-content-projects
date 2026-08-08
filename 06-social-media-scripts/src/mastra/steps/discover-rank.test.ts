import { describe, expect, it, vi } from 'vitest'
import type { DiscoveredReel } from '../../lib/instagram'
import { FatalRunError } from '../../lib/preflight'
import type { RunDeps } from '../deps'
import { discover, rank } from './discover-rank'

const reel = (shortcode: string, views: number, mediaId = shortcode): DiscoveredReel => ({
  shortcode,
  mediaId,
  views,
  likes: views / 10,
  comments: views / 100,
  thumbnailUrl: `https://cdn/${shortcode}.jpg`,
  takenAt: '2026-08-01T00:00:00.000Z',
})

const profile = { name: 'juanse', markdown: '# juanse\n' }
const runState = { account: 'nasa', actor: 'juanse', scan: 50, top: 2, profile }

const deps = (discoverReels: unknown): RunDeps =>
  ({ instagram: { discoverReels } }) as unknown as RunDeps

describe('discover', () => {
  it('asks the client for the run input account and scan window (1.1)', async () => {
    // scan: 50, not 20 — a hard-coded scan window fails here. Defaults are
    // applied where the run is started (T25), not in the step.
    const discoverReels = vi.fn().mockResolvedValue([reel('a', 10)])

    await discover(runState, deps(discoverReels))

    expect(discoverReels).toHaveBeenCalledWith('nasa', 50)
  })

  it('keeps the order the client returned', async () => {
    // Most-recent-first is the adapter's contract (T5); re-sorting here would
    // break the tie-break in 1.3 end to end.
    const reels = [reel('c', 5), reel('a', 99), reel('b', 5)]
    const state = await discover(runState, deps(vi.fn().mockResolvedValue(reels)))

    expect(state.reels.map((r) => r.shortcode)).toEqual(['c', 'a', 'b'])
  })

  it('lets a FatalRunError abort the run (1.5)', async () => {
    // A run-level step, deliberately NOT wrapped in withReelFailure.
    const fatal = new FatalRunError('account-not-found', 'no reels for "ghost"')

    await expect(discover(runState, deps(vi.fn().mockRejectedValue(fatal)))).rejects.toBe(fatal)
  })
})

describe('rank', () => {
  const five = [reel('a', 10), reel('b', 50), reel('c', 30), reel('d', 20), reel('e', 40)]

  it('selects and ranks the top reels (1.2, 1.6)', async () => {
    const state = await rank({ ...runState, reels: five }, {} as RunDeps)

    expect(state.ranked.map((r) => [r.shortcode, r.rank])).toEqual([
      ['b', 1],
      ['e', 2],
    ])
  })

  it('produces ReelBase plus the mediaId hydrate needs', async () => {
    const state = await rank({ ...runState, reels: [reel('a', 10, 'MEDIA-1')] }, {} as RunDeps)

    expect(state.ranked[0]).toEqual({
      rank: 1,
      shortcode: 'a',
      mediaId: 'MEDIA-1',
      thumbnailUrl: 'https://cdn/a.jpg',
      metrics: { views: 10, likes: 1, comments: 0.1 },
    })
  })

  it('preserves arrival order on ties (1.3)', async () => {
    const tied = [reel('first', 50), reel('second', 50)]

    const state = await rank({ ...runState, reels: tied }, {} as RunDeps)

    expect(state.ranked.map((r) => r.shortcode)).toEqual(['first', 'second'])
  })

  it('returns every available reel when fewer exist than requested (1.4)', async () => {
    const state = await rank(
      { ...runState, top: 3, reels: [reel('a', 5), reel('b', 9)] },
      {} as RunDeps,
    )

    expect(state.ranked).toHaveLength(2)
  })
})
