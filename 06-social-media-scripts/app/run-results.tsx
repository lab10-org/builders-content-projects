'use client'

import { useState } from 'react'
import type { ReelScript, RunView } from '../src/lib/types'

/** One definition of the copied text, so the card and the clipboard agree. */
export function formatScript(script: ReelScript): string {
  return [script.hook, script.body, script.closing].join('\n\n')
}

const defaultCopy = (text: string) => navigator.clipboard.writeText(text)

function CopyButton({ script, copy }: { script: ReelScript; copy: (t: string) => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const onClick = () => {
    // Always caught: a denied clipboard permission must not leave an unhandled
    // rejection or break the card.
    copy(formatScript(script)).then(
      () => setState('copied'),
      () => setState('failed'),
    )
  }

  return (
    <button type="button" onClick={onClick}>
      {state === 'copied' ? 'Copiado' : state === 'failed' ? 'No se pudo copiar' : 'Copiar script'}
    </button>
  )
}

export interface RunResultsProps {
  view: RunView
  copy?: (text: string) => Promise<void>
}

export function RunResults({ view, copy = defaultCopy }: RunResultsProps) {
  return (
    <section>
      <ul>
        {view.reels.map((reel) => (
          <li key={reel.shortcode} data-testid={`reel-${reel.rank}`}>
            <h3>#{reel.rank}</h3>
            {reel.thumbnailUrl ? <img src={reel.thumbnailUrl} alt="" /> : null}
            <p>
              {reel.metrics.views} views · {reel.metrics.likes} likes · {reel.metrics.comments}{' '}
              comments
            </p>

            {reel.status === 'ok' ? (
              <>
                <h4>Análisis</h4>
                <p>{reel.analysis.objective}</p>
                <ul>
                  {reel.analysis.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
                <p>{reel.analysis.targetAudience}</p>

                <h4>Script</h4>
                <p>{reel.script.hook}</p>
                <p>{reel.script.body}</p>
                <p>{reel.script.closing}</p>
                <CopyButton script={reel.script} copy={copy} />
              </>
            ) : null}

            {reel.status === 'failed' ? <p role="alert">{reel.reason}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
