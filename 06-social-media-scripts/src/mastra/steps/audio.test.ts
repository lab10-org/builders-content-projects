import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { MAX_AUDIO_BYTES } from '../../lib/openrouter'
import type { RunDeps } from '../deps'
import type { ReelState } from '../state'
import { extractAudio } from './extract-audio'
import { transcribe } from './transcribe'

const TMP = '/tmp/run-xyz'

const ready: ReelState = {
  status: 'pending',
  rank: 1,
  shortcode: 'DAaaa',
  mediaId: '123',
  thumbnailUrl: 'https://cdn/t.jpg',
  metrics: { views: 10, likes: 2, comments: 1 },
  caption: 'cap',
  videoUrl: 'https://cdn/v.mp4',
  durationSeconds: 30,
  videoPath: join(TMP, 'DAaaa.mp4'),
}

const failedEarlier: ReelState = {
  status: 'failed',
  failedStep: 'download',
  reason: 'video not available (404)',
  rank: 1,
  shortcode: 'DAaaa',
  thumbnailUrl: '',
  metrics: { views: 10, likes: 2, comments: 1 },
}

const deps = (over: Partial<RunDeps>): RunDeps => ({ tmpDir: TMP, ...over }) as unknown as RunDeps

const extractorReturning = (sizeBytes: number) => ({
  extractAudio: vi.fn().mockResolvedValue({ path: join(TMP, 'DAaaa.mp3'), sizeBytes }),
})

describe('extract-audio', () => {
  it('writes the mp3 beside the video and records path and size (2.3)', async () => {
    const media = extractorReturning(4096)

    const next = await extractAudio(ready, deps({ media: media as never }))

    expect(media.extractAudio).toHaveBeenCalledWith(join(TMP, 'DAaaa.mp4'), join(TMP, 'DAaaa.mp3'))
    expect(next).toMatchObject({
      status: 'pending',
      audioPath: join(TMP, 'DAaaa.mp3'),
      audioSizeBytes: 4096,
      rank: 1,
      shortcode: 'DAaaa',
      thumbnailUrl: 'https://cdn/t.jpg',
      metrics: { views: 10, likes: 2, comments: 1 },
    })
  })

  it('fails this reel when ffmpeg rejects (6.1)', async () => {
    const media = { extractAudio: vi.fn().mockRejectedValue(new Error('moov atom not found')) }

    const next = await extractAudio(ready, deps({ media: media as never }))

    expect(next).toMatchObject({ status: 'failed', failedStep: 'extract-audio' })
    expect((next as { reason: string }).reason).toContain('moov atom')
  })

  describe('the 25 MB guard (2.6)', () => {
    // Sizes are computed from the imported constant, never a literal, so the
    // guard and the transcription client can never drift apart.
    it('fails one byte over the limit with the exact reason string', async () => {
      const next = await extractAudio(
        ready,
        deps({ media: extractorReturning(MAX_AUDIO_BYTES + 1) as never }),
      )

      expect(next).toMatchObject({
        status: 'failed',
        failedStep: 'extract-audio',
        reason: 'audio too large',
      })
    })

    it('lets a file exactly at the limit through — the criterion says "exceeds"', async () => {
      const next = await extractAudio(
        ready,
        deps({ media: extractorReturning(MAX_AUDIO_BYTES) as never }),
      )

      expect(next.status).toBe('pending')
    })

    it('keeps videoPath and audioPath on the oversized failure, so cleanup can delete both (2.5)', async () => {
      const next = await extractAudio(
        ready,
        deps({ media: extractorReturning(MAX_AUDIO_BYTES + 1) as never }),
      )

      expect(next).toMatchObject({
        videoPath: join(TMP, 'DAaaa.mp4'),
        audioPath: join(TMP, 'DAaaa.mp3'),
      })
    })

    it('never sends the transcription request for the oversized reel', async () => {
      // Chained through the real transcribe step: asserting this inside the
      // extract-audio test alone would pass in a vacuum.
      const oversized = await extractAudio(
        ready,
        deps({ media: extractorReturning(MAX_AUDIO_BYTES + 1) as never }),
      )
      const transcription = { transcribe: vi.fn() }

      const next = await transcribe(oversized, deps({ transcription: transcription as never }))

      expect(next).toEqual(oversized)
      expect(transcription.transcribe).not.toHaveBeenCalled()
    })
  })

  it('passes an already-failed reel through without calling the extractor', async () => {
    const media = { extractAudio: vi.fn() }

    await expect(extractAudio(failedEarlier, deps({ media: media as never }))).resolves.toEqual(
      failedEarlier,
    )
    expect(media.extractAudio).not.toHaveBeenCalled()
  })
})

describe('transcribe', () => {
  const withAudio: ReelState = {
    ...(ready as Extract<ReelState, { status: 'pending' }>),
    audioPath: join(TMP, 'DAaaa.mp3'),
    audioSizeBytes: 4096,
  }

  it('stores the transcript against the reel (2.4)', async () => {
    const transcription = { transcribe: vi.fn().mockResolvedValue('what was said') }

    const next = await transcribe(withAudio, deps({ transcription: transcription as never }))

    expect(transcription.transcribe).toHaveBeenCalledWith(join(TMP, 'DAaaa.mp3'), 4096)
    expect(next).toMatchObject({ status: 'pending', transcript: 'what was said' })
  })

  it('fails this reel when transcription rejects (6.1)', async () => {
    const transcription = { transcribe: vi.fn().mockRejectedValue(new Error('provider timeout')) }

    const next = await transcribe(withAudio, deps({ transcription: transcription as never }))

    expect(next).toMatchObject({ status: 'failed', failedStep: 'transcribe' })
    expect((next as { reason: string }).reason).toContain('provider timeout')
  })

  it('passes an already-failed reel through without calling the client', async () => {
    const transcription = { transcribe: vi.fn() }

    await expect(
      transcribe(failedEarlier, deps({ transcription: transcription as never })),
    ).resolves.toEqual(failedEarlier)
    expect(transcription.transcribe).not.toHaveBeenCalled()
  })
})
