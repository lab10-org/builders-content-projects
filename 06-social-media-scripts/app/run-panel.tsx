'use client'

import { useState } from 'react'
import { RunForm } from './run-form'
import { RunStatus } from './run-status'

/** Owns the runId: the form first, the run view once a run exists. */
export function RunPanel({ actors }: { actors: string[] }) {
  const [runId, setRunId] = useState<string | null>(null)

  return (
    <>
      <RunForm actors={actors} onStarted={setRunId} />
      {runId ? <RunStatus runId={runId} /> : null}
    </>
  )
}
