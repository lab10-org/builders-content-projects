import { spawn } from 'node:child_process'
import { stat as fsStat } from 'node:fs/promises'

export interface ExtractedAudio {
  path: string
  /** Returned so the caller can enforce the transcription size limit (2.6)
   *  without re-reading the file. */
  sizeBytes: number
}

export interface AudioExtractor {
  extractAudio(videoPath: string, destPath: string): Promise<ExtractedAudio>
}

/** Test seams. The design's published signature is `createFfmpegExtractor(ffmpegBin?)`;
 *  these defaults are the real implementations, so no test spawns ffmpeg or
 *  touches the filesystem. */
export interface MediaDeps {
  run?: (binary: string, argv: string[]) => Promise<{ code: number | null; stderr: string }>
  stat?: (path: string) => Promise<{ size: number }>
}

const defaultRun: NonNullable<MediaDeps['run']> = (binary, argv) =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, argv, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, stderr }))
  })

/** Keep the tail: ffmpeg's stderr is mostly banner noise, and the real cause is last. */
const tail = (stderr: string, lines = 5) =>
  stderr.trim().split('\n').slice(-lines).join('\n').trim()

export function createFfmpegExtractor(
  ffmpegBin = 'ffmpeg',
  deps: MediaDeps = {},
): AudioExtractor {
  const run = deps.run ?? defaultRun
  const stat = deps.stat ?? fsStat

  return {
    async extractAudio(videoPath, destPath) {
      const { code, stderr } = await run(ffmpegBin, [
        '-i',
        videoPath,
        '-vn', // drop the video stream
        '-ac',
        '1', // mono
        '-ar',
        '16000', // 16 kHz
        '-codec:a',
        'libmp3lame',
        '-y', // overwrite, so a retried attempt starts clean
        destPath,
      ])

      if (code !== 0) {
        // A plain Error: a corrupt mp4 fails one reel, never the whole run.
        throw new Error(
          `ffmpeg exited with code ${code} while extracting audio from ${videoPath}: ${tail(stderr)}`,
        )
      }

      const { size } = await stat(destPath)
      return { path: destPath, sizeBytes: size }
    },
  }
}
