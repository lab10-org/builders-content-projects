import type { RuntimeContext } from '@mastra/core/runtime-context'
import type { InstagramClient } from '../lib/instagram'
import type { AudioExtractor } from '../lib/media'
import type { CompletionClient, TranscriptionClient } from '../lib/openrouter'
import type { BinaryProbe, PreflightEnv } from '../lib/preflight'
import type { ActorProfile } from '../lib/profiles'
import type { ProgressRecorder } from './progress'

/**
 * Everything a step is allowed to reach for. Steps orchestrate; they never
 * import a client directly, which is what keeps the workflow suite runnable
 * with no network and no API keys.
 */
export interface RunDeps {
  instagram: InstagramClient
  media: AudioExtractor
  transcription: TranscriptionClient
  completion: CompletionClient
  profiles: {
    listActors(dir: string): Promise<string[]>
    loadActorProfile(dir: string, name: string): Promise<ActorProfile>
  }
  /** T20's preflight reads these. */
  env: PreflightEnv
  probe: BinaryProbe
  profilesDir: string
  /** Run-scoped temp directory; T14/T15 write into it, T18 cleans up. */
  tmpDir: string
  /** Identifies the run in the progress record. */
  runId?: string
  /** Records the step currently executing per reel, for 5.3. */
  progress?: ProgressRecorder
  /** Seam so T18's cleanup is assertable without touching the filesystem.
   *  The design names no filesystem interface; this one is introduced here. */
  files: FileRemover
}

export interface FileRemover {
  remove(path: string): Promise<void>
}

/** Default remover: `force` so an already-missing file is not an error. */
export function createFileRemover(): FileRemover {
  return {
    async remove(path) {
      const { rm } = await import('node:fs/promises')
      await rm(path, { force: true })
    },
  }
}

const KEY = 'runDeps'

export function withRunDeps(context: RuntimeContext, deps: RunDeps): void {
  context.set(KEY, deps)
}

/**
 * The single seam T14–T21 use instead of importing clients — the concrete form
 * of the design's "injected through the Mastra instance's dependency container".
 */
export function getRunDeps(context: RuntimeContext): RunDeps {
  const deps = context.get(KEY) as RunDeps | undefined
  if (!deps) {
    throw new Error(
      'No run dependencies on the runtime context. Call withRunDeps(context, deps) before starting the workflow.',
    )
  }
  return deps
}
