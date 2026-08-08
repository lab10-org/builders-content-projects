import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MODELS } from '../models'
import { FatalRunError } from '../preflight'
import { AudioTooLargeError, MAX_AUDIO_BYTES, createTranscriptionClient } from './transcription'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('transcribe', () => {
  let dir: string
  let audioPath: string
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 250])

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'or-stt-'))
    audioPath = join(dir, 'clip.mp3')
    await writeFile(audioPath, bytes)
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('posts the base64 audio to OpenRouter and returns the transcript (2.4)', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ text: 'hello from the reel' }))

    const transcript = await createTranscriptionClient({ apiKey: 'sk-test' }, { fetch }).transcribe(
      audioPath,
      bytes.byteLength,
    )

    expect(transcript).toBe('hello from the reel')
    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/audio/transcriptions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-test')

    const body = JSON.parse(init.body)
    // The only meaningful test of models.ts: the pinned ID reaches the wire.
    expect(body.model).toBe(MODELS.transcription)
    expect(body.input_audio.format).toBe('mp3')
    expect(new Uint8Array(Buffer.from(body.input_audio.data, 'base64'))).toEqual(bytes)
  })

  describe('the size guard (2.6)', () => {
    it('refuses an oversized file without reading it or issuing a request', async () => {
      const fetch = vi.fn()
      // A path that does not exist: a rejection that is not ENOENT proves the
      // file was never read either.
      const missing = join(dir, 'does-not-exist.mp3')

      const error = await createTranscriptionClient({ apiKey: 'sk-test', maxAudioBytes: 10 }, { fetch })
        .transcribe(missing, 11)
        .catch((e) => e)

      expect(error).toBeInstanceOf(AudioTooLargeError)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('is an Error but never a FatalRunError, with a single reason string', async () => {
      const error = await createTranscriptionClient({ apiKey: 'k', maxAudioBytes: 1 }, { fetch: vi.fn() })
        .transcribe(audioPath, 2)
        .catch((e) => e)

      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(FatalRunError)
      // T15's guard reuses this exact string as the reel's failure reason.
      expect(error.message).toBe('audio too large')
    })

    it('defaults to 25 MB and accepts a file exactly at the limit', async () => {
      expect(MAX_AUDIO_BYTES).toBe(25 * 1024 * 1024)

      const fetch = vi.fn().mockResolvedValue(jsonResponse({ text: 'ok' }))
      // The requirement says "exceeds", so equal must pass.
      await expect(
        createTranscriptionClient({ apiKey: 'k', maxAudioBytes: bytes.byteLength }, { fetch }).transcribe(
          audioPath,
          bytes.byteLength,
        ),
      ).resolves.toBe('ok')
    })
  })

  it.each([
    ['a non-2xx response', jsonResponse({ error: 'nope' }, 500), /500/],
    ['a 2xx with no transcript text', jsonResponse({ usage: {} }), /transcript/i],
  ])('rejects with a plain Error on %s', async (_label, response, matcher) => {
    const error = await createTranscriptionClient({ apiKey: 'k' }, { fetch: vi.fn().mockResolvedValue(response) })
      .transcribe(audioPath, bytes.byteLength)
      .catch((e) => e)

    // A reel failure, not a run abort — and never an undefined transcript
    // flowing on into the analysis prompt.
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(FatalRunError)
    expect(error.message).toMatch(matcher)
  })
})
