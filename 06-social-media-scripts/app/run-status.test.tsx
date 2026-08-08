// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunView } from '../src/lib/types'
import { POLL_INTERVAL_MS, RunStatus } from './run-status'

afterEach(cleanup)
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const base = { runId: 'run_1', account: 'morningbrew', actor: 'juanse' }

const running: RunView = {
  ...base,
  status: 'running',
  reels: [
    {
      rank: 1,
      shortcode: 'r1',
      thumbnailUrl: '',
      metrics: { views: 1, likes: 0, comments: 0 },
      status: 'pending',
      currentStep: 'transcribe',
    },
    {
      rank: 2,
      shortcode: 'r2',
      thumbnailUrl: '',
      metrics: { views: 1, likes: 0, comments: 0 },
      status: 'pending',
      currentStep: 'download',
    },
  ],
}

const tick = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
  })
}

const mount = async (fetchRunView: (runId: string) => Promise<RunView>) => {
  const rendered = render(<RunStatus runId="run_1" fetchRunView={fetchRunView} />)
  await act(async () => {})
  return rendered
}

describe('RunStatus polling (5.3)', () => {
  it('requests the run on mount and once per interval', async () => {
    const fetchRunView = vi.fn().mockResolvedValue(running)

    await mount(fetchRunView)
    expect(fetchRunView).toHaveBeenCalledTimes(1)

    await tick()
    expect(fetchRunView).toHaveBeenCalledTimes(2)

    await tick()
    expect(fetchRunView).toHaveBeenCalledTimes(3)
    expect(fetchRunView.mock.calls.every(([id]) => id === 'run_1')).toBe(true)
  })

  it('shows a different current step per reel', async () => {
    await mount(vi.fn().mockResolvedValue(running))

    // Two steps on screen at once, so a single run-level label cannot pass.
    expect(screen.getByText('transcribe')).toBeTruthy()
    expect(screen.getByText('download')).toBeTruthy()
  })

  it('shows no current step for a reel that already finished', async () => {
    const mixed: RunView = {
      ...running,
      reels: [
        running.reels[0],
        {
          rank: 2,
          shortcode: 'r2',
          thumbnailUrl: '',
          metrics: { views: 1, likes: 0, comments: 0 },
          status: 'ok',
          analysis: { objective: 'o', highlights: ['h'], targetAudience: 't' },
          script: { hook: 'h', body: 'b', closing: 'c' },
        },
      ],
    }

    await mount(vi.fn().mockResolvedValue(mixed))

    expect(screen.getByText('transcribe')).toBeTruthy()
    expect(screen.queryByText('download')).toBeNull()
  })

  it('stops polling once the run completes', async () => {
    const completed: RunView = { ...base, status: 'completed', reels: [] }
    const fetchRunView = vi.fn().mockResolvedValue(completed)

    await mount(fetchRunView)
    expect(fetchRunView).toHaveBeenCalledTimes(1)

    await tick()
    await tick()
    expect(fetchRunView).toHaveBeenCalledTimes(1)
  })

  it('stops polling and renders the message when the run aborted', async () => {
    const aborted: RunView = {
      ...base,
      status: 'aborted',
      error: {
        code: 'ig-session-expired',
        message: 'Rotate IG_SESSIONID with a fresh cookie from a disposable account.',
      },
      reels: [],
    }
    const fetchRunView = vi.fn().mockResolvedValue(aborted)

    await mount(fetchRunView)

    // The rotate-the-cookie instruction provably reaches the screen (7.3).
    expect(screen.getByRole('alert').textContent).toMatch(/rotate ig_sessionid/i)

    await tick()
    expect(fetchRunView).toHaveBeenCalledTimes(1)
  })

  it('renders an unknown-actor abort message too (4.5)', async () => {
    const aborted: RunView = {
      ...base,
      status: 'aborted',
      error: { code: 'unknown-actor', message: 'No profile for actor "nadie".' },
      reels: [],
    }

    await mount(vi.fn().mockResolvedValue(aborted))

    expect(screen.getByRole('alert').textContent).toMatch(/nadie/)
  })

  it('stops polling after unmount', async () => {
    const fetchRunView = vi.fn().mockResolvedValue(running)
    const { unmount } = await mount(fetchRunView)

    unmount()
    await tick()
    await tick()

    expect(fetchRunView).toHaveBeenCalledTimes(1)
  })
})
