import { getProgressRecorder, readRunRecord } from '../../../../src/mastra'
import { type RunSnapshot, toRunView } from '../run-view'

const NOT_FOUND = { error: 'run not found' }
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(
  _request: Request,
  // Next 15 hands params as a promise; typing it as a plain object fails
  // `tsc --noEmit` against the generated route types.
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params

  if (typeof runId !== 'string' || runId.trim() === '') {
    return Response.json(NOT_FOUND, { status: 404, headers: noStore })
  }

  const record = await readRunRecord(runId)
  if (!record) return Response.json(NOT_FOUND, { status: 404, headers: noStore })

  // An aborted run is data the page renders, not a transport error — always 200.
  const view = toRunView({
    runId,
    input: record.input,
    snapshot: record.snapshot as RunSnapshot,
    progress: getProgressRecorder().read(runId),
  })

  return Response.json(view, { status: 200, headers: noStore })
}
