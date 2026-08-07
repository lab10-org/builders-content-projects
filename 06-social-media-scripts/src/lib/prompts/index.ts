import type { ReelAnalysis } from '../types'

// Pure: no I/O, and the only import is a type. That is what makes "does the
// actor's profile actually reach the prompt?" a one-line assertion.

export interface AnalysisPromptInput {
  transcript: string
  caption: string
}

/**
 * `profile` is typed structurally rather than by importing `ActorProfile` from
 * `lib/profiles`: that module lands in T12, later than this one. The real
 * `ActorProfile` satisfies this shape, so the design's intent holds without an
 * ordering dependency between tasks.
 */
export interface ScriptPromptInput {
  analysis: ReelAnalysis
  profile: { name: string; markdown: string }
}

export function buildAnalysisPrompt({ transcript, caption }: AnalysisPromptInput): string {
  return `You are analysing an Instagram reel that performed well, so that a team can learn from it.

Below are the reel's spoken transcript and its caption. Use both: the transcript is what the viewer heard, the caption often carries the framing.

<transcript>
${transcript}
</transcript>

<caption>
${caption}
</caption>

Produce an analysis with exactly these fields:
- objective: in one sentence, what this reel was trying to achieve.
- highlights: the specific moves that made it work — hooks, structure, turns of phrase. One per entry, concrete rather than generic.
- targetAudience: who this reel was made for.

Base the analysis only on the material above. Do not invent details that are not present.`
}

export function buildScriptPrompt({ analysis, profile }: ScriptPromptInput): string {
  return `You are writing a script for an Instagram reel, to be recorded by ${profile.name}.

This is ${profile.name}'s profile. Match how they actually speak — their tone, their verbal tics, their preferred structure. The script should sound like them, not like a generic brand voice.

<actor_profile>
${profile.markdown}
</actor_profile>

An analysis of a reel that worked well, to take inspiration from. Reuse what made it work; do not copy its content.

<reference_analysis>
objective: ${analysis.objective}
highlights:
${analysis.highlights.map((h) => `- ${h}`).join('\n')}
targetAudience: ${analysis.targetAudience}
</reference_analysis>

Write the script in three parts:
- hook: the first line, which has to stop the scroll.
- body: the substance.
- closing: how it ends.

Write it in Spanish, regardless of the language of the material above. It must be speakable out loud — short sentences, no formatting marks, nothing that reads like written prose.`
}
