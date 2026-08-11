import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import type { AppEvent, Application, Stage } from '../types'
import { STAGES } from '../types'
import { STAGE_LABELS, STAGE_TONE, OUTCOME_LABELS, SOURCE_SUGGESTIONS } from '../lib/constants'
import { fmtDateTime } from '../lib/dates'
import { navigate, routes } from '../router'
import { TextField, TextArea, DateField, UrlField, SelectField } from './fields'
import { StagePill } from './common'
import { CloseDialog } from './CloseDialog'
import { CriteriaPanel } from './CriteriaPanel'
import { CvForApplication } from './CvForApplication'

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
  // 'told' and 'draft' have their own panels, so keep them out of the timeline.
  const events = store.data.events
    .filter((e) => e.application_id === app.id && e.kind !== 'told' && e.kind !== 'draft')
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
        <a
          className={`btn ${app.stage === 'interview' || app.stage === 'final_stage' ? 'primary' : ''}`}
          href={routes.prep(app.id)}
        >
          Prep…
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

          <CriteriaPanel applicationId={app.id} adText={app.ad_text} />

          <CvForApplication app={app} />

          <div className="panel">
            <h2>Told them</h2>
            <p className="section-note" style={{ marginTop: 0, marginBottom: 10 }}>
              Salary quoted, notice period, start date &mdash; each entry is dated, so what you
              committed to survives when someone rings six weeks later.
            </p>
            <TellLog app={app} />
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

          <DraftsPanel app={app} />
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
      <select value={kind} onChange={(e) => setKind(e.target.value as AppEvent['kind'])} style={{ width: 'auto' }} aria-label="Timeline entry type">
        <option value="note">Note</option>
        <option value="contact">Contact</option>
      </select>
      <input
        type="text"
        className="grow"
        aria-label="Timeline note"
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

/** Append-only "told them" commitments log, built on 'told' events so each is
 * dated. A legacy told_them summary (from before this was a log) shows pinned. */
function TellLog({ app }: { app: Application }) {
  const store = useStore()
  const [text, setText] = useState('')
  const entries = store.data.events
    .filter((e) => e.application_id === app.id && e.kind === 'told')
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  function add() {
    const t = text.trim()
    if (!t) return
    store.addEvent(app.id, 'told', t)
    setText('')
  }

  return (
    <div>
      <div className="row" style={{ gap: 8 }}>
        <input
          type="text"
          className="grow"
          aria-label="What you told them"
          placeholder="e.g. Quoted 1 month notice; said £34k current, seeking £38k+"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn" onClick={add} disabled={!text.trim()}>
          Log
        </button>
      </div>
      {app.told_them && (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          <span style={{ fontWeight: 600 }}>Earlier note:</span> {app.told_them}
        </p>
      )}
      {entries.length > 0 && (
        <ul className="tell-log">
          {entries.map((e) => (
            <li key={e.id}>
              <div className="body">
                <div>{e.body}</div>
                <div className="when">{fmtDateTime(e.occurred_at)}</div>
              </div>
              <button
                className="btn ghost small"
                onClick={() => store.deleteEvent(e.id)}
                aria-label="Delete entry"
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Snapshots of drafts copied from the composer for this application, so
 * "which version did I send here?" is answerable months later. */
function DraftsPanel({ app }: { app: Application }) {
  const store = useStore()
  const drafts = store.data.events
    .filter((e) => e.application_id === app.id && e.kind === 'draft')
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  if (drafts.length === 0) return null
  return (
    <div className="panel">
      <h2>Drafts sent</h2>
      <p className="section-note" style={{ marginTop: 0, marginBottom: 10 }}>
        Snapshots of what you copied from the composer for this application.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drafts.map((d) => (
          <DraftItem key={d.id} id={d.id} body={d.body} when={fmtDateTime(d.occurred_at)} />
        ))}
      </div>
    </div>
  )
}

function DraftItem({ id, body, when }: { id: string; body: string; when: string }) {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const preview = body.length > 140 ? body.slice(0, 140) + '…' : body
  return (
    <div className="draft-snap">
      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
        <span className="when" style={{ flex: 1, fontSize: 12, color: 'var(--text-3)' }}>{when}</span>
        <button className="btn ghost small" onClick={() => navigator.clipboard?.writeText(body)} title="Copy again">
          Copy
        </button>
        <button className="btn ghost small" onClick={() => setOpen((o) => !o)}>
          {open ? 'Less' : 'More'}
        </button>
        <button
          className="btn ghost small"
          onClick={() => confirm('Delete this draft snapshot?') && store.deleteEvent(id)}
          aria-label="Delete draft"
          title="Delete"
        >
          ×
        </button>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-2)' }}>
        {open ? body : preview}
      </div>
    </div>
  )
}

/** The ad textarea, given its own tall scrolling box. Saves on blur, and also
 * commits right after a paste so "Extract from ad" reads the fresh text. */
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
      onPaste={(e) => {
        // Commit once the pasted text has landed, so Extract sees it without a blur.
        const el = e.currentTarget
        setTimeout(() => {
          if (el.value !== value) onCommit(el.value)
        }, 0)
      }}
      placeholder="Paste the full job ad here."
    />
  )
}
