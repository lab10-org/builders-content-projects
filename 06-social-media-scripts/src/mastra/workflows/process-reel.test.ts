import { describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../../lib/preflight'
import { SchemaValidationError } from '../../lib/openrouter'
import type { PipelineStep } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { runProcessReel } from './process-reel'

const TMP = '/tmp/run-xyz'
const analysis = { objective: 'o', highlights: ['h'], targetAudience: 't' }
const script = { hook: 'h', body: 'b', closing: 'c' }
const profile = { name: 'juanse', markdown: '# juanse\n' }

const input: ReelState = {
  status: 'pending',
  rank: 2,
  shortcode: 'DAaaa',
  mediaId: '123',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 10, likes: 2, comments: 1 },
  profile,
}

/** All-fake adapters sharing one ordered call log. */
const makeDeps = (over: Record<string, unknown> = {}) => {
  const calls: string[] = []
  const log =
    <T>(name: string, value: T) =>
    async () => {
      calls.push(name)
      return value
    }
  const removed: string[] = []

  const deps = {
    tmpDir: TMP,
    instagram: {
      hydrateReel: vi.fn(
        log('hydrate', { caption: 'cap', videoUrl: 'https://cdn/v.mp4', durationSeconds: 30 }),
      ),
      downloadVideo: vi.fn(log('download', undefined)),
    },
    media: {
      extractAudio: vi.fn(log('extract-audio', { path: `${TMP}/DAaaa.mp3`, sizeBytes: 4096 })),
    },
    transcription: { transcribe: vi.fn(log('transcribe', 'what was said')) },
    completion: {
      complete: vi.fn(async ({ model }: { model: string }) => {
        const which = model.includes('opus') && calls.includes('analyze') ? 'generate' : 'analyze'
        calls.push(which === 'analyze' ? 'analyze' : 'generate-script')
        return which === 'analyze' ? analysis : script
      }),
    },
    files: { remove: vi.fn(async (p: string) => void removed.push(p)) },
    ...over,
  } as unknown as RunDeps

  return { deps, calls, removed }
}

describe('processReelWorkflow — happy path', () => {
  it('runs the steps in pipeline order and resolves to an ok outcome', async () => {
    const { deps, calls } = makeDeps()

    const outcome = await runProcessReel(input, deps)

    expect(calls).toEqual([
      'hydrate',
      'download',
      'extract-audio',
      'transcribe',
      'analyze',
      'generate-script',
    ])
    expect(outcome).toMatchObject({ status: 'ok', analysis, script })
  })

  it('projects onto ReelOutcome and nothing more', async () => {
    const { deps } = makeDeps()

    const outcome = await runProcessReel(input, deps)

    expect(Object.keys(outcome).sort()).toEqual(
      ['analysis', 'metrics', 'rank', 'script', 'shortcode', 'status', 'thumbnailUrl'].sort(),
    )
    expect(outcome).toMatchObject({
      rank: 2,
      shortcode: 'DAaaa',
      thumbnailUrl: 'https://cdn/t.jpg',
      metrics: { views: 10, likes: 2, comments: 1 },
    })
  })

  it('cleans up both temp files', async () => {
    const { deps, removed } = makeDeps()

    await runProcessReel(input, deps)

    expect(removed.sort()).toEqual([`${TMP}/DAaaa.mp3`, `${TMP}/DAaaa.mp4`].sort())
  })
})

describe('processReelWorkflow — a failure at each step resolves, never rejects (6.1)', () => {
  const boom = (message: string) => vi.fn().mockRejectedValue(new Error(message))

  const cases: Array<[PipelineStep, Record<string, unknown>, RegExp]> = [
    ['hydrate', { instagram: { hydrateReel: boom('no video URL'), downloadVideo: vi.fn() } }, /video URL/],
    [
      'download',
      {
        instagram: {
          hydrateReel: vi
            .fn()
            .mockResolvedValue({ caption: 'c', videoUrl: 'u', durationSeconds: 1 }),
          downloadVideo: boom('video not available (404)'),
        },
      },
      /404/,
    ],
    ['extract-audio', { media: { extractAudio: boom('moov atom not found') } }, /moov atom/],
    ['transcribe', { transcription: { transcribe: boom('provider timeout') } }, /provider timeout/],
    [
      'analyze',
      { completion: { complete: vi.fn().mockRejectedValue(new SchemaValidationError('m')) } },
      /invalid analysis response/,
    ],
    [
      'generate-script',
      {
        completion: {
          complete: vi
            .fn()
            .mockResolvedValueOnce(analysis)
            .mockRejectedValue(new SchemaValidationError('m')),
        },
      },
      /invalid script response/,
    ],
  ]

  it.each(cases)('fails at %s', async (step, over, reason) => {
    const { deps } = makeDeps(over)

    const outcome = await runProcessReel(input, deps)

    expect(outcome).toMatchObject({
      status: 'failed',
      failedStep: step,
      // The reel's identity survives so the UI can still render it.
      rank: 2,
      shortcode: 'DAaaa',
      metrics: { views: 10, likes: 2, comments: 1 },
    })
    expect((outcome as { reason: string }).reason).toMatch(reason)
  })

  it('still cleans up when the reel failed at analyze (2.5)', async () => {
    const { deps, removed } = makeDeps({
      completion: { complete: vi.fn().mockRejectedValue(new SchemaValidationError('m')) },
    })

    const outcome = await runProcessReel(input, deps)

    expect(outcome).toMatchObject({ status: 'failed', failedStep: 'analyze' })
    expect(removed.sort()).toEqual([`${TMP}/DAaaa.mp3`, `${TMP}/DAaaa.mp4`].sort())
  })
})

describe('processReelWorkflow — a FatalRunError aborts (7.3)', () => {
  it('rejects with the fatal error and runs no later adapter', async () => {
    const fatal = new FatalRunError('ig-session-expired', 'rotate the cookie')
    const downloadVideo = vi.fn()
    const { deps } = makeDeps({
      instagram: { hydrateReel: vi.fn().mockRejectedValue(fatal), downloadVideo },
    })

    await expect(runProcessReel(input, deps)).rejects.toBeInstanceOf(FatalRunError)
    expect(downloadVideo).not.toHaveBeenCalled()
  })
})

describe('progress recording (5.3)', () => {
  const withRecorder = (over: Record<string, unknown> = {}) => {
    const seen: string[] = []
    const progress = {
      record: vi.fn((_runId: string, _shortcode: string, step: string) => void seen.push(step)),
      read: vi.fn(() => ({})),
    }
    const { deps, removed } = makeDeps({ progress, runId: 'run-1', ...over })
    return { deps, progress, seen, removed }
  }

  it('records every step in pipeline order', async () => {
    const { deps, seen } = withRecorder()

    await runProcessReel(input, deps)

    expect(seen).toEqual([
      'hydrate',
      'download',
      'extract-audio',
      'transcribe',
      'analyze',
      'generate-script',
    ])
  })

  it('reports the step currently executing while it is still running', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { deps, seen } = withRecorder({
      transcription: {
        transcribe: vi.fn(async () => {
          await gate
          return 'said'
        }),
      },
    })

    const running = runProcessReel(input, deps)
    for (let i = 0; i < 100 && !seen.includes('transcribe'); i++) {
      await new Promise((r) => setTimeout(r, 0))
    }

    // Parked inside transcribe: that is the step currently executing.
    expect(seen.at(-1)).toBe('transcribe')

    release()
    await running
    expect(seen.at(-1)).toBe('generate-script')
  })

  it('does not advance past the step that failed', async () => {
    const { deps, seen } = withRecorder({
      instagram: {
        hydrateReel: vi.fn().mockResolvedValue({ caption: 'c', videoUrl: 'u', durationSeconds: 1 }),
        downloadVideo: vi.fn().mockRejectedValue(new Error('video not available (404)')),
      },
    })

    await runProcessReel(input, deps)

    // Later steps pass the failure through and record nothing.
    expect(seen).toEqual(['hydrate', 'download'])
  })
})
