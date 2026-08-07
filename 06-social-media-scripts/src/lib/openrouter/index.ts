import { type CompletionClient, type ObjectGenerator, createCompletionClient } from './completion'
import {
  type TranscriptionClient,
  createTranscriptionClient,
} from './transcription'

export {
  AudioTooLargeError,
  MAX_AUDIO_BYTES,
  createTranscriptionClient,
  type TranscriptionClient,
} from './transcription'
export {
  SchemaValidationError,
  createCompletionClient,
  type CompleteArgs,
  type CompletionClient,
  type ObjectGenerator,
} from './completion'

export interface OpenRouterOptions {
  apiKey: string
  maxAudioBytes?: number
}

export interface OpenRouterDeps {
  fetch?: typeof globalThis.fetch
  generate?: ObjectGenerator
}

/** The design's single factory: both clients, one API key. */
export function createOpenRouterClients(
  options: OpenRouterOptions,
  deps: OpenRouterDeps = {},
): { transcription: TranscriptionClient; completion: CompletionClient } {
  return {
    transcription: createTranscriptionClient(options, { fetch: deps.fetch }),
    completion: createCompletionClient(options.apiKey, deps.generate),
  }
}
