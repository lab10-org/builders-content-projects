import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../../../src/lib/preflight'

const start = vi.fn()
const createRunAsync = vi.fn()

// A route handler takes no injected container, so the module itself is the seam.
vi.mock('../../../src/mastra', () => ({
  getGenerateScriptsWorkflow: () => ({ createRunAsync }),
  buildRunDeps: () => ({}),
}))

const { POST } = await import('./route')

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/runs', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )

const deferred = () => {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('POST /api/runs', () => {
  beforeEach(() => {
    start.mockReset()
    createRunAsync.mockReset()
    createRunAsync.mockResolvedValue({ runId: 'run_test_1', start })
  })

  it('answers 201 with the runId while the run is still going (5.1)', async () => {
    const pending = deferred()
    start.mockReturnValue(pending.promise)

    const response = await post({ account: 'morningbrew', actor: 'juanse', top: 3 })

    // Asserted BEFORE releasing the run: this is what proves it is not awaited.
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ runId: 'run_test_1' })

    pending.resolve()
  })

  it('returns the id of the run that was actually created', async () => {
    createRunAsync.mockResolvedValue({ runId: 'run_from_engine', start })
    start.mockResolvedValue(undefined)

    const response = await post({ account: 'a', actor: 'b' })

    // The identifier T26 reads and T28 polls.
    await expect(response.json()).resolves.toEqual({ runId: 'run_from_engine' })
  })

  it('applies the default scan and top', async () => {
    start.mockResolvedValue(undefined)

    await post({ account: 'morningbrew', actor: 'juanse' })

    expect(start).toHaveBeenCalledTimes(1)
    expect(start.mock.calls[0][0].inputData).toEqual({
      account: 'morningbrew',
      actor: 'juanse',
      scan: 20,
      top: 3,
    })
  })

  it('takes top from the body when present', async () => {
    start.mockResolvedValue(undefined)

    await post({ account: 'a', actor: 'b', top: 7 })

    expect(start.mock.calls[0][0].inputData.top).toBe(7)
  })

  it.each([
    ['a missing account', { actor: 'juanse' }],
    ['a missing actor', { account: 'morningbrew' }],
    ['an invalid JSON body', 'not json at all'],
  ])('rejects %s with 400 and starts nothing', async (_label, body) => {
    const response = await post(body)

    expect(response.status).toBe(400)
    expect(createRunAsync).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })

  it.each([0, -1, 2.5, 'three'])('rejects top=%p with 400', async (top) => {
    const response = await post({ account: 'a', actor: 'b', top })

    expect(response.status).toBe(400)
    expect(start).not.toHaveBeenCalled()
  })

  describe('an aborting run', () => {
    const listener = vi.fn()
    beforeEach(() => process.on('unhandledRejection', listener))
    afterEach(() => {
      process.off('unhandledRejection', listener)
      listener.mockReset()
    })

    it('does not disturb the response already sent', async () => {
      const pending = deferred()
      start.mockReturnValue(pending.promise)

      const response = await post({ account: 'a', actor: 'nadie' })
      expect(response.status).toBe(201)

      pending.reject(new FatalRunError('unknown-actor', 'no profile for "nadie"'))
      // Flush microtasks so an unhandled rejection would have surfaced.
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
