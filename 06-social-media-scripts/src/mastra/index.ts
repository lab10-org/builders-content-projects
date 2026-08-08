import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { createInstagramClient } from '../lib/instagram'
import { createFfmpegExtractor } from '../lib/media'
import { createOpenRouterClients } from '../lib/openrouter'
import { createBinaryProbe } from '../lib/preflight'
import { listActors, loadActorProfile } from '../lib/profiles'
import { createFileRemover, type RunDeps } from './deps'
import { createProgressRecorder } from './progress'
import { generateScriptsWorkflow } from './workflows/generate-scripts'

export interface CreateMastraOptions {
  /** libsql url. `file::memory:` in tests; a file under `.mastra/` in the app. */
  storageUrl: string
  /** Tests assert an empty registry; the app registers the real workflow. */
  withWorkflows?: boolean
}

/**
 * libsql cannot create the database when its parent directory is missing — it
 * fails with SQLite error 14 the first time any route touches the store, which
 * is a 500 on a request that should have been a plain 404. Exported so the
 * behaviour is testable without booting the app.
 */
export function ensureStorageDir(storageUrl: string): void {
  // Only file-backed urls have a directory; `file::memory:` and `:memory:` do not.
  const path = storageUrl.startsWith('file:') ? storageUrl.slice('file:'.length) : storageUrl
  if (path === '' || path.startsWith(':')) return
  mkdirSync(dirname(path), { recursive: true })
}

export function createMastra({ storageUrl, withWorkflows = false }: CreateMastraOptions): Mastra {
  ensureStorageDir(storageUrl)
  return new Mastra({
    storage: new LibSQLStore({ url: storageUrl }),
    workflows: withWorkflows ? { generateScriptsWorkflow } : {},
  })
}

let singleton: Mastra | undefined

/**
 * The app's file-backed instance, built lazily on first use so that merely
 * importing this module never creates a `.mastra/` database — the unit suite
 * imports it and must stay hermetic.
 */
export function getMastra(): Mastra {
  singleton ??= createMastra({ storageUrl: 'file:.mastra/run-state.db', withWorkflows: true })
  return singleton
}

/** The workflow the API routes start and read. Exported from here so a route
 *  test can replace the whole module with one `vi.mock`. */
export function getGenerateScriptsWorkflow() {
  return generateScriptsWorkflow
}

/** Shared by every run in this process, so a poll can read the progress of a
 *  run started by an earlier request. */
const progressRecorder = createProgressRecorder()

export function getProgressRecorder() {
  return progressRecorder
}

/**
 * Reads a run from the store and narrows it to what `toRunView` needs.
 * Reconciling Mastra's record shape happens here rather than in the pure
 * mapper, so the mapper stays testable against hand-written values.
 */
export async function readRunRecord(runId: string): Promise<{
  input: { account: string; actor: string }
  snapshot: {
    status: 'running' | 'completed' | 'failed'
    ranked?: unknown
    result?: unknown
    error?: { code: string; message: string }
  }
} | null> {
  const record = await getMastra()
    .getStorage()
    ?.getWorkflowRunById({ runId, workflowName: 'generate-scripts' })

  if (!record) return null

  // The stored snapshot is typed as a union with a serialized string form;
  // reading it structurally is this function's whole job.
  const snapshot = record.snapshot as unknown as Record<string, unknown>
  const context = (snapshot?.context ?? {}) as Record<string, { output?: unknown }>

  return {
    input: (snapshot?.input ?? {}) as { account: string; actor: string },
    snapshot: {
      status:
        snapshot?.status === 'success'
          ? 'completed'
          : snapshot?.status === 'failed'
            ? 'failed'
            : 'running',
      ranked: (context.rank?.output as { ranked?: unknown } | undefined)?.ranked,
      result: context.assemble?.output,
      error: snapshot?.error as { code: string; message: string } | undefined,
    },
  }
}

/** Builds the real adapters for one run from the environment. */
export function buildRunDeps(runId: string): RunDeps {
  const sessionId = process.env.IG_SESSIONID ?? ''
  const apiKey = process.env.OPENROUTER_API_KEY ?? ''
  const { transcription, completion } = createOpenRouterClients({ apiKey })

  return {
    instagram: createInstagramClient({ sessionId }),
    media: createFfmpegExtractor(),
    transcription,
    completion,
    profiles: { listActors, loadActorProfile },
    env: { IG_SESSIONID: sessionId, OPENROUTER_API_KEY: apiKey },
    probe: createBinaryProbe(),
    profilesDir: join(process.cwd(), 'profiles'),
    tmpDir: join(process.cwd(), 'tmp', runId),
    runId,
    progress: progressRecorder,
    files: createFileRemover(),
  }
}
