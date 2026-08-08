import { RuntimeContext } from '@mastra/core/runtime-context'
import { buildRunDeps, getGenerateScriptsWorkflow } from '../../../src/mastra'
import { withRunDeps } from '../../../src/mastra/deps'

/** The design's POST body is `{ account, actor, top }`; `scan` is not accepted
 *  from the client. */
const DEFAULT_SCAN = 20
const DEFAULT_TOP = 3

/** Holds a reference to each in-flight run so the promise is not collected
 *  while the request that started it has already returned. */
const inFlight = new Set<Promise<unknown>>()

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const badRequest = (message: string) =>
  Response.json({ error: message }, { status: 400 })

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('body must be valid JSON')
  }

  const { account, actor, top } = (body ?? {}) as Record<string, unknown>
  if (typeof account !== 'string' || account.trim() === '') return badRequest('account is required')
  if (typeof actor !== 'string' || actor.trim() === '') return badRequest('actor is required')
  if (top !== undefined && !isPositiveInteger(top)) return badRequest('top must be a positive integer')

  const run = await getGenerateScriptsWorkflow().createRunAsync()

  const runtimeContext = new RuntimeContext()
  withRunDeps(runtimeContext, buildRunDeps(run.runId))

  // Deliberately NOT awaited (5.1): the run takes minutes and the caller polls
  // GET /api/runs/:runId. The catch only logs — an aborted run is reported
  // through that poll as `status: 'aborted'`, not through this response.
  const started = run
    .start({
      inputData: { account, actor, scan: DEFAULT_SCAN, top: top ?? DEFAULT_TOP },
      runtimeContext,
    })
    .catch((error: unknown) => {
      console.error(`[run ${run.runId}] aborted:`, error)
    })
    .finally(() => inFlight.delete(started))
  inFlight.add(started)

  return Response.json({ runId: run.runId }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
