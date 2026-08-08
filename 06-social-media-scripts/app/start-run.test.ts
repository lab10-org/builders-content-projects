import { describe, expect, it, vi } from 'vitest'
import { startRun } from './start-run'

const json = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('startRun', () => {
  it('posts exactly the three fields the route accepts and returns the runId', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ runId: 'run_1' }))

    await expect(startRun({ account: 'morningbrew', actor: 'juanse', top: 3 }, fetch)).resolves.toBe(
      'run_1',
    )

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/runs')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ account: 'morningbrew', actor: 'juanse', top: 3 })
  })

  it('rejects with a message naming the status on a non-2xx', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ error: 'account is required' }, 400))

    await expect(startRun({ account: '', actor: 'juanse', top: 3 }, fetch)).rejects.toThrow(/400/)
  })
})
