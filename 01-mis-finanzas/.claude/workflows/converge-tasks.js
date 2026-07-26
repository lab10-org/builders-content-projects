export const meta = {
  name: 'converge-tasks',
  description:
    "Converge any spec's tasks.md with parallel read-only planners; a single final step writes the file once",
  whenToUse:
    'When a spec has approved requirements.md + design.md and you want its tasks.md created/iterated/audited. Pass the spec folder as args, or let the scout resolve it. Emulates the /planning-tasks skill as a fan-out workflow.',
  phases: [
    { title: 'Scout', detail: 'resolve spec folder, mode, and task IDs (read-only)' },
    { title: 'Bootstrap', detail: 'draft the initial task list if none exists (read-only planner)' },
    { title: 'Evaluate', detail: 'one read-only planner per task, in parallel' },
    { title: 'Synthesize', detail: 'merge proposals into the next in-memory task list (no write)', model: 'sonnet' },
    { title: 'Write', detail: 'the ONLY writer: persist tasks.md once and verify', model: 'sonnet' },
  ],
}

// ---------------------------------------------------------------------------
// Schemas — every phase hands typed data to the next.
// ---------------------------------------------------------------------------

const SCOUT_SCHEMA = {
  type: 'object',
  required: ['specFolder', 'mode'],
  properties: {
    specFolder: { type: 'string', description: 'repo-relative path to docs/specs/<date>-<feature>/' },
    mode: { type: 'string', enum: ['from-scratch', 'iterative', 'blocked'] },
    taskIds: { type: 'array', items: { type: 'string' }, description: 'non-Done task IDs, in order (empty if from-scratch)' },
    tasksMd: { type: 'string', description: 'current full tasks.md content when iterative, else ""' },
    blockedReason: { type: 'string', description: 'why the run cannot proceed (missing/unapproved requirements.md or design.md)' },
    notes: { type: 'string' },
  },
}

const BOOTSTRAP_SCHEMA = {
  type: 'object',
  required: ['tasksMd', 'taskIds'],
  properties: {
    tasksMd: { type: 'string', description: 'full drafted tasks.md content (NOT written to disk)' },
    taskIds: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const EVAL_SCHEMA = {
  type: 'object',
  required: ['taskId', 'verdict', 'proposedTask', 'changed'],
  properties: {
    taskId: { type: 'string' },
    verdict: { type: 'string', enum: ['CRITERIA MET', 'NEEDS ITERATION'] },
    proposedTask: { type: 'string', description: 'full proposed markdown for this task section; if no change, echo the current section' },
    changed: { type: 'boolean', description: 'true if proposedTask differs from the current section' },
    remove: { type: 'boolean', description: 'true if this task should be deleted' },
    splitInto: { type: 'array', items: { type: 'string' }, description: 'new task IDs if this task must split (e.g. ["T3a","T3b"])' },
    coverageFindings: { type: 'string', description: 'deltas needed in Task overview / Requirements coverage table, or ""' },
    crossTaskFindings: { type: 'string', description: 'problems in OTHER tasks or in ordering/dependencies, or ""' },
    userDecision: { type: 'string', description: 'a spec gap or open question only the user can decide, or ""' },
  },
}

const SYNTH_SCHEMA = {
  type: 'object',
  required: ['tasksMd', 'taskIds', 'allConverged'],
  properties: {
    tasksMd: { type: 'string', description: 'the next full task list text, with all proposals merged and overview/coverage kept in sync (NOT written to disk)' },
    taskIds: { type: 'array', items: { type: 'string' }, description: 'task IDs after any split/removal, in order' },
    allConverged: { type: 'boolean', description: 'true only if every non-Done task is CRITERIA MET with no pending change' },
    pendingTaskIds: { type: 'array', items: { type: 'string' }, description: 'tasks still needing another round' },
    userDecisions: { type: 'array', items: { type: 'string' } },
    changes: { type: 'string', description: 'one-line-per-task summary of what changed this round' },
  },
}

const WRITE_SCHEMA = {
  type: 'object',
  required: ['written', 'report'],
  properties: {
    written: { type: 'boolean' },
    path: { type: 'string' },
    coverageInSync: { type: 'boolean' },
    report: { type: 'string', description: 'user-facing summary: tasks converged, notable changes, remaining gaps' },
    remainingGaps: { type: 'array', items: { type: 'string' } },
  },
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const CRITERIA = `The four criteria (from .claude/agents/planner.md — read it for the authoritative version):
1. SIZE — one task = one red→green→verify TDD cycle (a nameable failing test, the smallest implementation, then \`npm run typecheck\` && \`npm test\`). Split multi-behavior tasks; merge trivially-small ones.
2. SPEC ALIGNMENT — the Objective and TDD plan must actually verify the requirement criteria the task traces to.
3. COMPLETENESS — every acceptance criterion maps to at least one real task; add work the design implies but no criterion names (scaffolding, wiring, test setup).
4. NECESSITY — drop tasks the codebase already satisfies, duplicates, or out-of-scope work.
Also: no task depends on a later task; \`Depends on\` lists real prerequisites only.`

function scoutPrompt(requestedFolder) {
  return `You are the SCOUT for a task-planning workflow. READ-ONLY: do not modify any file.

${requestedFolder ? `The caller named this spec folder: ${requestedFolder}` : 'The caller did not name a spec folder.'}

Do this:
1. Resolve the spec folder under docs/specs/ (if not named, run \`ls docs/specs/\`; if exactly one exists use it; if several and it is ambiguous, pick the most recent by date-prefixed name and say so in notes). It may live under a subproject (e.g. 01-mis-finanzas/docs/specs/...) — return the path that actually exists.
2. Verify requirements.md AND design.md exist in that folder. If either is missing, return mode:"blocked" with blockedReason pointing the user to /specify.
3. Read tasks.md if present:
   - Missing, empty, a bare template, or explicitly marked "re-plan" → mode:"from-scratch", taskIds:[], tasksMd:"".
   - Has real tasks → mode:"iterative". Return the FULL current tasks.md content in tasksMd, and taskIds = every task ID in the Task overview whose status is NOT \`[x] Done\`, in order.
4. Never include \`[x] Done\` tasks in taskIds — they are historical fact, out of scope.

Return the SCOUT schema.`
}

function bootstrapPrompt(specFolder) {
  return `You are a PLANNER in bootstrap mode. READ-ONLY: you have no Edit/Write tools; return the draft as text, do not create files.

Spec folder: ${specFolder}
Mode: bootstrap

${CRITERIA}

Ground yourself first: read requirements.md and design.md fully, survey the codebase (Glob/Grep for the modules the design names, package.json, recent git log), then draft the full tasks.md following .claude/skills/specify/assets/tasks-template.md — header, Purpose, How to use, Status legend, Task overview, Requirements coverage (every criterion mapped), detailed tasks (Status, Traces to, Depends on, Objective, TDD plan; leave Decision log and Outcome empty), Open items. Mark it \`**Status:** Draft\`, write it in English, keep domain identifiers verbatim.

Return the BOOTSTRAP schema: tasksMd = the complete drafted file, taskIds = every task ID in order.`
}

function evalPrompt(specFolder, taskId, tasksMd, round) {
  return `You are a PLANNER evaluating exactly ONE task. READ-ONLY: you have no Edit/Write tools — return proposed text, never touch the file. Other planners are evaluating other tasks of the SAME snapshot in parallel; that is why you must not write.

Spec folder: ${specFolder}
Task to evaluate: ${taskId}
Round: ${round}

${CRITERIA}

The AUTHORITATIVE current task list is pasted below (the file on disk is NOT updated between rounds — writing is deferred to the final step, so evaluate THIS text, not the disk file). Still read requirements.md, design.md, and the real codebase to ground your judgment.

<CURRENT_TASKS_MD>
${tasksMd}
</CURRENT_TASKS_MD>

Evaluate ONLY ${taskId} against the four criteria and return the EVAL schema:
- verdict: CRITERIA MET (passes all four; no meaningful change needed) or NEEDS ITERATION.
- proposedTask: the FULL markdown for ${taskId}'s detailed section as it SHOULD read (if nothing should change, echo the current section verbatim).
- changed: true only if proposedTask differs from the current section.
- remove: true if ${taskId} is unnecessary (already satisfied by the codebase, duplicate, or out of scope) — explain in coverageFindings.
- splitInto: if ${taskId} must split, the new IDs (prefer suffixes like ${taskId}a/${taskId}b) and put each new section in proposedTask.
- coverageFindings: any deltas the synthesizer must make to the Task overview / Requirements coverage table to stay in sync.
- crossTaskFindings: problems you noticed in OTHER tasks or in ordering/dependencies (do not rewrite them — just report).
- userDecision: a spec gap or open question only the user can decide, or "".

Do not invent objections to keep iterating. Never propose editing a task whose status is \`[x] Done\`.`
}

function synthPrompt(specFolder, tasksMd, evals, round) {
  return `You are the SYNTHESIZER for round ${round}. READ-ONLY: you have no Edit/Write tools — you produce the NEXT version of the task list as text; nothing is written to disk here (that happens once, at the very end).

Spec folder: ${specFolder}

You are given the current task list and one proposal per task from the parallel planners. Merge them into a single coherent next version:
- Replace each task's section with its proposedTask; delete tasks marked remove; expand splits (splitInto) into their new sections; keep numbering/ordering coherent.
- Reconcile crossTaskFindings and coverageFindings: keep the Task overview and the Requirements coverage table fully in sync with the detailed tasks — every acceptance criterion still maps to a real task, no task depends on a later one.
- Resolve conflicts between proposals conservatively and note them in changes.
- Collect every non-empty userDecision into userDecisions (do NOT invent answers — the user decides these).
- allConverged = true ONLY if every non-Done task in the result is CRITERIA MET with changed=false and no unresolved coverage gap or userDecision. Otherwise list the still-open tasks in pendingTaskIds.

<CURRENT_TASKS_MD>
${tasksMd}
</CURRENT_TASKS_MD>

<PLANNER_PROPOSALS_JSON>
${JSON.stringify(evals)}
</PLANNER_PROPOSALS_JSON>

Return the SYNTH schema. tasksMd must be the COMPLETE next task list (not a diff).`
}

function writePrompt(specFolder, tasksMd, userDecisions, rounds) {
  return `You are the FINAL WRITER — the ONLY step in this workflow that writes to disk.

Write the following content VERBATIM to ${specFolder}/tasks.md (create or overwrite it). Then read it back and verify the Task overview, the detailed tasks, and the Requirements coverage table are mutually in sync and every acceptance criterion maps to a real task. If you find a minor desync, fix it in the file and note it; if a criterion has no task at all, do NOT invent one — record it in remainingGaps.

${userDecisions && userDecisions.length ? `Open questions the planners surfaced for the user (append them under "Open items" in the file and echo them in remainingGaps):\n- ${userDecisions.join('\n- ')}` : 'No open user decisions were surfaced.'}

Convergence ran ${rounds} round(s). Produce a concise user-facing report: how many tasks, notable changes (splits/removals/rewrites), whether coverage is complete, and any remaining gaps or user decisions.

<FINAL_TASKS_MD>
${tasksMd}
</FINAL_TASKS_MD>

Return the WRITE schema.`
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

// args may be a string (folder path), an object {specFolder}, or (per the
// known args-as-string bug) a JSON string — normalize all three.
let parsed = args
if (typeof parsed === 'string') {
  const s = parsed.trim()
  if (s.startsWith('{')) {
    try { parsed = JSON.parse(s) } catch (e) { /* keep as string */ }
  }
}
const requestedFolder =
  parsed && typeof parsed === 'object'
    ? parsed.specFolder || parsed.folder || parsed.spec || null
    : typeof parsed === 'string' && parsed.trim()
      ? parsed.trim()
      : null

phase('Scout')
const scout = await agent(scoutPrompt(requestedFolder), {
  agentType: 'Explore',
  schema: SCOUT_SCHEMA,
  phase: 'Scout',
  label: 'scout',
})
if (!scout) return { error: 'scout failed to return' }
if (scout.mode === 'blocked') {
  log(`Blocked: ${scout.blockedReason || 'requirements.md/design.md missing or unapproved'}`)
  return { blocked: true, reason: scout.blockedReason, specFolder: scout.specFolder }
}

const specFolder = scout.specFolder
let tasksMd = scout.tasksMd || ''
let taskIds = Array.isArray(scout.taskIds) ? scout.taskIds : []
log(`Spec: ${specFolder} · mode: ${scout.mode}`)

if (scout.mode === 'from-scratch') {
  phase('Bootstrap')
  const boot = await agent(bootstrapPrompt(specFolder), {
    agentType: 'planner',
    schema: BOOTSTRAP_SCHEMA,
    phase: 'Bootstrap',
    label: 'bootstrap',
  })
  if (!boot || !boot.tasksMd) return { error: 'bootstrap failed to return a draft', specFolder }
  tasksMd = boot.tasksMd
  taskIds = Array.isArray(boot.taskIds) ? boot.taskIds : []
  log(`Bootstrap drafted ${taskIds.length} task(s).`)
}

if (!taskIds.length) {
  log('No tasks to converge (empty task list).')
}

const MAX_ROUNDS = 2
const userDecisions = []
let round = 0
let converged = false

while (round < MAX_ROUNDS && taskIds.length) {
  round++
  phase('Evaluate')
  // Fan-out: one read-only planner per task. Barrier is required — the
  // synthesizer needs every proposal at once to merge and keep coverage in sync.
  const snapshot = tasksMd
  const evals = (
    await parallel(
      taskIds.map(t => () =>
        agent(evalPrompt(specFolder, t, snapshot, round), {
          agentType: 'planner',
          schema: EVAL_SCHEMA,
          phase: 'Evaluate',
          label: `R${round}:${t}`,
        }),
      ),
    )
  ).filter(Boolean)

  if (!evals.length) {
    log(`Round ${round}: no planner returned; stopping the loop.`)
    break
  }
  const met = evals.filter(e => e.verdict === 'CRITERIA MET' && !e.changed).length
  const dropped = taskIds.length - evals.length
  if (dropped > 0) log(`Round ${round}: ${dropped} planner(s) failed and were dropped.`)
  log(`Round ${round}: ${met}/${evals.length} task(s) CRITERIA MET before synthesis.`)

  phase('Synthesize')
  const synth = await agent(synthPrompt(specFolder, snapshot, evals, round), {
    agentType: 'planner',
    model: 'sonnet',
    schema: SYNTH_SCHEMA,
    phase: 'Synthesize',
    label: `R${round}:synth`,
  })
  if (!synth || !synth.tasksMd) {
    log(`Round ${round}: synthesis failed; keeping the pre-round task list.`)
    break
  }
  tasksMd = synth.tasksMd
  taskIds = Array.isArray(synth.taskIds) && synth.taskIds.length ? synth.taskIds : taskIds
  if (Array.isArray(synth.userDecisions)) userDecisions.push(...synth.userDecisions)
  log(`Round ${round}: ${synth.changes || 'merged proposals'}`)

  if (synth.allConverged) {
    converged = true
    log(`Converged after ${round} round(s).`)
    break
  }
}
if (!converged && round >= MAX_ROUNDS) {
  log(`Hit the ${MAX_ROUNDS}-round cap without full convergence — writing the best current version and surfacing what remains.`)
}

// De-dupe the user decisions collected across rounds (plain JS, zero tokens).
const uniqueDecisions = [...new Set(userDecisions.filter(Boolean))]

phase('Write')
// The ONLY writer in the whole workflow.
const write = await agent(writePrompt(specFolder, tasksMd, uniqueDecisions, round), {
  model: 'sonnet',
  schema: WRITE_SCHEMA,
  phase: 'Write',
  label: 'write-final',
})

return {
  specFolder,
  mode: scout.mode,
  rounds: round,
  converged,
  taskIds,
  written: write ? write.written : false,
  path: write ? write.path : `${specFolder}/tasks.md`,
  coverageInSync: write ? write.coverageInSync : null,
  userDecisions: uniqueDecisions,
  remainingGaps: write ? write.remainingGaps : [],
  report: write ? write.report : 'final write step did not return',
}
