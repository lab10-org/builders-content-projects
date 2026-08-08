import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Resolved from this module, not process.cwd(), so the test does not depend on
// where vitest was invoked from.
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('README', () => {
  it('exists and is not empty', () => {
    expect(readme.trim().length).toBeGreaterThan(0)
  })

  it.each([
    'IG_SESSIONID',
    'OPENROUTER_API_KEY',
    'ffmpeg',
    '.env.local',
    'profiles/',
    'npm run typecheck',
    'npm test',
  ])('documents %s', (needle) => {
    expect(readme).toContain(needle)
  })

  // 7.4: the cookie comes from a throwaway account and never from Lab10's,
  // said in ONE place rather than scattered across the file.
  it('warns, in a single paragraph, that the cookie must not be Lab10s (7.4)', () => {
    const paragraphs = readme.split(/\n\s*\n/)

    const warning = paragraphs.filter(
      (p) =>
        p.includes('IG_SESSIONID') &&
        /(desechable|descartable|quemable|burner|disposable)/i.test(p) &&
        /lab10/i.test(p) &&
        /(nunca|never)/i.test(p),
    )

    expect(warning.length).toBeGreaterThanOrEqual(1)
  })
})
