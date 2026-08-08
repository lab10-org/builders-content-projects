import { describe, expect, it } from 'vitest'
import { createProgressRecorder } from './progress'

describe('createProgressRecorder', () => {
  it('reports the step recorded for a reel', () => {
    const recorder = createProgressRecorder()
    recorder.record('run-1', 'DAaaa', 'download')

    expect(recorder.read('run-1')).toEqual({ DAaaa: 'download' })
  })

  it('overwrites, because it holds the current step and not a history', () => {
    const recorder = createProgressRecorder()
    recorder.record('run-1', 'DAaaa', 'download')
    recorder.record('run-1', 'DAaaa', 'transcribe')

    expect(recorder.read('run-1')).toEqual({ DAaaa: 'transcribe' })
  })

  it('returns {} for a run it has never seen', () => {
    expect(createProgressRecorder().read('nope')).toEqual({})
  })

  it('tracks reels independently and keeps runs apart', () => {
    const recorder = createProgressRecorder()
    recorder.record('run-1', 'DAaaa', 'analyze')
    recorder.record('run-1', 'DAbbb', 'hydrate')
    recorder.record('run-2', 'DAaaa', 'transcribe')

    expect(recorder.read('run-1')).toEqual({ DAaaa: 'analyze', DAbbb: 'hydrate' })
    expect(recorder.read('run-2')).toEqual({ DAaaa: 'transcribe' })
  })

  it('hands back a copy, so a caller cannot mutate the record', () => {
    const recorder = createProgressRecorder()
    recorder.record('run-1', 'DAaaa', 'hydrate')

    const first = recorder.read('run-1')
    first.DAaaa = 'analyze'

    expect(recorder.read('run-1')).toEqual({ DAaaa: 'hydrate' })
  })
})
