import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { splitCvIntoEvidence } from '../lib/parseCv'
import { useEscape, useModalFocus } from './common'

type Candidate = { id: number; title: string; bullet: string; keep: boolean }

// Paste a CV → get a reviewable list of candidate achievements → add the ones
// you want to the evidence bank in one go. Nothing is committed until you click
// Add, and each lands as a bullet-only item (fill the full answer in later).
export function CvImportDialog({ onClose, onAdded }: { onClose: () => void; onAdded?: (n: number) => void }) {
  const store = useStore()
  const ref = useRef<HTMLDivElement>(null)
  useEscape(onClose)
  useModalFocus(ref)

  const [text, setText] = useState('')
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)

  function find() {
    const found = splitCvIntoEvidence(text)
    setCandidates(found.map((c, i) => ({ id: i, title: c.title, bullet: c.bullet, keep: true })))
  }

  const kept = candidates?.filter((c) => c.keep) ?? []

  function add() {
    if (kept.length === 0) return
    store.addEvidenceBulk(kept.map((c) => ({ title: c.title, bullet: c.bullet })))
    onAdded?.(kept.length)
    onClose()
  }

  function patch(id: number, p: Partial<Candidate>) {
    setCandidates((cs) => cs?.map((c) => (c.id === id ? { ...c, ...p } : c)) ?? cs)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="Import from CV" ref={ref} tabIndex={-1}>
        <h2>Import from your CV</h2>
        <p className="section-note" style={{ marginTop: 0 }}>
          Paste your CV or résumé. We&rsquo;ll pull out the achievement lines so you can seed your
          evidence bank fast — pick the ones worth keeping, tidy the titles, and add them. Each
          arrives as a bullet; add the full interview answer later.
        </p>

        {candidates === null ? (
          <>
            <textarea
              className="cv-paste"
              aria-label="Paste your CV"
              placeholder="Paste the whole thing — bullets, sections, all of it."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div className="actions">
              <button className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn primary" onClick={find} disabled={!text.trim()}>
                Find achievements
              </button>
            </div>
          </>
        ) : candidates.length === 0 ? (
          <>
            <p className="muted">
              Couldn&rsquo;t find achievement lines to split out. Paste the bullet points from your
              experience section, or add evidence by hand instead.
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={() => setCandidates(null)}>
                ← Back
              </button>
              <button className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {kept.length} of {candidates.length} selected
              </span>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn ghost small" onClick={() => setCandidates((cs) => cs?.map((c) => ({ ...c, keep: true })) ?? cs)}>
                Select all
              </button>
              <button className="btn ghost small" onClick={() => setCandidates((cs) => cs?.map((c) => ({ ...c, keep: false })) ?? cs)}>
                None
              </button>
            </div>
            <div className="cv-candidates">
              {candidates.map((c) => (
                <div key={c.id} className={`cv-cand ${c.keep ? '' : 'off'}`}>
                  <input
                    type="checkbox"
                    checked={c.keep}
                    onChange={(e) => patch(c.id, { keep: e.target.checked })}
                    aria-label={`Keep "${c.title}"`}
                  />
                  <div className="cv-cand-body">
                    <input
                      type="text"
                      className="cv-cand-title"
                      value={c.title}
                      onChange={(e) => patch(c.id, { title: e.target.value })}
                      aria-label="Evidence title"
                    />
                    <div className="cv-cand-bullet">{c.bullet}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setCandidates(null)}>
                ← Back
              </button>
              <button className="btn primary" onClick={add} disabled={kept.length === 0}>
                Add {kept.length} to bank
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
