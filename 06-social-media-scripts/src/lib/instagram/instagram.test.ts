import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../preflight'
import { createInstagramClient } from './index'
import listing from './__fixtures__/clips-listing.json'
import post from './__fixtures__/post-by-media-id.json'

// Deep clone so a mutation in one case can never leak into another.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const clientWith = (fetchUserReel: unknown) =>
  createInstagramClient({ sessionId: 'cookie' }, { api: { fetchUserReel } as never })

const resolving = (payload: unknown) => vi.fn().mockResolvedValue(payload)

// One seam, two collaborators: the same deps object carries the fake api and
// the fake fetch, so T5's and T6's tests inject the same way.
const clientForPost = (fetchPostByMediaId: unknown) =>
  createInstagramClient({ sessionId: 'cookie' }, { api: { fetchPostByMediaId } as never })

// `Uint8Array<ArrayBuffer>`, not the default `Uint8Array<ArrayBufferLike>`:
// BodyInit rejects the latter because it could be backed by a SharedArrayBuffer.
const okResponse = (bytes: Uint8Array<ArrayBuffer>) => new Response(bytes, { status: 200 })

describe('discoverReels', () => {
  it('maps the clips listing into DiscoveredReel (1.1)', async () => {
    const reels = await clientWith(resolving(clone(listing))).discoverReels('nasa', 20)

    expect(reels).toHaveLength(3)
    expect(reels[0]).toEqual({
      shortcode: 'DAaaaaaaaa1',
      mediaId: '3501000000000000001',
      // play_count, NOT view_count — this payload returns view_count: null.
      views: 6900000,
      likes: 412000,
      comments: 1820,
      thumbnailUrl: 'https://cdn.example/thumb-1-hi.jpg',
      takenAt: new Date(1754400000 * 1000).toISOString(),
    })
  })

  it('preserves listing order and never sorts', async () => {
    // rankReels relies on this most-recent-first contract for its stable
    // tie-break (T4, criterion 1.3).
    const reels = await clientWith(resolving(clone(listing))).discoverReels('nasa', 20)

    expect(reels.map((r) => r.shortcode)).toEqual([
      'DAaaaaaaaa1',
      'DAaaaaaaaa2',
      'DAaaaaaaaa3',
    ])
  })

  it('falls back to an empty thumbnail rather than undefined', async () => {
    const reels = await clientWith(resolving(clone(listing))).discoverReels('nasa', 20)

    // T29 renders this; it must be a string.
    expect(reels[2].thumbnailUrl).toBe('')
  })

  it('asks the api for the account and the scan limit', async () => {
    const api = resolving(clone(listing))

    await clientWith(api).discoverReels('nasa', 20)

    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('nasa', null, 20)
  })

  it('returns at most `scan` reels (1.1)', async () => {
    const reels = await clientWith(resolving(clone(listing))).discoverReels('nasa', 2)

    expect(reels.map((r) => r.shortcode)).toEqual(['DAaaaaaaaa1', 'DAaaaaaaaa2'])
  })

  describe('account-not-found (1.5)', () => {
    const expectAccountNotFound = async (fetchUserReel: unknown) => {
      const error = await clientWith(fetchUserReel).discoverReels('ghost', 20).catch((e) => e)
      expect(error).toBeInstanceOf(FatalRunError)
      expect(error.code).toBe('account-not-found')
      expect(error.message).toContain('ghost')
      return error
    }

    it('rejects when the listing has no edges', async () => {
      // The real `anthropicai` case in the benchmark's reliability results.
      const empty = clone(listing)
      empty.xdt_api__v1__clips__user__connection_v2.edges = []

      const error = await expectAccountNotFound(resolving(empty))
      expect(error.message).toMatch(/no reels/i)
    })

    it('rejects when the connection key is absent, instead of a TypeError', async () => {
      // The api resolves undefined when the graphql response is unusable.
      await expectAccountNotFound(resolving({}))
      await expectAccountNotFound(resolving(undefined))
    })

    it('rejects when the api reports the user was not found', async () => {
      await expectAccountNotFound(vi.fn().mockRejectedValue(new Error('User not found')))
      await expectAccountNotFound(
        vi.fn().mockRejectedValue(Object.assign(new Error('Request failed'), {
          response: { status: 404 },
        })),
      )
    })
  })
})

describe('hydrateReel', () => {
  it('maps the post payload to caption, video URL and duration (2.1)', async () => {
    const api = resolving(clone(post))

    const hydrated = await clientForPost(api).hydrateReel('3501000000000000001')

    expect(api).toHaveBeenCalledWith('3501000000000000001')
    expect(hydrated).toEqual({
      caption: 'The Webb telescope just sent back something nobody expected.',
      videoUrl: 'https://cdn.example/video-1-hi.mp4',
      durationSeconds: 32.45,
    })
  })

  it('defaults a missing caption and duration rather than leaking undefined', async () => {
    // HydratedReel is typed all-required; no undefined may reach the pipeline.
    const bare = clone(post)
    delete (bare.items[0] as Record<string, unknown>).caption
    delete (bare.items[0] as Record<string, unknown>).video_duration

    const hydrated = await clientForPost(resolving(bare)).hydrateReel('1')

    expect(hydrated.caption).toBe('')
    expect(hydrated.durationSeconds).toBe(0)
  })

  it.each([
    ['no items', { items: [] }],
    ['no video_versions', { items: [{ caption: { text: 'x' } }] }],
  ])('rejects with a plain Error when the payload has %s', async (_label, payload) => {
    // Plain Error, NOT FatalRunError: this becomes one reel's failure, not the
    // whole run's.
    const error = await clientForPost(resolving(payload)).hydrateReel('1').catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(FatalRunError)
    expect(error.message).toMatch(/video url/i)
  })
})

describe('downloadVideo', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ig-download-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const clientForDownload = (fetch: unknown) =>
    createInstagramClient({ sessionId: 'cookie' }, { api: {} as never, fetch: fetch as never })

  it('writes exactly the response bytes to destPath (2.2)', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 251])
    const dest = join(dir, 'clip.mp4')

    await clientForDownload(vi.fn().mockResolvedValue(okResponse(bytes))).downloadVideo(
      'https://cdn.example/video.mp4',
      dest,
    )

    expect(new Uint8Array(await readFile(dest))).toEqual(bytes)
  })

  it('creates missing parent directories', async () => {
    // T14 downloads into tmp/<runId>/<shortcode>.mp4.
    const dest = join(dir, 'runs', 'run-1', 'clip.mp4')

    await clientForDownload(
      vi.fn().mockResolvedValue(okResponse(new Uint8Array([9]))),
    ).downloadVideo('https://cdn.example/video.mp4', dest)

    expect(new Uint8Array(await readFile(dest))).toEqual(new Uint8Array([9]))
  })

  it('rejects on 404 with the design wording and leaves no file behind', async () => {
    const dest = join(dir, 'missing.mp4')
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }))

    const error = await clientForDownload(fetch)
      .downloadVideo('https://cdn.example/gone.mp4', dest)
      .catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(FatalRunError)
    // T14 surfaces this verbatim as the reel's failure reason.
    expect(error.message).toBe('video not available (404)')
    expect(existsSync(dest)).toBe(false)
  })
})
