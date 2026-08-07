'use client'

import { useState } from 'react'
import { type StartRunInput, startRun as defaultStartRun } from './start-run'

/** Matches POST /api/runs' own default, so the two cannot drift. */
export const DEFAULT_TOP = 3

export interface RunFormProps {
  actors: string[]
  onStarted?: (runId: string) => void
  startRun?: (input: StartRunInput) => Promise<string>
}

export function RunForm({ actors, onStarted, startRun = (i) => defaultStartRun(i) }: RunFormProps) {
  const [account, setAccount] = useState('')
  const [actor, setActor] = useState(actors[0] ?? '')
  const [top, setTop] = useState(DEFAULT_TOP)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const id = await startRun({ account, actor, top })
      setRunId(id)
      onStarted?.(id)
    } catch (cause) {
      // The entered values stay in place so the user can correct and retry.
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="account">Cuenta</label>
      <input
        id="account"
        name="account"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
      />

      <label htmlFor="actor">Actor</label>
      <select id="actor" name="actor" value={actor} onChange={(e) => setActor(e.target.value)}>
        {actors.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <label htmlFor="top">Reels</label>
      <input
        id="top"
        name="top"
        type="number"
        value={top}
        onChange={(e) => setTop(Number(e.target.value))}
      />

      <button type="submit" disabled={pending}>
        {pending ? 'Generando…' : 'Generar'}
      </button>

      {error ? <p role="alert">{error}</p> : null}
      {runId ? <p>Run: {runId}</p> : null}
    </form>
  )
}
