'use client'

import { useEffect, useState } from 'react'
import type { RunView } from '../src/lib/types'
import { RunResults } from './run-results'

export const POLL_INTERVAL_MS = 2000

const fetchRunViewDefault = async (runId: string): Promise<RunView> => {
  const response = await fetch(`/api/runs/${runId}`, { cache: 'no-store' })
  return (await response.json()) as RunView
}

export interface RunStatusProps {
  runId: string
  /** Injected seam — a prop, not the global fetch, so tests need no polyfill. */
  fetchRunView?: (runId: string) => Promise<RunView>
  copy?: (text: string) => Promise<void>
}

const isTerminal = (view: RunView | null) =>
  view?.status === 'completed' || view?.status === 'aborted'

export function RunStatus({ runId, fetchRunView = fetchRunViewDefault, copy }: RunStatusProps) {
  const [view, setView] = useState<RunView | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    const poll = async () => {
      const next = await fetchRunView(runId)
      if (cancelled) return
      setView(next)
      // Stop as soon as the run can no longer change.
      if (next.status === 'completed' || next.status === 'aborted') {
        if (timer) clearInterval(timer)
      }
    }

    void poll()
    timer = setInterval(() => void poll(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [runId, fetchRunView])

  if (!view) return <p>Iniciando…</p>

  if (view.status === 'aborted') {
    return (
      <section>
        <p role="alert">{view.error?.message}</p>
      </section>
    )
  }

  if (view.status === 'completed') return <RunResults view={view} copy={copy} />

  return (
    <section>
      <p>En progreso…</p>
      <ul>
        {view.reels.map((reel) => (
          <li key={reel.shortcode}>
            <span>#{reel.rank}</span>{' '}
            {reel.status === 'pending' ? <span>{reel.currentStep}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
