import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { Criterion } from '../types'
import { splitCriteria } from '../lib/criteria'
import { suggestEvidence } from '../lib/suggest'

// The criteria checklist for one application (Phase 4). Paste/extract candidate
// criteria from the ad, then edit them by hand and link each to an evidence
// item. The splitter is deliberately rough — the editable list and the evidence
// links are the point, not the parse.
export function CriteriaPanel({ applicationId, adText }: { applicationId: string; adText: string | null }) {
  const store = useStore()
  const [newText, setNewText] = useState('')

  const rows = useMemo(
    () =>
      store.data.criteria
        .filter((c) => c.application_id === applicationId)
        .sort((a, b) => a.position - b.position),
    [store.data.criteria, applicationId],
  )

  const essential = rows.filter((c) => c.essential)
  const essentialCovered = essential.filter((c) => c.covered_by).length

  function extract() {
    const candidates = splitCriteria(adText)
    if (candidates.length === 0) {
      alert('No lines to split out of the ad text. Paste the ad on the right first.')
      return
    }
    store.addCriteriaBulk(applicationId, candidates)
  }

  function addRow() {
    const t = newText.trim()
    if (!t) return
    store.addCriterion(applicationId, t)
    setNewText('')
  }

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Criteria</h2>
        <span className="spacer" style={{ flex: 1 }} />
        {essential.length > 0 && (
          <span
            className={`chip ${
              essentialCovered === essential.length ? 'on' : essentialCovered === 0 ? 'count-0' : 'count-1'
            }`}
            title="Essential criteria with evidence linked"
          >
            {essentialCovered}/{essential.length} essential covered
          </span>
        )}
        <button className="btn small" onClick={extract} disabled={!adText} title={adText ? 'Split the ad text into rows' : 'Paste the ad text first'}>
          Extract from ad
        </button>
      </div>
      <p className="section-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Split the ad into a checklist, then fix the rows by hand and link each to the evidence that
        answers it. Coverage gaps are what to write about.
      </p>

      {rows.length === 0 ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          No criteria yet. <strong>Extract from ad</strong> to seed the list, or add rows below.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {rows.map((c, i) => (
            <CriterionRow key={c.id} c={c} first={i === 0} last={i === rows.length - 1} />
          ))}
        </div>
      )}

      <div className="inline-add">
        <input
          type="text"
          placeholder="Add a criterion…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
        />
        <button className="btn" onClick={addRow}>
          Add
        </button>
      </div>
    </div>
  )
}

function CriterionRow({ c, first, last }: { c: Criterion; first: boolean; last: boolean }) {
  const store = useStore()
  const evidence = store.data.evidence
  const covered = !!c.covered_by
  const suggestions = covered ? [] : suggestEvidence(c.text, evidence)

  return (
    <div className="crit-item">
      <div className="crit-row">
      <button
        className={`chip selectable ${c.essential ? 'on' : ''}`}
        style={{ whiteSpace: 'nowrap' }}
        onClick={() => store.updateCriterion(c.id, { essential: !c.essential })}
        title="Toggle essential / nice-to-have"
      >
        {c.essential ? 'Essential' : 'Nice'}
      </button>

      <input
        type="text"
        className="grow"
        defaultValue={c.text}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v && v !== c.text) store.updateCriterion(c.id, { text: v })
        }}
      />

      <select
        value={c.covered_by ?? ''}
        onChange={(e) => store.updateCriterion(c.id, { covered_by: e.target.value || null })}
        style={{ width: 'auto', maxWidth: 190, borderColor: covered ? 'var(--pill-green-fg)' : undefined }}
        title="Link the evidence that covers this"
      >
        <option value="">— no evidence —</option>
        {evidence.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title}
          </option>
        ))}
      </select>

      <button className="btn ghost small" onClick={() => store.moveCriterion(c.id, -1)} disabled={first} aria-label="Move up" title="Move up">
        ↑
      </button>
      <button className="btn ghost small" onClick={() => store.moveCriterion(c.id, 1)} disabled={last} aria-label="Move down" title="Move down">
        ↓
      </button>
      <button className="btn ghost small" onClick={() => store.deleteCriterion(c.id)} aria-label="Delete criterion" title="Delete">
        ×
      </button>
      </div>
      {!covered && suggestions.length > 0 && (
        <div className="crit-suggest">
          <span className="muted">Suggested:</span>
          {suggestions.map((s) => (
            <button
              key={s.evidence.id}
              className="chip selectable"
              onClick={() => store.updateCriterion(c.id, { covered_by: s.evidence.id })}
              title="Link this evidence to the criterion"
            >
              ↳ {s.evidence.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
