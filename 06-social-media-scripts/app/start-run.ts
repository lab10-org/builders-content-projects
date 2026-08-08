export interface StartRunInput {
  account: string
  actor: string
  top: number
}

/** The default transport `RunForm` uses. Injectable so the form can be tested
 *  against a fake, and testable here against a fake `fetch`. */
export async function startRun(
  input: StartRunInput,
  doFetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const response = await doFetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Could not start the run (HTTP ${response.status}).`)
  }

  const { runId } = (await response.json()) as { runId: string }
  return runId
}
