import { describe, expect, it } from 'vitest'
import { rankReels } from './index'

// Plain fixtures: `views` plus other fields, so the generic contract is
// observable without depending on T2's types.
const reel = (shortcode: string, views: number) => ({
  shortcode,
  views,
  thumbnailUrl: `https://cdn/${shortcode}.jpg`,
})

describe('rankReels', () => {
  it('returns the highest-viewed reels, ranked from 1 (1.2, 1.6)', () => {
    const input = [reel('a', 10), reel('b', 50), reel('c', 30), reel('d', 20), reel('e', 40)]

    const ranked = rankReels(input, 3)

    expect(ranked.map((r) => [r.shortcode, r.rank])).toEqual([
      ['b', 1],
      ['e', 2],
      ['c', 3],
    ])
  })

  it('carries every other field through untouched (1.6)', () => {
    const [top] = rankReels([reel('a', 10)], 1)

    expect(top).toEqual({
      shortcode: 'a',
      views: 10,
      thumbnailUrl: 'https://cdn/a.jpg',
      rank: 1,
    })
  })

  it('preserves arrival order on ties (1.3)', () => {
    // Most-recent-first arrival, three tied in the middle, bracketed above and
    // below. Asserting all five by position fails a
    // sort-ascending-then-reverse() implementation, which flips the tied run.
    const input = [
      reel('high', 99),
      reel('tie-1', 50),
      reel('tie-2', 50),
      reel('tie-3', 50),
      reel('low', 1),
    ]

    expect(rankReels(input, 5).map((r) => r.shortcode)).toEqual([
      'high',
      'tie-1',
      'tie-2',
      'tie-3',
      'low',
    ])
  })

  it('returns every reel when fewer exist than requested (1.4)', () => {
    const ranked = rankReels([reel('a', 5), reel('b', 9)], 5)

    expect(ranked.map((r) => [r.shortcode, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
    ])
  })

  it.each([
    ['an empty input', [] as ReturnType<typeof reel>[], 3],
    ['top: 0', [reel('a', 5)], 0],
  ])('returns [] for %s', (_label, input, top) => {
    expect(rankReels(input, top)).toEqual([])
  })

  it('does not mutate or alias the input', () => {
    const input = [reel('a', 10), reel('b', 50)]
    const snapshot = input.map((r) => r.shortcode)

    const ranked = rankReels(input, 2)

    expect(input.map((r) => r.shortcode)).toEqual(snapshot)
    expect(ranked).not.toBe(input)
    expect(input[0]).not.toHaveProperty('rank')
  })
})
