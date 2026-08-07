import { describe, expect, it } from 'vitest'
import type { ReelAnalysis } from '../types'
import { buildAnalysisPrompt, buildScriptPrompt } from './index'

// Transcript and caption share no substring, so neither `toContain` can pass by
// accident on the other's text.
const transcript = 'Zebras migrate further than wildebeest, and nobody films it.'
const caption = 'Quick thread on overlooked megafauna journeys 🦓'

const analysis: ReelAnalysis = {
  objective: 'Reframe a familiar fact as a surprise',
  highlights: ['Opens with a contradiction', 'Names one hard number', 'Ends on an open question'],
  targetAudience: 'Curious generalists who follow science accounts',
}

const profile = {
  name: 'juanse',
  markdown: [
    '# juanse',
    '',
    '## Tone',
    'Direct, a little irreverent. Never corporate.',
    '',
    '## Verbal tics',
    '- Opens with "ojo con esto"',
    '- Closes by naming the next step',
    '',
    'DISTINCTIVE-MARKER-LINE-4f2a',
  ].join('\n'),
}

describe('buildAnalysisPrompt', () => {
  it('carries both the transcript and the caption (3.1)', () => {
    const prompt = buildAnalysisPrompt({ transcript, caption })

    expect(prompt).toContain(transcript)
    expect(prompt).toContain(caption)
  })

  it('names the exact keys reelAnalysisSchema validates', () => {
    const prompt = buildAnalysisPrompt({ transcript, caption })

    expect(prompt).toContain('objective')
    expect(prompt).toContain('highlights')
    expect(prompt).toContain('targetAudience')
  })

  it('stays usable when the reel has no caption', () => {
    const prompt = buildAnalysisPrompt({ transcript, caption: '' })

    expect(prompt).toContain(transcript)
    expect(prompt).not.toContain('undefined')
  })
})

describe('buildScriptPrompt', () => {
  it('embeds the actor profile verbatim (4.2)', () => {
    const prompt = buildScriptPrompt({ analysis, profile })

    // Truncating, trimming or reformatting the profile fails here.
    expect(prompt).toContain(profile.markdown)
  })

  it('carries the whole analysis', () => {
    const prompt = buildScriptPrompt({ analysis, profile })

    expect(prompt).toContain(analysis.objective)
    expect(prompt).toContain(analysis.targetAudience)
    for (const highlight of analysis.highlights) expect(prompt).toContain(highlight)
  })

  it('asks for a hook, a body and a closing', () => {
    const prompt = buildScriptPrompt({ analysis, profile })

    expect(prompt).toContain('hook')
    expect(prompt).toContain('body')
    expect(prompt).toContain('closing')
  })

  it('instructs Spanish output even though the inputs are English (4.6)', () => {
    const prompt = buildScriptPrompt({ analysis, profile })

    expect(prompt).toMatch(/spanish|español/i)
  })

  it('does not accept a per-run language', () => {
    // Enforced by typecheck, not at runtime: excess-property checking makes the
    // extra argument a compile error, so "Spanish is not per-run configurable"
    // (requirements' Out of scope) is a type guarantee rather than a convention.
    // @ts-expect-error — language is not a parameter
    const prompt = buildScriptPrompt({ analysis, profile, language: 'en' })

    expect(prompt).toBeTypeOf('string')
  })
})
