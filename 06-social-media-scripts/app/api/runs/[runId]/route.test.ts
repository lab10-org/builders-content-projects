import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReelBase, RunResult } from '../../../../src/lib/types'
import { type RunSnapshot, toRunView } from '../run-view'

const readRunRecord = vi.fn()
const read = vi.fn()

vi.mock('../../../../src/mastra', () => ({
  readRunRecord: (runId: string) => readRunRecord(runId),
  getProgressRecorder: () => ({ read }),
}))

const { GET } = await import('./route')

const call = (runId: string) =>
  GET(new Request(`http://localhost/api/runs/${runId}`), { params: Promise.resolve({ runId }) })

const input = { account: 'morningbrew', actor: 'juanse' }
const ranked: ReelBase[] = [
  { rank: 1, shortcode: 'r1', thumbnailUrl: 't1', metrics: { views: 30, likes: 3, comments: 1 } },
  { rank: 2, shortcode: 'r2', thumbnailUrl: 't2', metrics: { views: 20, likes: 2, comments: 0 } },
]

describe('GET /api/runs/[runId]', () => {
  beforeEach(() => {
    readRunRecord.mockReset()
    read.mockReset()
    read.mockReturnValue({})
  })

  it('shapes nothing itself — the body equals toRunView (5.3)', async () => {
    const snapshot: RunSnapshot = { status: 'running', ranked }
    const progress = { r2: 'transcribe' as const }
    readRunRecord.mockResolvedValue({ input, snapshot })
    read.mockReturnValue(progress)

    const response = await call('run_1')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(
      toRunView({ runId: 'run_1', input, snapshot, progress }),
    )
  })

  it('carries analysis, script and failure reasons for a completed run (5.4, 5.6)', async () => {
    const result: RunResult = {
      ...input,
      generatedAt: '2026-08-06T12:00:00.000Z',
      reels: [
        {
          ...ranked[0],
          status: 'ok',
          analysis: { objective: 'o', highlights: ['h'], targetAudience: 't' },
          script: { hook: 'h', body: 'b', closing: 'c' },
        },
        { ...ranked[1], status: 'failed', failedStep: 'download', reason: 'video not available (404)' },
      ],
    }
    readRunRecord.mockResolvedValue({ input, snapshot: { status: 'completed', result } })

    const body = await (await call('run_1')).json()

    expect(body.reels.map((r: { rank: number }) => r.rank)).toEqual([1, 2])
    expect(body.reels[0]).toMatchObject({ status: 'ok' })
    expect(body.reels[1]).toMatchObject({ failedStep: 'download', reason: 'video not available (404)' })
  })

  it('answers 200 for an aborted run — it is data, not a transport error', async () => {
    readRunRecord.mockResolvedValue({
      input,
      snapshot: { status: 'failed', error: { code: 'ig-session-expired', message: 'rotate it' } },
    })

    const response = await call('run_1')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'aborted',
      error: { code: 'ig-session-expired', message: 'rotate it' },
    })
  })

  it('echoes the runId from the URL', async () => {
    readRunRecord.mockResolvedValue({ input, snapshot: { status: 'running', ranked } })

    const body = await (await call('run_from_url')).json()

    expect(body.runId).toBe('run_from_url')
  })

  it.each(['unknown_run', '   '])('answers 404 for %p (5.7)', async (runId) => {
    readRunRecord.mockResolvedValue(null)

    const response = await call(runId)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'run not found' })
  })

  it('never caches, so polling always reads a fresh snapshot', async () => {
    readRunRecord.mockResolvedValue({ input, snapshot: { status: 'running', ranked } })

    const response = await call('run_1')

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
