import { useRef } from 'react'
import { useStore } from '../store/store'
import type { Application, Outcome } from '../types'
import { STAGE_LABELS } from '../lib/constants'
import { useEscape, useModalFocus } from './common'

// Closing prompts for the outcome. "No response" is offered exactly as plainly
// as the rest — it is a valid, and often the most common, ending.
const OPTIONS: { outcome: Outcome; title: string; detail: string }[] = [
  { outcome: 'rejected', title: 'Rejected', detail: 'They said no.' },
  { outcome: 'no_response', title: 'No response', detail: 'It went silent; giving up on it.' },
  { outcome: 'withdrew', title: 'Withdrew', detail: 'I pulled out of this one.' },
  { outcome: 'accepted', title: 'Accepted', detail: 'I got it (or the offer) 🎉' },
]

export function CloseDialog({ app, onClose }: { app: Application; onClose: () => void }) {
  const store = useStore()
  const ref = useRef<HTMLDivElement>(null)
  useEscape(onClose)
  useModalFocus(ref)

  function pick(outcome: Outcome) {
    store.closeApplication(app.id, outcome)
    onClose()
  }

  const from = app.stage === 'closed' ? app.closed_from_stage : app.stage

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Close application" ref={ref} tabIndex={-1}>
        <h2>Close this application</h2>
        <p className="muted">
          {app.role}
          {app.company ? ` · ${app.company}` : ''}
          {from ? ` — currently at ${STAGE_LABELS[from as keyof typeof STAGE_LABELS] ?? from}` : ''}
        </p>
        <p className="section-note">
          The stage it&rsquo;s closing from is recorded automatically, so you can see where
          applications tend to die.
        </p>

        <div className="outcome-grid">
          {OPTIONS.map((o) => (
            <button key={o.outcome} onClick={() => pick(o.outcome)}>
              <span className="t">{o.title}</span>
              <span className="d">{o.detail}</span>
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
