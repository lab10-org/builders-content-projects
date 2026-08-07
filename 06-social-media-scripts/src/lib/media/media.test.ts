import { describe, expect, it, vi } from 'vitest'
import { FatalRunError } from '../preflight'
import { createFfmpegExtractor } from './index'

const ok = () => vi.fn().mockResolvedValue({ code: 0, stderr: '' })
const stat = (size = 4096) => vi.fn().mockResolvedValue({ size })

/** Asserts `pair` appears as adjacent entries, so a reordered argv cannot pass. */
const hasAdjacent = (argv: string[], pair: [string, string]) =>
  argv.some((arg, i) => arg === pair[0] && argv[i + 1] === pair[1])

describe('extractAudio', () => {
  it('asks ffmpeg for a mono 16 kHz MP3 (2.3)', async () => {
    const run = ok()
    await createFfmpegExtractor(undefined, { run, stat: stat() }).extractAudio('in.mp4', 'out.mp3')

    const [binary, argv] = run.mock.calls[0]
    expect(binary).toBe('ffmpeg')
    expect(hasAdjacent(argv, ['-i', 'in.mp4'])).toBe(true)
    expect(hasAdjacent(argv, ['-ac', '1'])).toBe(true)
    expect(hasAdjacent(argv, ['-ar', '16000'])).toBe(true)
    expect(argv).toContain('-vn')
    expect(argv).toContain('libmp3lame')
    expect(argv).toContain('-y')
    expect(argv.at(-1)).toBe('out.mp3')
  })

  it('resolves with the destination path and its size', async () => {
    const statFn = stat(123456)

    const result = await createFfmpegExtractor(undefined, {
      run: ok(),
      stat: statFn,
    }).extractAudio('in.mp4', 'out.mp3')

    // T15 enforces the 25 MB limit from this number, without re-reading the file.
    expect(result).toEqual({ path: 'out.mp3', sizeBytes: 123456 })
    expect(statFn).toHaveBeenCalledWith('out.mp3')
  })

  it('rejects with a plain Error carrying ffmpeg stderr on a non-zero exit', async () => {
    const run = vi.fn().mockResolvedValue({ code: 1, stderr: 'moov atom not found' })

    const error = await createFfmpegExtractor(undefined, { run, stat: stat() })
      .extractAudio('corrupt.mp4', 'out.mp3')
      .catch((e) => e)

    // A corrupt mp4 fails one reel; it never aborts the run.
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(FatalRunError)
    expect(error.message).toContain('moov atom not found')
  })

  it('honours an explicit ffmpeg binary path', async () => {
    const run = ok()

    await createFfmpegExtractor('/opt/bin/ffmpeg', { run, stat: stat() }).extractAudio(
      'in.mp4',
      'out.mp3',
    )

    expect(run.mock.calls[0][0]).toBe('/opt/bin/ffmpeg')
  })
})
