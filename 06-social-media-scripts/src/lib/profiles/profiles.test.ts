import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FatalRunError } from '../preflight'
import { listActors, loadActorProfile } from './index'

describe('against a fixture directory', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'profiles-'))
    await writeFile(join(dir, 'juanse.md'), '# juanse\n\nDirect, a little irreverent.\n')
    await writeFile(join(dir, 'ana.md'), '# ana\n')
    await writeFile(join(dir, 'notes.txt'), 'not a profile')
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('lists exactly the actors that have a profile, sorted (5.2)', async () => {
    await expect(listActors(dir)).resolves.toEqual(['ana', 'juanse'])
  })

  it('loads the raw markdown, unparsed', async () => {
    // The design hands this to the prompt as-is.
    await expect(loadActorProfile(dir, 'juanse')).resolves.toEqual({
      name: 'juanse',
      markdown: '# juanse\n\nDirect, a little irreverent.\n',
    })
  })

  it('rejects an unknown actor with unknown-actor, naming them (4.5)', async () => {
    const error = await loadActorProfile(dir, 'nadie').catch((e) => e)

    expect(error).toBeInstanceOf(FatalRunError)
    expect(error.code).toBe('unknown-actor')
    expect(error.message).toContain('nadie')
  })

  it.each(['../secrets', 'nested/juanse', '/etc/passwd', '.'])(
    'refuses to read outside the directory for %p',
    async (name) => {
      const error = await loadActorProfile(dir, name).catch((e) => e)

      expect(error).toBeInstanceOf(FatalRunError)
      expect(error.code).toBe('unknown-actor')
    },
  )

  it('resolves [] for an empty directory and for one that does not exist', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'profiles-empty-'))
    // The page (T27) reads this server-side and must still render before any
    // profile has been written.
    await expect(listActors(empty)).resolves.toEqual([])
    await expect(listActors(join(dir, 'nope'))).resolves.toEqual([])
    await rm(empty, { recursive: true, force: true })
  })
})

describe("against the repo's real profiles/ directory", () => {
  // Covers the artifact this task ships rather than assuming it: T27 mocks
  // listActors, so nothing else in the plan asserts on the real files.
  const dir = join(process.cwd(), 'profiles')

  it('offers juanse as a selectable actor (5.2)', async () => {
    await expect(listActors(dir)).resolves.toContain('juanse')
  })

  it('ships a real profile, not an empty placeholder', async () => {
    const profile = await loadActorProfile(dir, 'juanse')

    expect(profile.markdown.length).toBeGreaterThan(200)
  })
})
