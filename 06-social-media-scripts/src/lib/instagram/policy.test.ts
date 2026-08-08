import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../preflight'
import { createInstagramClient } from './index'
import listing from './__fixtures__/clips-listing.json'
import post from './__fixtures__/post-by-media-id.json'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const axiosError = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  })

/** Records delays instead of waiting, so the suite spends no real time. */
const recordingSleep = () => {
  const delays: number[] = []
  return {
    delays,
    sleep: vi.fn(async (ms: number) => {
      delays.push(ms)
    }),
  }
}

const build = (deps: { api?: unknown; fetch?: unknown }, retry = { attempts: 3, baseDelayMs: 100 }) => {
  const { delays, sleep } = recordingSleep()
  const client = createInstagramClient(
    { sessionId: 'cookie', retry },
    { api: (deps.api ?? {}) as never, fetch: deps.fetch as never, sleep },
  )
  return { client, delays, sleep }
}

describe('transient failures are retried with backoff (6.4)', () => {
  it('recovers when a 5xx clears before the attempts run out', async () => {
    const fetchUserReel = vi
      .fn()
      .mockRejectedValueOnce(axiosError(500))
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValue(clone(listing))
    const { client } = build({ api: { fetchUserReel } })

    await expect(client.discoverReels('nasa', 20)).resolves.toHaveLength(3)
    expect(fetchUserReel).toHaveBeenCalledTimes(3)
  })

  it('backs off exponentially rather than on a fixed delay', async () => {
    const fetchUserReel = vi
      .fn()
      .mockRejectedValueOnce(axiosError(500))
      .mockRejectedValueOnce(axiosError(500))
      .mockResolvedValue(clone(listing))
    const { client, delays } = build({ api: { fetchUserReel } })

    await client.discoverReels('nasa', 20)

    expect(delays).toEqual([100, 200])
  })

  it('gives up after exactly `attempts` calls, preserving the message', async () => {
    const fetchUserReel = vi.fn().mockRejectedValue(axiosError(500))
    const { client } = build({ api: { fetchUserReel } })

    const error = await client.discoverReels('nasa', 20).catch((e) => e)

    expect(fetchUserReel).toHaveBeenCalledTimes(3)
    expect(error.message).toContain('500')
    expect(error).not.toBeInstanceOf(FatalRunError)
  })

  it('retries a network-level rejection that carries no response', async () => {
    const econnreset = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
    const fetchUserReel = vi
      .fn()
      .mockRejectedValueOnce(econnreset)
      .mockResolvedValue(clone(listing))
    const { client } = build({ api: { fetchUserReel } })

    await expect(client.discoverReels('nasa', 20)).resolves.toHaveLength(3)
    expect(fetchUserReel).toHaveBeenCalledTimes(2)
  })
})

describe('a 403 is fatal immediately (7.3)', () => {
  const expectSessionExpired = (error: unknown) => {
    expect(error).toBeInstanceOf(FatalRunError)
    expect((error as FatalRunError).code).toBe('ig-session-expired')
    expect((error as Error).message).toMatch(/rotate/i)
    expect((error as Error).message).toMatch(/session/i)
  }

  it('aborts discoverReels after a single call, without sleeping', async () => {
    const fetchUserReel = vi.fn().mockRejectedValue(axiosError(403))
    const { client, sleep } = build({ api: { fetchUserReel } })

    expectSessionExpired(await client.discoverReels('nasa', 20).catch((e) => e))
    expect(fetchUserReel).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('applies to hydrateReel too — the rule belongs to the client', async () => {
    const fetchPostByMediaId = vi.fn().mockRejectedValue(axiosError(403))
    const { client } = build({ api: { fetchPostByMediaId } })

    expectSessionExpired(await client.hydrateReel('1').catch((e) => e))
    expect(fetchPostByMediaId).toHaveBeenCalledTimes(1)
  })

  it('applies to downloadVideo, whose 403 arrives as a non-ok Response', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ig-policy-'))
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 403 }))
    const { client } = build({ fetch })

    expectSessionExpired(
      await client.downloadVideo('https://cdn.example/v.mp4', join(dir, 'v.mp4')).catch((e) => e),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    await rm(dir, { recursive: true, force: true })
  })
})

describe('non-transient failures surface on the first attempt', () => {
  it('does not retry a 404', async () => {
    // Only 5xx and network errors are transient; T5's account-not-found and
    // T6's missing-video mappings must not each pay three attempts.
    const fetchUserReel = vi.fn().mockRejectedValue(axiosError(404))
    const { client, sleep } = build({ api: { fetchUserReel } })

    const error = await client.discoverReels('ghost', 20).catch((e) => e)

    expect(fetchUserReel).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
    // T5 maps a 404 onto account-not-found; the policy must let that through.
    expect((error as FatalRunError).code).toBe('account-not-found')
  })

  it('lets a FatalRunError raised inside escape unretried and unwrapped', async () => {
    // T5's empty-listing -> account-not-found.
    const empty = clone(listing)
    empty.xdt_api__v1__clips__user__connection_v2.edges = []
    const fetchUserReel = vi.fn().mockResolvedValue(empty)
    const { client, sleep } = build({ api: { fetchUserReel } })

    const error = await client.discoverReels('ghost', 20).catch((e) => e)

    expect(error).toBeInstanceOf(FatalRunError)
    expect((error as FatalRunError).code).toBe('account-not-found')
    expect(fetchUserReel).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe('the happy path is unaffected', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ig-policy-ok-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('calls each method once and never sleeps', async () => {
    const { client, sleep } = build({
      api: {
        fetchUserReel: vi.fn().mockResolvedValue(clone(listing)),
        fetchPostByMediaId: vi.fn().mockResolvedValue(clone(post)),
      },
      fetch: vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 })),
    })

    await client.discoverReels('nasa', 20)
    await client.hydrateReel('1')
    await client.downloadVideo('https://cdn.example/v.mp4', join(dir, 'v.mp4'))

    expect(sleep).not.toHaveBeenCalled()
  })
})
