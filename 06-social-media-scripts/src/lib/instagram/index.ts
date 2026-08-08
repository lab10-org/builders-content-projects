import { mkdir, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream/promises'
import { igApi } from 'insta-fetcher'
import { FatalRunError } from '../preflight'

// This module is the ONLY place that understands insta-fetcher's raw api/v1
// payload shape. Everything downstream sees DiscoveredReel / HydratedReel.

export interface DiscoveredReel {
  shortcode: string
  mediaId: string
  views: number
  likes: number
  comments: number
  thumbnailUrl: string
  /** ISO 8601. */
  takenAt: string
}

export interface HydratedReel {
  caption: string
  videoUrl: string
  durationSeconds: number
}

export interface InstagramClient {
  /** Returns reels most-recent-first, at most `scan` of them. */
  discoverReels(account: string, scan: number): Promise<DiscoveredReel[]>
  hydrateReel(mediaId: string): Promise<HydratedReel>
  downloadVideo(videoUrl: string, destPath: string): Promise<void>
}

/** An HTTP failure carrying its numeric status, so T7's policy never has to
 *  parse a message to classify it. */
export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpStatusError'
  }
}

export interface InstagramClientOptions {
  sessionId: string
  retry?: { attempts: number; baseDelayMs: number }
}

/**
 * Test seam. Not in the design's published one-argument factory: the fake api
 * has to be injectable for the suite to run with no network and no
 * IG_SESSIONID. `sleep` is unused here and wired up by T7's retry policy — the
 * shape is fixed once so the signature does not change again.
 */
export interface InstagramDeps {
  api?: Pick<igApi, 'fetchUserReel' | 'fetchPostByMediaId'>
  fetch?: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
}

interface RawCandidate {
  url?: string
}

interface RawMedia {
  pk?: string | number
  code?: string
  taken_at?: number
  play_count?: number
  like_count?: number
  comment_count?: number
  image_versions2?: { candidates?: RawCandidate[] }
}

interface RawListing {
  xdt_api__v1__clips__user__connection_v2?: {
    edges?: Array<{ node?: { media?: RawMedia } }>
  }
}

interface RawPost {
  items?: Array<{
    caption?: { text?: string } | null
    video_duration?: number
    video_versions?: Array<{ url?: string }>
  }>
}

const DEFAULT_RETRY = { attempts: 3, baseDelayMs: 500 }

/**
 * Classification order: axios' `response.status` first (insta-fetcher hands the
 * rejection straight through and sets no `validateStatus`, so a non-2xx is an
 * AxiosError), then our own `HttpStatusError.status`, then a last-resort `403`
 * match on the message. `downloadVideo` attaches the numeric status itself, so
 * message parsing is a fallback, never the primary path.
 */
const statusOf = (error: unknown): number | undefined => {
  const e = error as {
    response?: { status?: unknown }
    status?: unknown
    message?: unknown
  }
  if (typeof e?.response?.status === 'number') return e.response.status
  if (typeof e?.status === 'number') return e.status
  if (typeof e?.message === 'string' && /\b403\b/.test(e.message)) return 403
  return undefined
}

/**
 * Only 5xx and network-level failures are worth retrying. A plain Error raised
 * by our own mapping (e.g. "no video URL") carries neither a status nor a
 * syscall `code`, so it surfaces on the first attempt instead of paying the
 * full backoff three times.
 */
const isTransient = (error: unknown, status: number | undefined): boolean => {
  if (status !== undefined) return status >= 500
  return typeof (error as { code?: unknown })?.code === 'string'
}

const sessionExpired = () =>
  new FatalRunError(
    'ig-session-expired',
    'Instagram rejected the request with HTTP 403 — the session cookie has expired. Rotate IG_SESSIONID with a fresh cookie from a disposable account.',
  )

const accountNotFound = (account: string) =>
  new FatalRunError(
    'account-not-found',
    `No reels were found for "${account}". The account may not exist, may be private, or may have no reels.`,
  )

/** An api rejection that reads as "this account does not exist". */
const readsAsNotFound = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 404) return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /not\s*found/i.test(message)
}

const toDiscoveredReel = (media: RawMedia): DiscoveredReel => ({
  shortcode: String(media.code ?? ''),
  mediaId: String(media.pk ?? ''),
  // play_count, not view_count: this payload returns view_count: null.
  views: media.play_count ?? 0,
  likes: media.like_count ?? 0,
  comments: media.comment_count ?? 0,
  // Always a string — the UI renders it directly.
  thumbnailUrl: media.image_versions2?.candidates?.[0]?.url ?? '',
  takenAt: new Date((media.taken_at ?? 0) * 1000).toISOString(),
})

export function createInstagramClient(
  options: InstagramClientOptions,
  deps: InstagramDeps = {},
): InstagramClient {
  // insta-fetcher refuses anonymous access; this cookie format is the one the
  // benchmark proved works.
  const api = deps.api ?? new igApi(`sessionid=${options.sessionId};`)
  const doFetch = deps.fetch ?? globalThis.fetch
  const retry = options.retry ?? DEFAULT_RETRY
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  // One policy for every method: a FatalRunError escapes untouched, a 403
  // aborts the run immediately (7.3), a 5xx or network failure is retried with
  // exponential backoff (6.4), and anything else surfaces on the first attempt.
  async function withPolicy<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn()
      } catch (error) {
        if (error instanceof FatalRunError) throw error

        const status = statusOf(error)
        if (status === 403) throw sessionExpired()
        if (!isTransient(error, status) || attempt >= retry.attempts) throw error

        await sleep(retry.baseDelayMs * 2 ** (attempt - 1))
      }
    }
  }

  return {
    discoverReels: (account, scan) => withPolicy(() => discoverReels(account, scan)),
    hydrateReel: (mediaId) => withPolicy(() => hydrateReel(mediaId)),
    downloadVideo: (videoUrl, destPath) => withPolicy(() => downloadVideo(videoUrl, destPath)),
  }

  async function discoverReels(account: string, scan: number): Promise<DiscoveredReel[]> {
    let listing: RawListing | undefined
    try {
      listing = (await api.fetchUserReel(account, null, scan)) as RawListing | undefined
    } catch (error) {
      if (readsAsNotFound(error)) throw accountNotFound(account)
      throw error
    }

    const edges = listing?.xdt_api__v1__clips__user__connection_v2?.edges ?? []
    if (edges.length === 0) throw accountNotFound(account)

    return edges.slice(0, scan).map((edge) => toDiscoveredReel(edge.node?.media ?? {}))
  }

  async function hydrateReel(mediaId: string): Promise<HydratedReel> {
    const post = (await api.fetchPostByMediaId(mediaId)) as RawPost | undefined
    const item = post?.items?.[0]
    const videoUrl = item?.video_versions?.[0]?.url

    // A plain Error, not a FatalRunError: a reel we cannot download is one
    // reel's failure, never the whole run's.
    if (!videoUrl) {
      throw new Error(`No video URL on media ${mediaId} — the post may not be a video.`)
    }

    return {
      caption: item?.caption?.text ?? '',
      videoUrl,
      durationSeconds: item?.video_duration ?? 0,
    }
  }

  async function downloadVideo(videoUrl: string, destPath: string): Promise<void> {
    const response = await doFetch(videoUrl)

    // Check before touching the filesystem, so a failed download never leaves
    // a file behind. The status rides on the error so T7's policy can
    // classify it without parsing the message.
    if (!response.ok || !response.body) {
      throw new HttpStatusError(response.status, `video not available (${response.status})`)
    }

    await mkdir(dirname(destPath), { recursive: true })
    try {
      // 'w' truncates, so a partial body from a retried attempt is never
      // left prepended. The cast bridges the DOM ReadableStream on
      // `Response.body` and the node:stream/web one `fromWeb` expects — the
      // same object, two competing lib declarations.
      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
        createWriteStream(destPath, { flags: 'w' }),
      )
    } catch (error) {
      await rm(destPath, { force: true })
      throw error
    }
  }
}
