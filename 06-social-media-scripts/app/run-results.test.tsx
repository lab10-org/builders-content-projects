// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunView } from '../src/lib/types'
import { RunResults, formatScript } from './run-results'

afterEach(cleanup)

const script1 = { hook: 'HOOK-ONE', body: 'BODY-ONE', closing: 'CLOSING-ONE' }
const script2 = { hook: 'HOOK-TWO', body: 'BODY-TWO', closing: 'CLOSING-TWO' }
const analysis = { objective: 'OBJECTIVE-X', highlights: ['HL-A', 'HL-B'], targetAudience: 'AUD-X' }

const completed: RunView = {
  runId: 'run_1',
  account: 'morningbrew',
  actor: 'juanse',
  status: 'completed',
  reels: [
    {
      rank: 1,
      shortcode: 'r1',
      thumbnailUrl: 'https://cdn/r1.jpg',
      metrics: { views: 6900000, likes: 412000, comments: 1820 },
      status: 'ok',
      analysis,
      script: script1,
    },
    {
      rank: 2,
      shortcode: 'r2',
      thumbnailUrl: 'https://cdn/r2.jpg',
      metrics: { views: 1200000, likes: 88000, comments: 430 },
      status: 'ok',
      analysis,
      script: script2,
    },
    {
      rank: 3,
      shortcode: 'r3',
      thumbnailUrl: '',
      metrics: { views: 44000, likes: 3100, comments: 12 },
      status: 'failed',
      failedStep: 'download',
      reason: 'video not available (404)',
    },
  ],
}

const card = (rank: number) => within(screen.getByTestId(`reel-${rank}`))

describe('a completed run (5.4, 5.6)', () => {
  it('shows rank and metrics for every reel', () => {
    render(<RunResults view={completed} copy={vi.fn()} />)

    expect(card(1).getByText('#1')).toBeTruthy()
    expect(card(1).getByText(/6900000 views/)).toBeTruthy()
    expect(card(1).getByText(/412000 likes/)).toBeTruthy()
    expect(card(1).getByText(/1820 comments/)).toBeTruthy()
  })

  it('shows the analysis and the script for a successful reel', () => {
    render(<RunResults view={completed} copy={vi.fn()} />)

    expect(card(1).getByText('OBJECTIVE-X')).toBeTruthy()
    expect(card(1).getByText('HL-A')).toBeTruthy()
    expect(card(1).getByText('HL-B')).toBeTruthy()
    expect(card(1).getByText('AUD-X')).toBeTruthy()
    expect(card(1).getByText('HOOK-ONE')).toBeTruthy()
    expect(card(1).getByText('BODY-ONE')).toBeTruthy()
    expect(card(1).getByText('CLOSING-ONE')).toBeTruthy()
  })

  it('shows the failure reason in place of the analysis and script (5.6)', () => {
    render(<RunResults view={completed} copy={vi.fn()} />)

    expect(card(3).getByRole('alert').textContent).toBe('video not available (404)')
    expect(card(3).queryByText('OBJECTIVE-X')).toBeNull()
    expect(card(3).queryByRole('button')).toBeNull()
  })

  it('renders every reel, in the order the API gave them', () => {
    // NOT an ordering guarantee — `RunResults` does no sorting, and this
    // fixture is already ascending, so an assertion of "rank order" here would
    // only restate its own input and could never fail.
    //
    // Ordering is owned server-side and enforced at both producers: `assemble`
    // (src/mastra/workflows/generate-scripts.ts) and `toRunView`
    // (app/api/runs/run-view.ts), the latter proven against an out-of-order
    // input in run-view.test.ts. What this asserts is narrower and real: every
    // reel is rendered, none dropped, in the given order.
    render(<RunResults view={completed} copy={vi.fn()} />)

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(completed.reels.map((reel) => `#${reel.rank}`))
  })
})

describe('copying a script (5.5)', () => {
  it('gives every successful reel exactly one copy control, and the failed one none', () => {
    render(<RunResults view={completed} copy={vi.fn()} />)

    expect(card(1).getAllByRole('button')).toHaveLength(1)
    expect(card(2).getAllByRole('button')).toHaveLength(1)
    expect(card(3).queryAllByRole('button')).toHaveLength(0)
  })

  it('copies that reel\'s hook, body and closing in order, and nothing else', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    render(<RunResults view={completed} copy={copy} />)

    fireEvent.click(card(1).getByRole('button'))

    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1))
    const text = copy.mock.calls[0][0] as string
    // Order, not mere containment.
    expect(text.indexOf('HOOK-ONE')).toBeLessThan(text.indexOf('BODY-ONE'))
    expect(text.indexOf('BODY-ONE')).toBeLessThan(text.indexOf('CLOSING-ONE'))
    expect(text).not.toContain('HOOK-TWO')
  })

  it('binds each control to its own card', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    render(<RunResults view={completed} copy={copy} />)

    fireEvent.click(card(2).getByRole('button'))

    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1))
    expect(copy.mock.calls[0][0]).toContain('HOOK-TWO')
  })

  it('confirms after a successful copy', async () => {
    render(<RunResults view={completed} copy={vi.fn().mockResolvedValue(undefined)} />)

    fireEvent.click(card(1).getByRole('button'))

    await waitFor(() => expect(card(1).getByRole('button').textContent).toMatch(/copiado/i))
  })

  it('reports a rejected copy instead of leaving it unhandled', async () => {
    render(<RunResults view={completed} copy={vi.fn().mockRejectedValue(new Error('denied'))} />)

    fireEvent.click(card(1).getByRole('button'))

    await waitFor(() => expect(card(1).getByRole('button').textContent).toMatch(/no se pudo/i))
    // The card stays usable.
    expect(card(1).getByText('HOOK-ONE')).toBeTruthy()
  })
})

describe('formatScript', () => {
  it('joins the three parts in order', () => {
    expect(formatScript(script1)).toBe('HOOK-ONE\n\nBODY-ONE\n\nCLOSING-ONE')
  })
})
