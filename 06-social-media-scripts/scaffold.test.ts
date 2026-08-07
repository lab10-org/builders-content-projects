import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
const readJson = (file: string) => JSON.parse(read(file))

// These assertions check PRESENCE, never exhaustiveness: later tasks add
// dependencies, tsconfig paths and ignore rules, and must not have to edit
// this suite to do it.

describe('package.json', () => {
  const pkg = () => readJson('package.json')

  it('is private, so it can never be published by accident', () => {
    expect(pkg().private).toBe(true)
  })

  it('exposes the exact verification commands every task runs', () => {
    expect(pkg().scripts.typecheck).toBe('tsc --noEmit')
    expect(pkg().scripts.test).toBe('vitest run')
  })

  it('declares the Next.js runtime dependencies', () => {
    const deps = pkg().dependencies ?? {}
    expect(Object.keys(deps)).toEqual(expect.arrayContaining(['next', 'react', 'react-dom']))
  })
})

describe('tsconfig.json', () => {
  const tsconfig = () => readJson('tsconfig.json')

  it('type-checks strictly and emits nothing', () => {
    expect(tsconfig().compilerOptions.strict).toBe(true)
    expect(tsconfig().compilerOptions.noEmit).toBe(true)
  })

  it('covers the source trees and the root-level test files', () => {
    const include: string[] = tsconfig().include
    expect(include).toEqual(
      expect.arrayContaining(['src/**/*.ts', 'app/**/*.tsx', '*.test.ts']),
    )
  })
})

describe('.gitignore', () => {
  const lines = () =>
    read('.gitignore')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

  // The git root's .gitignore only covers Python artifacts, so this
  // project-local file is the only thing keeping build output out of the repo.
  it.each(['node_modules', '.next', '.mastra', '.env*.local', 'next-env.d.ts', 'tmp/'])(
    'ignores %s',
    (entry) => {
      expect(lines()).toContain(entry)
    },
  )

  it('does not ignore profiles/, which holds committed actor profiles', () => {
    expect(lines().some((l) => l.replace(/^\/+/, '').startsWith('profiles'))).toBe(false)
  })
})

describe('.env.local.example', () => {
  const example = () => read('.env.local.example')

  it.each(['IG_SESSIONID', 'OPENROUTER_API_KEY'])(
    'names %s with an empty placeholder',
    (key) => {
      expect(example()).toMatch(new RegExp(`^${key}=\\s*$`, 'm'))
    },
  )
})
