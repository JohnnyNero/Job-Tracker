import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import type { AppEvent, Stage } from '../types'
import { STAGES } from '../types'
import { STAGE_LABELS, STAGE_TONE, OUTCOME_LABELS, SOURCE_SUGGESTIONS } from '../lib/constants'
import { fmtDateTime } from '../lib/dates'
import { navigate, routes } from '../router'
import { TextField, TextArea, DateField, UrlField, SelectField } from './fields'
import { StagePill } from './common'
import { CloseDialog } from './CloseDialog'

export function ApplicationDetail({ id }: { id: string }) {
  const store = useStore()
  const app = store.data.applications.find((a) => a.id === id)
  const [closing, setClosing] = useState(false)

  // Cmd/Ctrl+Enter: commit the focused field (via blur) and return to pipeline.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        navigate(routes.pipeline())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!app) {
    return (
      <div className="page page-narrow">
        <a className="link-back" href={routes.pipeline()}>
          ← Pipeline
        </a>
        <div className="empty">
          <h3>Application not found</h3>
          <p>It may have been deleted. Head back to the pipeline.</p>
          <a className="btn" href={routes.pipeline()}>
            Back to the pipeline
          </a>
        </div>
      </div>
    )
  }

  const set = (patch: Parameters<typeof store.updateApplication>[1]) =>
    store.updateApplication(app.id, patch)

  function onStageChange(next: Stage) {
    if (next === 'closed') setClosing(true)
    else store.changeStage(app!.id, next)
  }

  function del() {
    if (confirm(`Delete "${app!.role}"? This removes its timeline and links too. This cannot be undone.`)) {
      store.deleteApplication(app!.id)
      navigate(routes.pipeline())
    }
  }

  const tone = STAGE_TONE[app.stage]
  const events = store.data.events
    .filter((e) => e.application_id === app.id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  return (
    <div className="page">
      <a className="link-back" href={routes.pipeline()}>
        ← Pipeline
      </a>

      <div className="page-head">
        <h1>{app.role || 'Untitled role'}</h1>
        <span className="sub">{app.company}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <StagePill stage={app.stage} />
        <select
          className="stage-select"
          style={{ color: `var(--pill-${tone}-fg)`, border: '1px solid var(--border-strong)' }}
          value={app.stage}
          onChange={(e) => onStageChange(e.target.value as Stage)}
          aria-label="Change stage"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <a className="btn" href={routes.compose(app.id)}>
          Compose…
        </a>
        {app.stage !== 'closed' ? (
          <button className="btn" onClick={() => setClosing(true)}>
            Close…
          </button>
        ) : (
          <span className="chip">Outcome: {app.outcome ? OUTCOME_LABELS[app.outcome] : '—'}</span>
        )}
        <button className="btn danger small" onClick={del}>
          Delete
        </button>
      </div>

      <div className="detail-grid">
        {/* LEFT: fields + timeline */}
        <div>
          <div className="panel">
            <div className="field-grid">
              <TextField label="Role" value={app.role} onCommit={(v) => set({ role: v })} />
              <TextField
                label="Company"
                value={app.company ?? ''}
                onCommit={(v) => set({ company: v || null })}
              />
              <SelectField
                label="Role profile"
                value={app.profile_id ?? ''}
                onChange={(v) => set({ profile_id: v || null })}
                allowEmpty="—"
                options={store.data.role_profiles.map((p) => ({ value: p.id, label: p.name }))}
              />
              <SelectField
                label="CV version sent"
                value={app.cv_version_id ?? ''}
                onChange={(v) => set({ cv_version_id: v || null })}
                allowEmpty="—"
                options={store.data.cv_versions.map((c) => ({ value: c.id, label: c.label }))}
              />
              <label className="field">
                <span className="lbl">Source</span>
                <input
                  type="text"
                  list="source-suggestions-detail"
                  defaultValue={app.source ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value
                    if (v !== (app.source ?? '')) set({ source: v || null })
                  }}
                />
                <datalist id="source-suggestions-detail">
                  {SOURCE_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <TextField
                label="Location"
                value={app.location ?? ''}
                onCommit={(v) => set({ location: v || null })}
              />
              <UrlField
                label="Link"
                value={app.link ?? ''}
                onCommit={(v) => set({ link: v || null })}
                className="full"
              />
              <TextField
                label="Salary stated"
                value={app.salary_stated ?? ''}
                onCommit={(v) => set({ salary_stated: v || null })}
              />
              <div className="field" />
              <DateField
                label="Applied on"
                value={app.applied_on ?? ''}
                onCommit={(v) => set({ applied_on: v || null })}
              />
              <DateField
                label="Closes on"
                value={app.closes_on ?? ''}
                onCommit={(v) => set({ closes_on: v || null })}
              />
            </div>
          </div>

          <div className="panel">
            <h2>Told them</h2>
            <p className="section-note" style={{ marginTop: 0, marginBottom: 8 }}>
              Salary quoted, notice period, start date &mdash; anything you committed to. This is the
              field that saves you when someone rings six weeks later.
            </p>
            <TextArea
              value={app.told_them ?? ''}
              rows={3}
              onCommit={(v) => set({ told_them: v || null })}
              placeholder="e.g. Quoted 1 month notice; said £34k current, seeking £38k+."
            />
            <hr className="hr" />
            <h2>Notes</h2>
            <TextArea
              value={app.notes ?? ''}
              rows={3}
              onCommit={(v) => set({ notes: v || null })}
              placeholder="Anything else worth remembering."
            />
          </div>

          <div className="panel">
            <h2>Timeline</h2>
            <NoteBox applicationId={app.id} />
            {events.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Stage changes appear here automatically. Add a note above for calls, emails, or
                anything worth a timestamp.
              </p>
            ) : (
              <ul className="timeline" style={{ marginTop: 12 }}>
                {events.map((ev) => (
                  <TimelineItem
                    key={ev.id}
                    ev={ev}
                    onDelete={ev.kind !== 'stage' ? () => store.deleteEvent(ev.id) : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: the archived ad, sticky and tall */}
        <div className="ad-pane">
          <div className="panel">
            <h2>Ad text</h2>
            <p className="section-note" style={{ marginTop: 0, marginBottom: 8 }}>
              Paste the listing here at capture time &mdash; the link will 404, this won&rsquo;t.
            </p>
            <AdTextArea
              value={app.ad_text ?? ''}
              onCommit={(v) => set({ ad_text: v || null })}
            />
          </div>
        </div>
      </div>

      {closing && <CloseDialog app={app} onClose={() => setClosing(false)} />}
    </div>
  )
}

function NoteBox({ applicationId }: { applicationId: string }) {
  const store = useStore()
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<AppEvent['kind']>('note')

  function add() {
    const text = body.trim()
    if (!text) return
    store.addEvent(applicationId, kind, text)
    setBody('')
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      <select value={kind} onChange={(e) => setKind(e.target.value as AppEvent['kind'])} style={{ width: 'auto' }}>
        <option value="note">Note</option>
        <option value="contact">Contact</option>
      </select>
      <input
        type="text"
        className="grow"
        placeholder="Add a note to the timeline…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add()
        }}
      />
      <button className="btn" onClick={add} disabled={!body.trim()}>
        Add
      </button>
    </div>
  )
}

function TimelineItem({ ev, onDelete }: { ev: AppEvent; onDelete?: () => void }) {
  return (
    <li>
      <span className={`marker ${ev.kind}`} />
      <div className="body">
        <div>
          {ev.body}
          {ev.kind !== 'stage' && <span className="kind-tag">{ev.kind}</span>}
        </div>
        <div className="when">{fmtDateTime(ev.occurred_at)}</div>
      </div>
      {onDelete && (
        <button className="btn ghost small" onClick={onDelete} aria-label="Delete note" title="Delete">
          ×
        </button>
      )}
    </li>
  )
}

/** The ad textarea, given its own tall scrolling box. Save on blur. */
function AdTextArea({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  return (
    <textarea
      className="ad-text"
      style={{ width: '100%', minHeight: 'calc(100vh - var(--h-nav) - 200px)' }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      placeholder="Paste the full job ad here."
    />
  )
}
