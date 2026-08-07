import { readFile } from 'node:fs/promises'
import { MODELS, OPENROUTER_BASE_URL } from '../models'

/** OpenRouter's multipart/transcription ceiling. Shared with T15's guard so
 *  2.6 has exactly one source of truth. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024

/** A plain Error, never a FatalRunError: an oversized file fails one reel. */
export class AudioTooLargeError extends Error {
  constructor() {
    // T15 surfaces this verbatim as the reel's failure reason (2.6).
    super('audio too large')
    this.name = 'AudioTooLargeError'
  }
}

export interface TranscriptionClient {
  /** `sizeBytes` comes from the extractor (T8), so the guard costs no extra stat. */
  transcribe(audioPath: string, sizeBytes: number): Promise<string>
}

export interface TranscriptionOptions {
  apiKey: string
  maxAudioBytes?: number
}

/** Test seam; the design's published signature shows no `fetch` argument. */
export interface TranscriptionDeps {
  fetch?: typeof globalThis.fetch
}

export function createTranscriptionClient(
  options: TranscriptionOptions,
  deps: TranscriptionDeps = {},
): TranscriptionClient {
  const doFetch = deps.fetch ?? globalThis.fetch
  const maxAudioBytes = options.maxAudioBytes ?? MAX_AUDIO_BYTES

  return {
    async transcribe(audioPath, sizeBytes) {
      // Guard BEFORE reading the file, let alone issuing the request (2.6).
      if (sizeBytes > maxAudioBytes) throw new AudioTooLargeError()

      const audio = await readFile(audioPath)

      const response = await doFetch(`${OPENROUTER_BASE_URL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.transcription,
          // Raw base64, not a data URI — OpenRouter is explicit about that.
          input_audio: { data: audio.toString('base64'), format: 'mp3' },
        }),
      })

      if (!response.ok) {
        throw new Error(
          `OpenRouter transcription failed with HTTP ${response.status} for ${audioPath}.`,
        )
      }

      const payload = (await response.json()) as { text?: unknown }
      if (typeof payload?.text !== 'string' || payload.text.trim() === '') {
        throw new Error(`OpenRouter returned no transcript text for ${audioPath}.`)
      }

      return payload.text
    },
  }
}
