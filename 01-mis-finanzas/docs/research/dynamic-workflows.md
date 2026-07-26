# Dynamic Workflows in Claude Code — Concept, Architectures, and Use Cases

**Research report — 25 July 2026**

> **Sourcing convention.** Claims are tagged `[OFFICIAL]` (Anthropic docs/blog), `[CONVERGENT]` (three or more independent community sources agree), `[SINGLE-SOURCE]`, `[REPORTED]` (self-reported practitioner numbers), or `[CONTESTED]`. This matters more than usual here: **Anthropic has not published the script API**. The official docs point to the Agent SDK reference "for the full set of options," and that page only documents the tool envelope, not `agent()`/`parallel()`/`pipeline()` semantics. Everything in §4 beyond the one official example is community reverse-engineering of scripts the runtime itself generates.

---

## 1. TL;DR

A **dynamic workflow** is a JavaScript script — written by Claude at runtime, not by you — that orchestrates dozens to hundreds of subagents in a background runtime, outside your conversation's context window. Announced **28 May 2026**, requires Claude Code **v2.1.154+**, available on all paid plans plus API, Bedrock, Google Cloud Agent Platform and Microsoft Foundry. `[OFFICIAL]`

The one-line concept:

> **Control flow lives in code. Judgment lives in models.**

Everything a conventional agent loop spends tokens on — deciding what to run next, routing, scoring, deduplicating, stopping — becomes deterministic JavaScript that costs zero model tokens. Everything that requires actual judgment stays in a subagent with a clean context window.

Three things follow from that, and they're the whole value proposition:

1. **Scale beyond one context window.** Intermediate results live in script variables, not Claude's context. A 500-file migration doesn't compact away.
2. **Repeatable quality structure.** Because the orchestration is code, you can *guarantee* that every finding gets adversarially verified, that the loop covers all 50 items, that no item is silently skipped.
3. **Reusability.** Save the script and it becomes a slash command that runs the same orchestration every time.

The costs are equally real: **5–7× token multiplier** on comparable work `[REPORTED]`, no mid-run human input, session-scoped resume with documented bugs, and 16-wide concurrency regardless of how many agents you schedule.

---

## 2. The concept

### 2.1 What problem it actually solves

Anthropic's framing (the ["harness for every task"](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code) post) is that single-context agent execution has three structural failure modes that no prompt fixes: `[OFFICIAL]`

| Failure mode | What it looks like | Structural fix |
|---|---|---|
| **Agentic laziness** | Handles 35 of 50 items, declares done | A JS `pipeline()` over the item list literally cannot skip an item |
| **Self-preferential bias** | Claude grades its own output favorably | Verifier agents that never saw the drafting context |
| **Goal drift** | Fidelity lost through summarization/compaction | Schema-typed handoffs between phases; original objective re-stated per agent |

A "harness" here means the orchestration scaffolding around the model. Claude Code's default harness is generic — one context, plan-then-execute. A dynamic workflow lets Claude **write a task-specific harness** for the problem in front of it.

### 2.2 Who holds the plan — the primitive comparison

This is the official table, and it's the best decision tool available: `[OFFICIAL]`

| | **Subagents** | **Skills** | **Agent teams** | **Workflows** |
|---|---|---|---|---|
| What it is | A worker Claude spawns | Instructions Claude follows | A lead agent supervising peer sessions | **A script the runtime executes** |
| Who decides what runs next | Claude, turn by turn | Claude, following the prompt | The lead agent, turn by turn | **The script** |
| Where intermediate results live | Claude's context window | Claude's context window | A shared task list | **Script variables** |
| What's repeatable | The worker definition | The instructions | The team definition | **The orchestration itself** |
| Scale | A few delegated tasks/turn | Same as subagents | A handful of long-running peers | **Dozens to hundreds per run** |
| Interruption | Restarts the turn | Restarts the turn | Teammates keep running | **Resumable in the same session** |

The load-bearing sentence:

> A workflow script holds the loop, the branching, and the intermediate results itself, so **Claude's context holds only the final answer**.

### 2.3 Mental models worth keeping

- **"n8n glues your tools; a dynamic workflow glues your agents."** ([Product Compass](https://www.productcompass.pm/p/claude-code-dynamic-workflows))
- **Warp and weft.** `meta` + `phase()` are the fixed structural backbone; `agent()`/`parallel()`/`pipeline()` are the work woven through it. `[SINGLE-SOURCE]`
- **The flowchart test.** "If you can sketch a non-trivial flowchart with parallel branches, loops, and data handoffs between stages, a dynamic workflow is likely appropriate." `[CONVERGENT]`
- **The inverse heuristic.** "If you can still track your agents by hand, you don't need a workflow yet."

---

## 3. How you actually run one

You never write the script. You describe the task; Claude writes and launches the script; you approve it.

| Entry point | What it does |
|---|---|
| `ultracode: <task>` | Keyword in a typed prompt → Claude structures this one task as a workflow |
| "use a workflow to …" | Natural-language opt-in, treated identically |
| `/effort ultracode` | Session-wide: `xhigh` reasoning + Claude decides per task when to orchestrate (v2.1.203+) |
| `/deep-research <question>` | The only **bundled** workflow — fan-out search → cross-check → vote → cited report |
| `/<saved-name>` | A workflow you saved from a previous run |
| `/<plugin>:<name>` | A workflow distributed inside a plugin |

**Security note on the trigger** `[OFFICIAL]`: since v2.1.210 the `ultracode` keyword is an opt-in **only from human-typed input**. It no longer fires from `-p` prompts, unstamped SDK sends, scheduled tasks, webhook payloads, or PR comments relayed into the conversation. Before that, untrusted external text could launch up to 1,000 auto-editing agents — a genuine injection vector that has since been closed.

**Saving and sharing:** `/workflows` → select the run → press `s` → save to `.claude/workflows/` (repo-shared) or `~/.claude/workflows/` (personal). It becomes `/<name>`. In monorepos, project workflows load from every `.claude/workflows/` between cwd and repo root; closest to cwd wins; project beats personal on name collision (v2.1.178+). Symlink-write protection added v2.1.216.

**Parameterizing:** a saved workflow reads a global `args`. `> Run /triage-issues on issues 1024, 1025, and 1030` passes the list as structured data.

**Watching:** `/workflows` shows phases with agent counts, token totals and elapsed time. `p` pause/resume, `x` stop, `r` restart an agent, `f` filter, `s` save, `Ctrl+G` open the raw script.

---

## 4. The runtime and the script API

### 4.1 The official example — the whole shape in 15 lines

```javascript
export const meta = {
  name: 'audit-routes',
  description: 'Audit every route handler for missing auth checks',
}

const found = await agent('List every .ts file under src/routes/.', {
  schema: { type: 'object', required: ['files'],
            properties: { files: { type: 'array', items: { type: 'string' } } } },
})

const audits = await pipeline(found.files, file =>
  agent(`Audit ${file} for missing authentication checks.`, { label: file }),
)

return audits.filter(Boolean)
```

Plain JavaScript, top-level `await`, `meta` must be a **pure literal** (no variables, template strings, spreads) because the runtime extracts it statically to render the phase list in the approval card *before* the script runs. `[OFFICIAL for the rule, SINGLE-SOURCE for the reason]`

### 4.2 The primitives

| Primitive | Semantics |
|---|---|
| `agent(prompt, opts?)` | Spawn one subagent with a clean context. Returns text, or a validated object when `schema` is passed. Resolves to `null` on failure — always `.filter(Boolean)`. |
| `parallel(thunks)` | **Barrier.** Array of zero-arg functions (`.map(x => () => agent(...))` — the double arrow is the #1 syntax trap). Launches all, returns when the slowest finishes. Results in input order. |
| `pipeline(items, ...stages)` | **No barrier.** Each item flows through all stages independently — item 1 can be in stage 3 while item 7 is still in stage 1. Stages receive `(prevResult, originalItem, index)`. |
| `phase(title)` | Progress grouping for subsequent `agent()` calls. |
| `log(msg)` | Narrator line above the progress tree. |
| `args` | The value passed at invocation, as structured data. `undefined` if omitted. `[OFFICIAL]` |
| `budget` | Token target from a `+500k`-style directive. `budget.total`, `.spent()`, `.remaining()`. `[SINGLE-SOURCE on the method surface — verify before depending on it]` |
| `workflow(nameOrRef, args?)` | Run another workflow inline. **One level of nesting only.** Child shares parent's concurrency cap, agent counter and budget. |

`agent()` options `[CONVERGENT unless noted]`: `schema` (JSON Schema — runtime validates and auto-retries until it matches, invisibly), `label`, `phase`, `model`, `effort` `[SINGLE-SOURCE]`, `isolation: 'worktree'`, `agentType`.

> **`phase` option vs `phase()` call:** inside `parallel()`/`pipeline()`, always pass `phase` as an *option* to `agent()`. The global `phase()` mutates shared state and races with concurrent calls.

### 4.3 `parallel` vs `pipeline` — the single most repeated rule

> **Default to `pipeline()`. Reach for a `parallel()` barrier only when a stage genuinely needs *all* prior results at once.** `[CONVERGENT]`

Legitimate barrier reasons:

- Deduplication across the full result set
- A synthesis prompt that literally says "given all the findings…"
- Cross-item comparison
- Early exit on total count (skip stage 2 if stage 1 found nothing anywhere)

Not legitimate: "I need to flatten/map/filter first" (do it inside a pipeline stage), "the stages are conceptually separate," "it's cleaner code." Barrier latency is real — if the slowest item takes 3× the fastest, a barrier wastes two-thirds of the fast agents' time.

### 4.4 Determinism constraints — and why they exist

`Date.now()`, argless `new Date()`, and `Math.random()` **throw** inside a workflow script. `require`, `fs`, `process` and network calls are unavailable in orchestrator scope. `[CONVERGENT; the no-FS rule is OFFICIAL]`

The reason is journaled replay: on resume the runtime **re-executes the script from the top** and serves cached results for completed `agent()` calls. Nondeterministic branching would make cached results inconsistent with the new execution path. This is the same restriction Temporal imposes on workflow code, for the same reason.

Practical consequences: pass timestamps and seeds through `args`; vary agent prompts by index rather than randomly; you cannot glob files from the script — you spend an `agent()` call just to list them (which is exactly what the official example's first agent does).

### 4.5 Hard limits

| Constraint | Value | Source |
|---|---|---|
| Concurrent agents | "Up to 16, fewer on limited-CPU machines" — reported formula `min(16, cores − 2)` | `[OFFICIAL]` / `[SINGLE-SOURCE]` |
| Total agents per run | 1,000 (runaway-loop backstop, **not** a budget) | `[OFFICIAL]` |
| Items per `parallel()`/`pipeline()` call | 4,096 | `[SINGLE-SOURCE]` |
| Sub-workflow nesting | 1 level; `workflow()` inside a child throws | `[CONVERGENT]` |
| Mid-run user input | **None.** Only permission prompts pause a run | `[OFFICIAL]` |
| FS/shell from the script | None — agents do all I/O | `[OFFICIAL]` |
| Resume scope | **Same Claude Code session only.** Exit → next session starts fresh | `[OFFICIAL]` |
| Language | Plain JS, no TypeScript, no imports | `[CONVERGENT]` |
| Subagent permission mode | **Always `acceptEdits`**, regardless of session mode | `[OFFICIAL]` |
| "Large workflow" warning | >25 agents scheduled or >1.5M projected tokens; advisory only, muted under ultracode | `[OFFICIAL]` |

A resume subtlety with real design consequences: an agent that was *still running* when you stopped is not journaled and restarts. So **many small agents preserve more progress than a few long ones** — a reason to decompose beyond what parallelism alone would justify. `[OFFICIAL]`

### 4.6 Per-agent configuration: model, effort, and tools

Short version: **model and effort are directly settable per `agent()` call; tools are not.** Tool scoping has to come from a subagent definition referenced by `agentType`, and there is a reported bug in exactly that path.

#### Model and effort — supported

```javascript
const findings = await agent(`Audit ${file} for missing auth checks.`, {
  model: 'haiku',      // 'sonnet' | 'opus' | 'haiku' | 'fable' | full ID e.g. 'claude-opus-5'
  effort: 'low',       // 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  label: file,
  schema: FINDINGS_SCHEMA,
})
```

This is the primary cost lever: cheap model for the fan-out, strong model for synthesis and adversarial verification.

**Resolution order** `[OFFICIAL]` — highest wins:

1. `CLAUDE_CODE_SUBAGENT_MODEL` environment variable
2. The per-invocation `model` parameter (what the script sets)
3. The subagent definition's `model:` frontmatter
4. The main conversation's model

So a script's careful per-stage routing is **silently defeated** if `CLAUDE_CODE_SUBAGENT_MODEL` is set anywhere in the environment. As of v2.1.196, setting it to `inherit` is equivalent to leaving it unset. Values are also checked against your org's `availableModels` allowlist — an excluded model is skipped and the agent runs on the inherited model instead.

`[CONTEXT]` [Issue #63693](https://github.com/anthropics/claude-code/issues/63693) is the community complaint that *auto-generated* workflows don't route models by default, forcing every subagent onto the orchestrator's premium model. Open, stale, no maintainer response. The script-level `model` option does exist — the gap is that Claude doesn't always use it unless you ask, and there is no `workflow-subagent-model` default short of the blunt env var.

#### Tools — no option on `agent()`

The opts surface is `{ label, phase, schema, model, effort, isolation, agentType }`. There is **no `tools` or `disallowedTools` parameter.** The intended route is a subagent definition in `.claude/agents/` referenced by `agentType`:

```yaml
---
name: auditor
description: Read-only security auditor
tools: Read, Grep, Glob            # allowlist
# or: disallowedTools: Write, Edit # denylist — keeps everything else, incl. Bash and MCP
model: haiku
permissionMode: default
maxTurns: 20
---
You are a security auditor. Report findings only. Never modify files.
```

```javascript
await agent(`Audit ${file}`, { agentType: 'auditor', model: 'haiku' })
```

Referencing a definition this way is also the **only** way to reach per-stage `permissionMode`, `maxTurns`, `skills` (preloaded into context), `mcpServers`, and `memory` — none of which the script API exposes.

Alternatively, use the built-in read-only type with no setup: **`agentType: 'Explore'`** — read-only tools, Write and Edit denied. Caveat: Explore deliberately skips your CLAUDE.md files and the parent session's git status to stay fast and cheap, which you may not want for an audit. `Plan` is likewise read-only. A user or project subagent named `Explore` overrides the built-in.

Two documented filters narrow the pool regardless of what you declare `[OFFICIAL]`: every subagent loses `AskUserQuestion`, `EndConversation`, `Workflow` and (at depth limit) `Agent`; and **background** subagents keep only `Read`, `Grep`, `Glob`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`. So the same definition can resolve to different tools in the foreground and the background — and a `tools` list that resolves to nothing fails to launch with an error.

#### ⚠️ The bug: workflows reportedly ignore the tools allowlist

`[REPORTED — verify on your version]` [Issue #63762](https://github.com/anthropics/claude-code/issues/63762): dynamic workflows do not honour the `tools:` allowlist. Spawned agents receive **`declared tools ∪ {Write, Edit}`**. The reporter verified this against files actually written to disk rather than agent self-reports:

- Declared `tools: Read, Glob, Grep` → ran with `Read, Write, Edit, Glob, Grep`, wrote files to arbitrary paths
- Declared `tools: Read, Bash, Glob, Grep` → ran with `Read, Write, Edit, Bash`, wrote files

Filed 29 May 2026 (research-preview era), **closed as not planned, labelled stale**. The request was either to honour `agentType`'s declarations or to add `tools`/`disallowedTools` to the `agent()` API; neither shipped. It may or may not still reproduce on current versions.

This is consistent with the documented behaviour that workflow subagents **always run in `acceptEdits` regardless of the session's permission mode** — file edits auto-approve. Treat least-privilege inside workflows as unproven until you test it.

**How to test it properly:** run a two-agent workflow with a read-only `agentType`, instruct the second agent to write a file, then check `git status`. Do not ask the agent what tools it has — self-reports were exactly what misled people here.

#### What actually enforces read-only today

In descending order of hardness:

| Mechanism | Enforcement | Cost |
|---|---|---|
| **`permissions.deny: ["Write", "Edit"]`** in settings | Real, at the permission layer; applies to workflow subagents | Session/project-wide — kills any workflow that legitimately writes |
| **A `PreToolUse` hook** blocking Write/Edit | Real gate, fires on subagent tool calls | Coarse and global rather than per-agent |
| **`agentType` with `tools:` / `disallowedTools:`** | *Intended* mechanism — currently suspect per #63762 | None, if it works |
| **`isolation: 'worktree'`** | Doesn't prevent writes; contains them to a throwaway repo copy, auto-cleaned if unchanged | +2–5s per agent on large repos |
| **Prompt-level instruction** ("report findings only") | Not enforcement | Free; pairs well with a schema that has no field a write would serve |

For a genuinely read-only audit run today, combine one of the first two with `agentType` rather than relying on `agentType` alone.

---

## 5. The architecture catalog

Anthropic names six canonical patterns; the community has extended the set. All real workflows are compositions of these.

### 5.1 The six canonical patterns `[OFFICIAL]`

| Pattern | Shape | Targets |
|---|---|---|
| **Classify-and-act** | Cheap classifier → script branches to specialized handlers/models | Heterogeneous work, cost control |
| **Fan-out-and-synthesize** | N parallel agents → JS reduce → one synthesis agent | Breadth, context overflow |
| **Adversarial verification** | Wave 1 finds → wave 2 tries to *refute* each finding → kill unless it survives | Self-preferential bias |
| **Generate-and-filter** | Many candidates → dedupe → filter by rubric | Early commitment |
| **Tournament** | N attempts, pairwise judging until a winner emerges | Unreliable absolute scoring |
| **Loop-until-done** | Keep spawning rounds until a stop condition holds | Agentic laziness |

### 5.2 Fan-out-and-synthesize — the archetype

Everything generalizes to **fan out → reduce → synthesize**. Note the built-in model tiering: cheap model for breadth, strong model for the merge.

```javascript
const reviews = await parallel(
  files.map(file => () => agent(
    `Review ${file} for security issues`,
    { model: "haiku", schema: IssueList }
  ))
)
const report = await agent(
  `Merge these reviews into one prioritized report:\n${JSON.stringify(reviews)}`,
  { model: "opus" }
)
```

The reduce step is **plain JavaScript, not an agent** — filtering, flattening and counting cost zero tokens.

### 5.3 Adversarial verification — the quality pattern that defines the feature

The verifier has never seen the original work, so it cannot favor it. The first wave was asked to *find* problems, not to assess their validity; a dedicated refuter, given only the finding and the source material, catches assumptions that don't hold.

```javascript
const results = await pipeline(
  DIMENSIONS,
  // Stage 1: one finder per dimension
  dim => agent(dim.prompt, { phase: 'Review', label: dim.id, schema: FINDINGS_SCHEMA }),
  // Stage 2: each finding gets its own refuter — as soon as its dimension finishes
  findings => parallel(
    findings.issues.map(issue => () =>
      agent(`A reviewer found: "${issue.title}" (${issue.description}).
             Try your hardest to refute it. Real problem or false positive?`,
            { phase: 'Verify', label: issue.title, schema: VERDICT_SCHEMA })
    )
  )
)
const confirmed = results.flat().filter(Boolean).flat().filter(v => v?.isReal)
```

`[SINGLE-SOURCE, REPORTED]` One real PR review with this pattern cut 26 initial findings to 16 — ten false positives eliminated.

**Critical correctness rule** `[OFFICIAL, learned the hard way]`: never conflate *refuted* with *verification failed*. Claude Code v2.1.196 fixed exactly this in `/deep-research` — when verifiers hit a rate limit or API error, claims are now reported as **unverified** rather than counted as disproved. Mirror this in your own scripts.

### 5.4 Perspective-diverse verification

The upgrade over N identical skeptics: give each verifier a **distinct lens** (correctness, security, performance, does-it-reproduce). Redundant verifiers "add cost without catching distinct failure modes." Take a majority vote across lenses.

### 5.5 Judge panel

Generate N attempts from different angles → score with parallel judges → synthesize from the winner **while grafting the best ideas from runners-up**. Beats one-attempt-iterated when the solution space is wide.

A nice stopping criterion from the consensus-loop variant — run more rounds until the judges *agree*:

```javascript
while (budget.total && budget.remaining() > 50_000) {
  const panel = await parallel([/* judges with distinct lenses */])
  const scores = panel.filter(Boolean).map(j => j.score)
  if (Math.max(...scores) - Math.min(...scores) <= 1.5) break  // consensus
}
```

### 5.6 Tournament

Multiple agents attempt the same task; judge **pairwise** until a winner emerges. Anthropic's stated rationale: comparative judgment is more reliable than absolute scoring, especially for taste-based work, because LLM absolute scores are unstable and compress toward the middle. This is the strongest *non-engineering* pattern — ranking 80 resumes, 1,000 support tickets, naming candidates, proposals.

### 5.7 Loop-until-dry

Keep spawning finders in rounds until **K consecutive rounds surface nothing new**. Simple `while (count < N)` loops miss the tail.

```javascript
const seen = new Set(), confirmed = []
let dry = 0
while (dry < 2) {
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, { phase: "Find", schema: BUGS })))).filter(Boolean).flatMap(r => r.bugs)
  const fresh = found.filter(b => !seen.has(key(b)))
  if (!fresh.length) { dry++; continue }
  dry = 0; fresh.forEach(b => seen.add(key(b)))
  const judged = await parallel(fresh.map(b => () =>
    parallel(["correctness","security","repro"].map(lens => () =>
      agent(`Judge "${b.desc}" via the ${lens} lens — real?`, { phase: "Verify", schema: VERDICT })))
      .then(vs => ({ b, real: vs.filter(Boolean).filter(v => v.real).length >= 2 }))))
  confirmed.push(...judged.filter(v => v.real).map(v => v.b))
}
```

**The #1 loop bug**, called out by every source: dedupe against `seen`, **not** against `confirmed`. If you only track confirmed findings, judge-rejected items resurface every round and the loop never goes dry.

### 5.8 Loop-until-budget

`while (budget.total && budget.remaining() > RESERVE) { … }` — audit depth scales with willingness to pay. Idiom in the wild: `ultracode +500k: exhaustively audit this repo for issues until the budget is used`. **Guard every loop** — an unguarded `while(true)` walks into the 1,000-agent cap.

### 5.9 Multi-modal / multi-strategy sweep

N agents attack the same question from deliberately **blind, disjoint angles**, then synthesis flags agreement vs contradiction.

```javascript
const strategies = [
  { label: 'official-docs',      prompt: `Based only on official documentation, explain...` },
  { label: 'community-reports',  prompt: `Based only on GitHub issues and community reports, explain...` },
  { label: 'academic',           prompt: `Based only on academic papers and benchmarks, explain...` },
]
const perspectives = await parallel(strategies.map(s => () =>
  agent(s.prompt, { label: s.label, schema: PERSPECTIVE_SCHEMA })))
```

The **"Based only on X"** constraint is the load-bearing part — without it, three agents converge on the same top search result. The incident-response version: one agent sees only diffs, one only logs, one only config, one only dependency bumps. Blind angles prevent evidence contamination.

### 5.10 Scout-then-fan-out

One cheap `schema`-typed discovery agent enumerates the work items, then fan out one agent per item. This is the official `audit-routes` shape and it exists because the script itself cannot touch the filesystem.

A **hybrid variant worth knowing**: do the scouting *inline in your main session* (list the files, scope the diff, find the channels), then launch the workflow with the results via `args`. You don't need to know the shape before the *task* — only before the *orchestration step*.

### 5.11 Multi-phase chaining

Understand → design → implement → review. Note the official framing: **separate workflows in sequence, not one workflow with many phases** — because there is no mid-run sign-off, "for sign-off between stages, run each stage as its own workflow." With ultracode on, "a single request can turn into several workflows in a row." `[OFFICIAL]`

The best structural move found in this family: **let a model decide the parallelism topology, but let the script enforce it.**

```javascript
const parallelSteps   = plan.steps.filter(s => s.canParallelize)
const sequentialSteps = plan.steps.filter(s => !s.canParallelize)

if (parallelSteps.length) {
  await parallel(parallelSteps.map(step => () =>
    agent(`Implement: ${step.description}. Only modify ${step.file}.`,
          { label: step.file, isolation: 'worktree' })))
}
for (const step of sequentialSteps) {
  await agent(`Implement: ${step.description}. File: ${step.file}.`, { label: step.file })
}
```

### 5.12 Completeness critic

A final agent asking "what's missing — a modality not run, a claim unverified, a source unread?" What it finds becomes the next round. `[INFERENCE — this is in Claude Code's own workflow guidance but is not a name that appears in published community sources]`

### 5.13 Quarantine

Agents that read untrusted content are structurally barred from high-privilege actions. This is a prompt-injection control you can **only** enforce in orchestration code, not in a prompt — and it matters precisely because subagents always run in `acceptEdits`.

---

## 6. Design rules that separate good scripts from expensive ones

1. **Schema everything between phases.** Validation happens at the tool-call layer with automatic invisible retry, so downstream stages can destructure `result.field` with no defensive checks. The corollary is a go/no-go test: *if you cannot define what data each phase hands to the next, the task belongs in a single conversation.*
2. **Do reductions in JavaScript, not in agents.** Flatten, filter, dedupe, count, sort — zero tokens.
3. **`pipeline()` by default; barrier only when a stage needs everything.**
4. **Dedupe against everything seen, including rejects.**
5. **`isolation: 'worktree'` only when agents write files in parallel.** It costs +2–5s per agent on large repos. `[SINGLE-SOURCE]`
6. **Tier models and effort per stage** — cheap for breadth, strong for synthesis and adversarial verification. Trap: `CLAUDE_CODE_SUBAGENT_MODEL` silently overrides the script's per-stage routing. `[OFFICIAL]` For anything beyond model and effort — tool scoping, permission mode, max turns, preloaded skills — you need a subagent definition referenced by `agentType`; see §4.6, including the reported bug that makes tool restriction unreliable inside workflows.
7. **Prefer many small agents to a few long ones** — for resume economics, not just parallelism.
8. **No silent caps.** If the script truncates a list, samples, or drops nulls, `log()` it. `parallel()` resolving failures to `null` plus a reflexive `.filter(Boolean)` is a silent-failure vector by default — log `results.length - valid.length`.
9. **Every loop needs a guard** — a dry counter, a budget check, or a max round count.
10. **Iterate via `scriptPath` + `resumeFromRunId`.** Edit the persisted script, re-invoke; the unchanged prefix returns from cache instantly. Adding a stage is nearly free.

**Tyler Folkman's workflow contract** is the sharpest go/no-go test published — if you can't state all five, the workflow will be vague:

> **objective · boundaries · role map · evidence standard · stop rule**

---

## 7. Use cases

Ranked by citation frequency across Anthropic's material, trade press and practitioner write-ups, weighted toward cases with measured rather than illustrative examples.

### #1 Codebase-wide audits, bug sweeps, security review
The most-cited category. Enumerate every unit → fan out one auditor per unit → independent skeptic per finding. A single agent hits laziness at item 35 of 50 and self-grades; here the finder and refuter are different agents and the loop is code.

> `use a workflow to audit every route handler under src/routes/ for missing authentication checks, and adversarially verify each finding before reporting it`

**Klarna** (Alessio Vallero, Sr. Eng Manager): strongest at *"discovery and review tasks across large codebases"*; found dead code that static analysis missed. `[Qualitative — no numbers published]`

### #2 Large migrations, language ports, mechanical refactors
The flagship demo and the only category with instrumented public numbers. Rulebook + dependency map → stress-test the rules on a small sample → translate every file in parallel worktrees → compiler and tests as the referee → error queue as a self-writing work list.

### #3 Deep research with cross-checked sources
`/deep-research` — the only bundled workflow, and the most common non-engineer entry point. Claims are voted on by verifiers that never saw the drafting context; unsupported claims are filtered *before you read them*.

One instrumented run `[REPORTED]`: question → 5 angles → 19 sources → 85 claims extracted → 75 refuter agents on the top 25 claims (3 each) → **18 survived, 7 eliminated**. 101 agents, 13 minutes, 723 searches and page reads.

Practitioner consensus: **specific and bounded beats open-ended.** "What are the current tradeoffs between transformer and state-space models for long-context inference?" works; "tell me about ML" wastes the fan-out.

### #4 Plan generation and red-teaming via judge panels
One agent asked for "three perspectives" gives you three variations of its own voice. Separate context windows give genuinely independent angles.

> `Take my business plan and run a workflow where different agents tear it apart from an investor's, a customer's, and a competitor's perspective.`

### #5 PR / code review at scale
One reviewer per changed file or per dimension, then one merger agent that ranks and dedupes. This is *the* canonical save-and-reuse case — a review you run on every branch.

### #6 Flaky test hunting
Anthropic's showcase for loop-until-done. Reproduction needs many runs a conversation won't sit through, and independent hypothesis agents avoid the anchoring that makes one agent commit to its first theory.

> `This test fails maybe 1 in 50 runs. Set up a workflow to reproduce it. Form competing theories about the race, and don't stop until one theory survives the evidence.`

### #7 Incident and support triage
Blind-angle investigation (diffs / logs / config / deps) then synthesis; or classify → dedupe against tracked issues → route, with quarantine for untrusted content.

> `Use a workflow to dig through #incidents in Slack for the past six months and find recurring root causes where nobody has filed a ticket.`

### #8 Qualitative ranking at volume (tournaments)
The best non-engineering shape. 80 resumes, 1,000 support tickets by severity, proposals, generated candidates.

> `Here's a folder of 80 resumes, use a workflow to rank them for the backend role and double-check the top ten. Interview me using the AskUserQuestion tool for a rubric.`

Note the rubric-elicitation step — interview the human *first*, then rank.

### #9 Claim verification against ground truth
Extract every factual claim → one verifier per claim pointed at the actual source → report only what survives. Self-review is worthless here by construction.

> `Go through my blog post draft and verify every technical claim against the codebase using a workflow, I don't want to ship anything wrong.`

### #10–14 The rest of the long tail
Documentation generation and docs-vs-code drift; dependency CVE/license audits; type-check and build-error burndown (`keep fixing until tsc passes or two rounds make no progress`); release-note generation; **mining your own sessions** (`go through my last 50 sessions and mine them for corrections I keep making and turn the recurring ones into CLAUDE.md rules` — one practitioner run: 49 sessions, 86 corrections, 10 parallel extraction agents).

### 7.1 Non-engineering: the PM playbook

The deepest treatment is [Product Compass](https://www.productcompass.pm/p/claude-code-dynamic-workflows). Their worked example — **100 customer interviews end to end**: one agent per interview extracts structured opportunities → clustering agents collapse synonyms into canonical needs → scoring by frequency and satisfaction → ideation → prototyping the top-ROI candidates.

`[REPORTED]` **113 agents, 1.95M tokens, 12.5 minutes, 622 raw opportunities → 11 canonical needs → 3 working HTML prototypes.** Their framing is the cleanest summary of the whole feature: *"the model did the judgment, the code did the coordination"* — routing, scoring, stopping and ordering cost zero model tokens.

Other named PM shapes: check 80 user stories against INVEST as a loop-until-done (explicitly to prevent early stopping); pressure-test a PRD with adversarial agents before the review; triage inbound as classify-and-act.

⚠️ Most "Claude Code for non-developers" posts describe plain single-agent file work, not workflows. Don't count them.

---

## 8. Case studies with numbers

> **Precision warning.** The headline Bun numbers are widely misquoted. Anthropic's launch post says 750K lines / 99.8% tests / **eleven days**; the PR and detailed write-ups say **1,009,272 lines added over 11 days** from 535,496 lines of Zig across 1,448 files. Quote the source you cite.

### Bun: Zig → Rust (Jarred Sumner, May 3–14 2026)

| Metric | Figure |
|---|---|
| Source | 535,496 lines of Zig, 1,448 files |
| Output | ~1,009,272 lines added (Anthropic's post says "750,000 lines of Rust") |
| Duration | 11 days |
| Commits | ~6,500; peak **695 commits/hour** |
| Peak concurrency | **64 Claude instances** across ~50 dynamic workflows (4 worktrees × 16 agents) |
| Tokens | 5.9B uncached input, 690M output, 72B cached reads |
| Cost | **~$165,000** at API pricing (~$15k/day) |
| Tests | 60,624 tests, 1,386,826 `expect()` calls, **0 skipped or deleted** |
| Result | 99.8%–100% pass (sources differ), 19 post-merge regressions since fixed, 128 memory bugs fixed, 2–5% faster, ~20% smaller binary |

The orchestration unit was **one implementer paired with adversarial reviewers**, with the reviewer instruction: *"The reviewer's only job: find bugs & reasons why the code does not work."*

Two quotes that matter more than the numbers:

> "For most of those 11 days (and after), I monitored workflows — manually reading the outputs to check for issues and bugs." — Sumner

> Governing principle: *"Fixing the process that generates the code instead of hand-fixing the code."* When agents failed, he edited the workflow, not the diff.

`[CONTESTED]` Andrew Kelley, Zig's creator, called the result "unreviewed slop" ([The Register, 14 July 2026](https://www.theregister.com/devops/2026/07/14/zig-creator-calls-buns-claude-rust-rewrite-unreviewed-slop/5270743)). The Zig Software Foundation had already banned AI-generated submissions. Treat this case as contested, not settled.

### Anthropic internal: Python → TypeScript

165,000 lines translated over one weekend; **27M tokens**; 8 phases with **3 adversarial review rounds**; 12 Sonnet subagents for implementation fan-out; build time 8 minutes → ~2 seconds. Model routing: strongest model as orchestrator and for complex review, Sonnet for high-volume fan-out. Stated lessons: *"front-load the human hours"* on the rulebook and stress testing; *"adversarial review allows for longer running tasks"*; work must be **mechanical and resumable**, with completion defined by artifacts on disk. Anti-pattern: never hand-patch code against the rules — amend the rulebook and regenerate the affected batch.

### The New Stack (independent, small-scale, fully measured)

Built a `codebase-health` CLI: 5 parallel agents, **6 min 59 s**, **109,237 tokens**, est. **$3–5**, 62 passing tests. Verdict: *"Dynamic workflows do live up to their hype"* — with the caveat that output required expert refinement. This is the most useful datapoint for calibrating a *normal* run.

### Anthropic's own Claude Code team (from the HN thread)

~15% token-efficiency improvement in Claude Code itself; native modules ported to TypeScript with 2–10× CPU/memory gains; 45% reduction in permission-prompt false positives; 61% faster Agent SDK startup; a simplification sweep producing **69 PRs deleting 10,000+ lines**.

### The control case worth knowing

vjeux ported ~100K lines TypeScript → Rust in about a month using **a single continuously-running Claude Code instance** — no workflows — with `BATTLE_TODO.md` plus grep-based TODO discovery as a hand-rolled deterministic queue, and prompts that are literally hand-written anti-laziness clauses (*"YOU CANNOT skip a method because it is too hard"*). His verdict: *"it still feels like a tool that requires my engineering expertise and constant babysitting."* This is the best available evidence for **what dynamic workflows actually automate** — he built the harness by hand.

---

## 9. Costs, failure modes, and the honest criticisms

### 9.1 What it costs

| Datapoint | Confidence |
|---|---|
| ~850K tokens vs 120–180K for the same 40-file audit = **5–7× multiplier** | `[REPORTED, illustrative]` |
| ~1.05M tokens for one `/deep-research` run in 8 minutes | `[REPORTED]` |
| 2K–20K tokens per `agent()` call; the orchestrator script itself costs **zero** | `[SINGLE-SOURCE]` |
| **1.7M tokens, zero output** — an ultracode run where one agent looped; the proposed cache-and-rerun never executed; no refund | `[REPORTED, single incident]` |
| ~19K tokens per fetch agent; 26 completed agents re-run on a failed resume ≈ 500K tokens re-spent | `[High confidence — measured from a real journal in a bug report]` |
| ~2 billion tokens to migrate Pixel Dungeon Java→C# on a self-built workflow clone | `[REPORTED]` |
| Baseline for contrast: enterprise average ~**$13/dev/active day** | `[OFFICIAL]` |

Guardrails are **all advisory**: the >25-agent / >1.5M-token "Large workflow" warning doesn't pause anything and is suppressed entirely under ultracode; the `/config` size guideline (`small` <5, `medium` <15, `large` <50) is sent to Claude as advice and overridden by an explicit prompt. There is **no hard spend cap and no refund path**. Anthropic's actual mitigation advice is *pilot on a slice first* — one directory, one narrow question.

### 9.2 The documented defects

- **Flaky resume, two open issues.** Session auto-compaction creates a new session ID while `journal.jsonl` stays under the old one → 0% cache hit → silent restart from Phase 1, hours later. A second issue shows completed agents re-running with `fetch:unknown` labels, i.e. **non-deterministic cache-key construction inside the runtime itself** — the exact hazard the `Date.now()` ban exists to prevent. The reporters' request is the right one: *fail loudly on cache miss instead of silently re-spending*.
- **`args` arriving as a raw JSON string** instead of parsed data, contradicting documented behavior. Workaround: `typeof args === 'string' ? JSON.parse(args) : args`.
- **Verification reporting infrastructure failures as refutations** — 19 claims killed by rate limiting were reported as "refuted." Partially fixed in v2.1.196, but only for `/deep-research`.
- **The feature has been patched in flight for two months** (v2.1.196, .202, .203, .208, .210, .216, .218). Pin your expectations to your version.

### 9.3 The substantive criticisms

- **Wrong axis of improvement.** *"My limiting factor is not how quickly Claude can self-trudge through code. It's whether Claude is going to do the task correctly."* The requests are for mid-run correction and rollback — exactly what the no-mid-run-input constraint forecloses.
- **"Tokenmaxxing disguised as a product."** The blunt version of the cost objection.
- **Verification theater.** The sharpest counter to the adversarial-verification pitch: an agent *"broke the test harness badly enough that none of the tests mattered for 3 weeks. They did pass, though, so CI never complained."* More agents checking each other doesn't help if the **oracle** is compromised. The cheap version of the same failure: N identical skeptics instead of diverse lenses.
- **Verification debt.** Mitch Ashley's framing, and the best one-liner on the real cost: **"Parallel agent orchestration moves the hard problem from writing code to confirming it is correct."**
- **Concurrency starvation.** A script scheduling 200 agents is mostly a queue at 8–16 wide; wall-clock gains flatten fast.
- **"Deterministic orchestration" is a half-truth.** The *control path* is deterministic and replayable. The *agent outputs* are not.
- **Attribution doubt on the flagship.** Skeptics argue mechanical refactors are straightforward for agents regardless of orchestration, so Bun may not be evidence for workflows specifically.

### 9.4 When NOT to use one

1. One agent, one task — wrapping a single `agent()` call is pure overhead.
2. The steps are reusable *procedure*, not *structure* — that's a **Skill**.
3. Simple refactors and two-line bug fixes.
4. Tightly sequential dependencies — parallelism only pays when pieces are independent.
5. You need to steer mid-run, or you're doing exploratory debugging with a feedback loop.
6. Open-ended loops with no budget guard.
7. You can't write strong schemas between phases — a signal it's really one conversation.
8. You want an answer in under ten minutes, or token cost is constrained.
9. Anything requiring private credentials in agent context.
10. Vague requests ("make this better") and tasks *"where you cannot define evidence."*

---

## 10. Where this sits among the alternatives

### Inside Claude Code

- **Subagents vs workflows** is context-window economics, not capability. Subagent summaries land in your context — cheap, but they accumulate and eventually compact. Workflow results never enter it — scales, but you lose Claude's judgment over intermediates.
- **Agent teams** (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) are the only option with inter-agent messaging and teammates that survive interruption. They **don't** isolate teammates in worktrees, so you partition file ownership manually. ~7× tokens vs a standard session in plan mode. 3–5 teammates recommended.
- **Hooks + slash commands** are the deterministic, near-zero-token alternative for the mechanical parts. A `PreToolUse` hook grepping a 10k-line log down to ERROR lines cuts context from tens of thousands of tokens to hundreds with no agent at all. **For any workflow step that is really "filter/transform," a hook or a plain pipeline stage beats an `agent()` call.**
- **Headless `claude -p` + shell loops** give you what workflows structurally cannot: real filesystem/shell access in the orchestrator, any language, `Date.now()`, per-invocation budget caps, cross-session durability, and mid-loop human gates. You give up journaled resume, the progress UI, and free context isolation. Note the governance difference: in `-p` and the SDK, workflow runs **start with no approval prompt at all**.

### Outside Anthropic

- **LangGraph / CrewAI / AutoGen / OpenAI Agents SDK** — you own the node code, checkpointing, provider choice, and human-in-the-loop insertion at any node. All four are dynamic-workflow limitations. The cost is that you write and maintain the harness.
- **Temporal / Airflow-style durable orchestration** — the sharpest contrast. Dynamic workflows *borrow* the durable-execution idiom (deterministic replay + journal, which is precisely why `Date.now()` is banned) but implement a fraction of the guarantees: the journal is scoped to one CLI session, dies on exit, and breaks on auto-compaction. Temporal gives cross-process, multi-day durability with retries, timeouts, **signals (= mid-run input)** and queries. If you need any of those, the resemblance is superficial.
- **Git-worktree parallel-Claude tools** (Conductor, Crystal, Vibe Kanban, Claude Squad, Emdash) solve the *parallel-branches-and-PRs* problem; dynamic workflows solve the *one-answer-from-many-agents* problem. Different axes — they compose.
- **Cross-provider clones already exist**: [codex-dynamic-workflows](https://github.com/six-ddc/codex-dynamic-workflows) and [pi-dynamic-workflows](https://github.com/QuintinShaw/pi-dynamic-workflows) reimplement `agent()/parallel()/pipeline()` on other backends. The Codex clone explicitly *allows* `Date.now()`/`Math.random()`, accepting "best-effort" resume as the price — which is a neat confirmation of why Anthropic banned them.

**Bottom line on positioning:** dynamic workflows are **a deterministic control-flow shell around non-deterministic workers, with journal-based replay, scoped to one interactive session, on one provider.** Against a real DAG engine they lose durability, human-in-the-loop signals, retry policies, external triggering, multi-provider and observability integration. What they buy that no DAG engine does: **Claude authors the DAG for you at runtime, and you operate zero infrastructure.** That is the entire trade — zero setup cost, zero durability guarantees.

---

## 11. Governance and security

| Control | Scope |
|---|---|
| `/config` → Dynamic workflows off | Per user, persists |
| `"disableWorkflows": true` in `~/.claude/settings.json` | Per user, persists |
| `CLAUDE_CODE_DISABLE_WORKFLOWS=1` | Read at startup |
| `"disableWorkflows": true` in managed settings, or the Claude Code admin page | Org-wide |

When disabled: bundled workflow commands vanish, `ultracode` stops triggering, and `ultracode` disappears from the `/effort` menu.

**Approval by permission mode** `[OFFICIAL]`:

| Mode | Prompted? |
|---|---|
| Default / acceptEdits | Every run, unless "don't ask again for `<name>` in `<path>`" |
| Auto | **First launch only**; consent is recorded in user settings. **Skipped entirely under ultracode** |
| Bypass permissions, `claude -p`, Agent SDK | **Never — the run starts immediately** |

**The caveat that catches people:** your permission mode controls *only the launch prompt*. The subagents **always run in `acceptEdits`** and inherit your tool allowlist regardless of session mode — file edits auto-approve. A workflow launched from a session that *feels* read-only still gets up to 16 agents writing files concurrently. Approval is **per-launch, not per-edit**. And per §4.6, per-agent tool restriction via `agentType` is reportedly not honoured inside workflows — so `permissions.deny` or a `PreToolUse` hook is the only least-privilege control you can currently count on.

Shell, web-fetch and MCP calls outside your allowlist can still prompt mid-run and stall a long run behind a modal. Anthropic's advice is to pre-allowlist everything the agents need — a direct security/convenience trade.

The right posture, per operators: treat the generated script as **a reviewed artifact, not invisible chat state** (`Ctrl+G` opens it; every run persists under `~/.claude/projects/`; diff it against previous runs), and require **deterministic quality gates** — tests, lint, review policy — rather than trusting agent-to-agent verification alone.

---

## 12. A practical path in

1. **`/deep-research <a specific, bounded question>`** — the cheapest way to see the whole model (fan-out → cross-check → vote → cited report) without writing anything.
2. **Run one scoped audit** on a single directory: `use a workflow to audit every route handler under src/routes/ for missing auth checks, and adversarially verify each finding before reporting it`. Watch it in `/workflows`. Read the generated script with `Ctrl+G` — this is where the concept actually clicks.
3. **Set `/config` → Dynamic workflow size = medium** while you calibrate, and check `/model` before anything large.
4. **Save the one that worked** (`s` in `/workflows`) and turn your recurring process — branch review, PRD pressure-test, release notes — into `/<name>`.
5. **Then reach for `/effort ultracode`** only when the task genuinely warrants Claude deciding to orchestrate on its own.
6. Before writing any workflow prompt, state the five contract elements: **objective, boundaries, role map, evidence standard, stop rule.** If you can't, you don't have a workflow yet.

---

## Sources

**Anthropic official**
- [Orchestrate subagents at scale with dynamic workflows — Claude Code docs](https://code.claude.com/docs/en/workflows)
- [Introducing dynamic workflows in Claude Code](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)
- [A harness for every task: dynamic workflows in Claude Code](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code)
- [How Anthropic runs large-scale code migrations with Claude Code](https://claude.com/blog/ai-code-migration)
- [How Anthropic teams use Claude Code](https://claude.com/blog/how-anthropic-teams-use-claude-code)
- [Agent SDK — TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — frontmatter reference for `tools`, `disallowedTools`, `model`, `permissionMode`, and the built-in read-only types
- [Manage costs](https://code.claude.com/docs/en/costs) · [Run agents in parallel](https://code.claude.com/docs/en/agents) · [Tools reference](https://code.claude.com/docs/en/tools-reference)

**Trade press**
- [InfoQ — Claude Code Adds Dynamic Workflows for Parallel Agent Coordination](https://www.infoq.com/news/2026/06/dynamic-workflows-claude-code/)
- [DevOps.com — Dynamic Workflows Take on the Tasks That Were Too Big to Automate](https://devops.com/claude-codes-dynamic-workflows-take-on-the-tasks-that-were-too-big-to-automate/)
- [The New Stack — hands-on test with 5 parallel agents](https://thenewstack.io/claude-code-dynamic-workflows-test/)
- [The Register — Zig creator calls Bun's Claude Rust rewrite 'unreviewed slop'](https://www.theregister.com/devops/2026/07/14/zig-creator-calls-buns-claude-rust-rewrite-unreviewed-slop/5270743)
- [The Neuron — Dynamic Workflows explained by team Anthropic](https://www.theneuron.ai/explainer-articles/claude-code-dynamic-workflows-explained-claude-can-now-build-its-own-workflow-around-a-task/)

**Technical deep-dives (the best community sources)**
- [alexop.dev — Claude Code Workflows: Deterministic Multi-Agent Orchestration](https://alexop.dev/posts/claude-code-workflows-deterministic-orchestration/)
- [FlorianBruniaux — claude-code-ultimate-guide / dynamic-workflows.md](https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/guide/workflows/dynamic-workflows.md)
- [ClaudeWorld — What Is a Workflow?](https://claude-world.com/articles/what-is-a-workflow-multi-agent-orchestration/)
- [claudefa.st — Dynamic Workflows in Claude Code: How They Work](https://claudefa.st/blog/guide/development/dynamic-workflows)
- [Developers Digest — Dynamic Workflows: The Complete Guide](https://www.developersdigest.tech/blog/claude-code-dynamic-workflows-guide)
- [Awesome Claude — Guide + 24 copy-paste scripts](https://awesomeclaude.ai/claude-code-workflows)
- [movez — Master Dynamic Workflows: 6 patterns and 14 steps](https://movez.substack.com/p/master-dynamic-workflows-in-claude)

**Case studies and practice**
- [Developers Digest — How Bun coordinated 64 concurrent Claude agents](https://www.developersdigest.tech/blog/bun-rust-rewrite-agent-fleet-case-study)
- [Product Compass — Dynamic Workflows for PMs](https://www.productcompass.pm/p/claude-code-dynamic-workflows)
- [Build to Launch — instrumented /deep-research run](https://buildtolaunch.substack.com/p/claude-code-dynamic-workflows-guide)
- [Tyler Folkman — Don't use them like an intern swarm](https://tylerfolkman.substack.com/p/claude-code-workflows-are-here-dont)
- [AI Practitioner — Scaling complex work through orchestration](https://aipractitioner.substack.com/p/claude-dynamic-workflows-scaling)
- [artemx.tech — Dynamic workflows for your second brain](https://artemxtech.substack.com/p/claude-dynamic-workflows-for-your)
- [vjeux — Porting 100k lines TS→Rust with Claude Code in a month](https://blog.vjeux.com/2026/analysis/porting-100k-lines-from-typescript-to-rust-using-claude-code-in-a-month.html)

**Discussion and reimplementations**
- [Hacker News — Dynamic Workflows in Claude Code (#48311705)](https://news.ycombinator.com/item?id=48311705)
- [anthropics/claude-code #65796 — resume cache miss after auto-compaction](https://github.com/anthropics/claude-code/issues/65796) · [#67488 — re-run completed agents, args as string](https://github.com/anthropics/claude-code/issues/67488) · [#63938 — concurrency limit](https://github.com/anthropics/claude-code/issues/63938) · [#63762 — workflows ignore the subagent `tools` allowlist](https://github.com/anthropics/claude-code/issues/63762) · [#63693 — no model routing for auto-generated workflows](https://github.com/anthropics/claude-code/issues/63693)
- [six-ddc/codex-dynamic-workflows](https://github.com/six-ddc/codex-dynamic-workflows) · [QuintinShaw/pi-dynamic-workflows](https://github.com/QuintinShaw/pi-dynamic-workflows)