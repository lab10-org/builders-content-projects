import { describe, expect, it } from 'vitest'
import type { FatalCode, ReelBase, RunResult } from '../../../src/lib/types'
import { type RunSnapshot, toRunView } from './run-view'

const input = { account: 'morningbrew', actor: 'juanse' }
const runId = 'run_1'

const ranked: ReelBase[] = [
  { rank: 1, shortcode: 'r1', thumbnailUrl: 't1', metrics: { views: 30, likes: 3, comments: 1 } },
  { rank: 2, shortcode: 'r2', thumbnailUrl: 't2', metrics: { views: 20, likes: 2, comments: 1 } },
  { rank: 3, shortcode: 'r3', thumbnailUrl: 't3', metrics: { views: 10, likes: 1, comments: 0 } },
]

const analysis = { objective: 'o', highlights: ['h'], targetAudience: 't' }
const script = { hook: 'h', body: 'b', closing: 'c' }

const view = (snapshot: RunSnapshot, progress = {}) =>
  toRunView({ runId, input, snapshot, progress })

describe('a run in flight (5.3)', () => {
  it('reports the step currently executing for each reel', () => {
    const result = view({ status: 'running', ranked }, { r2: 'transcribe' })

    expect(result).toMatchObject({ runId, account: 'morningbrew', actor: 'juanse', status: 'running' })
    expect(result.reels[1]).toEqual({
      rank: 2,
      shortcode: 'r2',
      thumbnailUrl: 't2',
      metrics: { views: 20, likes: 2, comments: 1 },
      status: 'pending',
      currentStep: 'transcribe',
    })
  })

  it('shows every selected reel, defaulting to hydrate before anything reports', () => {
    const result = view({ status: 'running', ranked })

    expect(result.reels).toHaveLength(3)
    expect(result.reels.every((r) => r.status === 'pending')).toBe(true)
    expect(result.reels.map((r) => (r as { currentStep: string }).currentStep)).toEqual([
      'hydrate',
      'hydrate',
      'hydrate',
    ])
  })

  it('handles the first poll, before rank has produced anything', () => {
    const result = view({ status: 'running' })

    expect(result).toMatchObject({ status: 'running', reels: [] })
    expect(result.error).toBeUndefined()
  })
})

describe('a completed run (5.4, 5.6)', () => {
  const result: RunResult = {
    account: 'morningbrew',
    actor: 'juanse',
    generatedAt: '2026-08-06T12:00:00.000Z',
    reels: [
      { ...ranked[2], status: 'failed', failedStep: 'download', reason: 'video not available (404)' },
      { ...ranked[0], status: 'ok', analysis, script },
      { ...ranked[1], status: 'ok', analysis, script },
    ],
  }

  it('orders by rank and carries analysis and script', () => {
    // Progress still holds a step for these reels; none may stay pending.
    const mapped = view({ status: 'completed', result }, { r1: 'analyze' })

    expect(mapped.status).toBe('completed')
    expect(mapped.reels.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(mapped.reels[0]).toMatchObject({ status: 'ok', analysis, script })
    expect(mapped.reels.some((r) => r.status === 'pending')).toBe(false)
  })

  it('carries the failure reason and no analysis or script for a failed reel', () => {
    const mapped = view({ status: 'completed', result })

    expect(mapped.reels[2]).toMatchObject({
      status: 'failed',
      failedStep: 'download',
      reason: 'video not available (404)',
    })
    expect(mapped.reels[2]).not.toHaveProperty('analysis')
    expect(mapped.reels[2]).not.toHaveProperty('script')
  })
})

describe('an aborted run', () => {
  const cases: Array<[FatalCode, string, RegExp]> = [
    ['account-not-found', 'No reels were found for "ghost".', /ghost/],
    ['unknown-actor', 'No profile for actor "nadie".', /nadie/],
    ['missing-ig-session', 'IG_SESSIONID is not set.', /IG_SESSIONID/],
    ['ig-session-expired', 'Rotate IG_SESSIONID with a fresh cookie.', /rotate/i],
  ]

  it.each(cases)('maps %s onto status aborted with its operator-facing message', (code, message, matcher) => {
    const mapped = view({ status: 'failed', error: { code, message } })

    expect(mapped.status).toBe('aborted')
    expect(mapped.error).toEqual({ code, message })
    expect(mapped.error?.message).toMatch(matcher)
    expect(mapped.reels).toEqual([])
  })

  it('still aborts on an unexpected crash, so the page stops polling', () => {
    const mapped = view({ status: 'failed' })

    expect(mapped.status).toBe('aborted')
    expect(mapped.error?.code).toBe('unexpected-error')
    expect(mapped.error?.message).toBeTruthy()
  })

  it('keeps the invariant: error iff aborted', () => {
    expect(view({ status: 'running', ranked }).error).toBeUndefined()
    expect(view({ status: 'completed', result: { account: 'a', actor: 'b', generatedAt: 'g', reels: [] } }).error).toBeUndefined()
    expect(view({ status: 'failed', error: { code: 'unknown-actor', message: 'm' } }).error).toBeDefined()
  })
})

describe('purity', () => {
  it('returns equal values and mutates nothing', () => {
    const snapshot: RunSnapshot = { status: 'running', ranked }
    const progress = { r2: 'analyze' as const }
    const snapshotCopy = structuredClone(snapshot)
    const progressCopy = structuredClone(progress)

    expect(view(snapshot, progress)).toEqual(view(snapshot, progress))
    expect(snapshot).toEqual(snapshotCopy)
    expect(progress).toEqual(progressCopy)
  })
})
