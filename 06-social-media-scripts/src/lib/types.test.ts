import { describe, expect, it } from 'vitest'
import {
  reelAnalysisSchema,
  reelScriptSchema,
  type ReelOutcome,
} from './types'

describe('reelAnalysisSchema', () => {
  const valid = { objective: 'explain the news', highlights: ['a'], targetAudience: 'founders' }

  it('accepts a well-formed analysis', () => {
    expect(reelAnalysisSchema.safeParse(valid).success).toBe(true)
  })

  // 3.2 — "does not conform" cases.
  it.each([
    ['a missing targetAudience', { objective: 'x', highlights: ['a'] }],
    ['an empty objective', { ...valid, objective: '' }],
    ['an empty highlights array', { ...valid, highlights: [] }],
    ['an empty highlights entry', { ...valid, highlights: [''] }],
  ])('rejects %s', (_label, input) => {
    expect(reelAnalysisSchema.safeParse(input).success).toBe(false)
  })
})

describe('reelScriptSchema', () => {
  const valid = { hook: 'wait', body: 'here is why', closing: 'follow for more' }

  it('accepts a hook, body and closing', () => {
    expect(reelScriptSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['a missing hook', { body: 'b', closing: 'c' }],
    ['an empty closing', { ...valid, closing: '' }],
  ])('rejects %s', (_label, input) => {
    expect(reelScriptSchema.safeParse(input).success).toBe(false)
  })
})

// Type-level assertions. Vitest transpiles without type-checking, so these are
// enforced by `npm run typecheck`, not by the runtime suite: tsc reports an
// *unused* @ts-expect-error (TS2578) the moment the union stops rejecting them.
describe('ReelOutcome discriminated union', () => {
  const base = { rank: 1, shortcode: 'abc', thumbnailUrl: 'u', metrics: { views: 1, likes: 2, comments: 3 } }

  it('requires failedStep on a failed outcome and script on an ok one', () => {
    // @ts-expect-error — a failed outcome without failedStep must not compile
    const missingStep: ReelOutcome = { ...base, status: 'failed', reason: 'boom' }

    // @ts-expect-error — an ok outcome without script must not compile
    const missingScript: ReelOutcome = {
      ...base,
      status: 'ok',
      analysis: { objective: 'o', highlights: ['h'], targetAudience: 't' },
    }

    const complete: ReelOutcome = {
      ...base,
      status: 'ok',
      analysis: { objective: 'o', highlights: ['h'], targetAudience: 't' },
      script: { hook: 'h', body: 'b', closing: 'c' },
    }

    expect([missingStep, missingScript, complete]).toHaveLength(3)
  })
})
