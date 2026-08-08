import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { describe, expect, it } from 'vitest'
import type { RunDeps } from './deps'
import { getRunDeps, withRunDeps } from './deps'
import { createMastra, ensureStorageDir } from './index'

describe('createMastra', () => {
  it('configures storage and exposes an empty workflow registry', () => {
    // T19/T22 register workflows into this.
    const mastra = createMastra({ storageUrl: 'file::memory:' })

    expect(mastra.getStorage()).toBeTruthy()
    expect(Object.keys(mastra.getWorkflows())).toEqual([])
  })

  it('touches no disk for an in-memory store, so the unit suite stays hermetic', () => {
    // The app's file-backed singleton is built lazily behind getMastra(); what
    // matters here is that an in-memory url creates nothing.
    //
    // The earlier form of this test asserted `.mastra/` was absent from the
    // repo, which was fragile — it fails for anyone who has ever run the app,
    // and it did, the first time the app was booted for verification.
    const marker = join(process.cwd(), 'file:')

    createMastra({ storageUrl: 'file::memory:' })

    expect(existsSync(marker)).toBe(false)
  })
})

describe('run dependency seam', () => {
  const deps = { instagram: 'IG' } as unknown as RunDeps

  it('returns the bundle that was put on the context', () => {
    const ctx = new RuntimeContext()
    withRunDeps(ctx, deps)

    expect(getRunDeps(ctx)).toBe(deps)
  })

  it('throws naming the missing dependencies when nothing was set', () => {
    expect(() => getRunDeps(new RuntimeContext())).toThrow(/run dependencies/i)
  })
})

describe('ensureStorageDir', () => {
  // Regression: libsql fails with SQLite error 14 when the parent directory is
  // missing, which surfaced as a 500 on GET /api/runs/:id for an unknown run —
  // a request that should have been a plain 404. The unit tests missed it
  // because they mock the record reader.
  it('creates the parent directory of a file-backed store', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const dir = await mkdtemp(join(tmpdir(), 'mastra-storage-'))
    const dbPath = join(dir, 'nested', 'run-state.db')

    ensureStorageDir(`file:${dbPath}`)

    expect(existsSync(join(dir, 'nested'))).toBe(true)
    await rm(dir, { recursive: true, force: true })
  })

  it.each(['file::memory:', ':memory:'])('does nothing for %s', (url) => {
    expect(() => ensureStorageDir(url)).not.toThrow()
  })
})
