import { describe, expect, it, vi } from 'vitest'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { cleanup } from './cleanup'

const base = {
  rank: 1,
  shortcode: 'DAaaa',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 1, likes: 0, comments: 0 },
}

const VIDEO = '/tmp/run-xyz/DAaaa.mp4'
const AUDIO = '/tmp/run-xyz/DAaaa.mp3'

const recorder = () => {
  const removed: string[] = []
  return {
    removed,
    files: { remove: vi.fn(async (path: string) => void removed.push(path)) },
  }
}

const deps = (files: unknown): RunDeps => ({ files }) as unknown as RunDeps

describe('cleanup', () => {
  it('removes exactly the video and the audio after a successful reel (2.5)', async () => {
    const { removed, files } = recorder()
    const ok: ReelState = {
      ...base,
      status: 'ok',
      analysis: { objective: 'o', highlights: ['h'], targetAudience: 't' },
      script: { hook: 'h', body: 'b', closing: 'c' },
      videoPath: VIDEO,
      audioPath: AUDIO,
    } as unknown as ReelState

    const next = await cleanup(ok, deps(files))

    // Nothing else — in particular not the run's temp directory.
    expect(removed.sort()).toEqual([AUDIO, VIDEO].sort())
    expect(next).toEqual(ok)
  })

  it('still removes both files for a reel that failed at analyze (2.5)', async () => {
    const { removed, files } = recorder()
    const failed: ReelState = {
      ...base,
      status: 'failed',
      failedStep: 'analyze',
      reason: 'invalid analysis response',
      videoPath: VIDEO,
      audioPath: AUDIO,
    } as unknown as ReelState

    const next = await cleanup(failed, deps(files))

    // 2.5 must not be defeated by the pass-through rule.
    expect(removed.sort()).toEqual([AUDIO, VIDEO].sort())
    expect(next).toEqual(failed)
  })

  it('removes only the video when extraction never produced an audio file', async () => {
    const { removed, files } = recorder()
    const failed: ReelState = {
      ...base,
      status: 'failed',
      failedStep: 'extract-audio',
      reason: 'moov atom not found',
      videoPath: VIDEO,
    } as unknown as ReelState

    await cleanup(failed, deps(files))

    expect(removed).toEqual([VIDEO])
    expect(files.remove).not.toHaveBeenCalledWith(undefined)
  })

  it('removes nothing when the reel failed before any file existed', async () => {
    const { removed, files } = recorder()
    const failed: ReelState = {
      ...base,
      status: 'failed',
      failedStep: 'hydrate',
      reason: 'no video URL',
    }

    await expect(cleanup(failed, deps(files))).resolves.toEqual(failed)
    expect(removed).toEqual([])
  })

  it('is best-effort: a failing remover never turns an ok reel into a failed one', async () => {
    const files = { remove: vi.fn().mockRejectedValue(new Error('ENOENT')) }
    const ok: ReelState = {
      ...base,
      status: 'ok',
      analysis: { objective: 'o', highlights: ['h'], targetAudience: 't' },
      script: { hook: 'h', body: 'b', closing: 'c' },
      videoPath: VIDEO,
    } as unknown as ReelState

    // 'cleanup' is deliberately not a member of PipelineStep, so it can never
    // appear as a failedStep.
    await expect(cleanup(ok, deps(files))).resolves.toEqual(ok)
  })
})
