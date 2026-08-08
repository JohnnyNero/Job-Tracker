import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { InterviewQuestion } from '../types'
import { routes } from '../router'
import { StagePill } from './common'

// Interview prep: everything you need in the room, assembled from what you
// already captured — the ad, its criteria, your linked full-length answers, and
// what you told them — plus a question list to rehearse and, afterwards, to log
// what actually came up.
export function InterviewPrep({ id }: { id: string }) {
  const store = useStore()
  const app = store.data.applications.find((a) => a.id === id)
  const profile = store.data.role_profiles.find((p) => p.id === app?.profile_id)
  const [tab, setTab] = useState<'reference' | 'questions'>('questions')
  const [newQ, setNewQ] = useState('')

  const evidenceById = useMemo(
    () => new Map(store.data.evidence.map((e) => [e.id, e])),
    [store.data.evidence],
  )
  const criteria = useMemo(
    () =>
      store.data.criteria
        .filter((c) => c.application_id === id)
        .sort((a, b) => a.position - b.position),
    [store.data.criteria, id],
  )
  const questions = useMemo(
    () =>
      store.data.interview_questions
        .filter((q) => q.application_id === id)
        .sort((a, b) => a.position - b.position),
    [store.data.interview_questions, id],
  )
  const told = useMemo(
    () =>
      store.data.events
        .filter((e) => e.application_id === id && e.kind === 'told')
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    [store.data.events, id],
  )

  if (!app) {
    return (
      <div className="page page-narrow">
        <a className="link-back" href={routes.pipeline()}>
          ← Pipeline
        </a>
        <div className="empty">
          <h3>Application not found</h3>
          <a className="btn" href={routes.pipeline()}>
            Back to the pipeline
          </a>
        </div>
      </div>
    )
  }

  function addQ() {
    const t = newQ.trim()
    if (!t) return
    store.addInterviewQuestion(app!.id, t)
    setNewQ('')
  }

  const askedCount = questions.filter((q) => q.asked).length

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <a className="link-back" href={routes.application(app.id)}>
        ← {app.role}
        {app.company ? ` · ${app.company}` : ''}
      </a>

      <div className="page-head">
        <h1>Interview prep</h1>
        <StagePill stage={app.stage} />
        <span className="spacer" style={{ flex: 1 }} />
      </div>

      <div className="seg composer-tabs" role="tablist" aria-label="Prep panes">
        <button className={tab === 'reference' ? 'on' : ''} onClick={() => setTab('reference')}>
          Reference
        </button>
        <button className={tab === 'questions' ? 'on' : ''} onClick={() => setTab('questions')}>
          Questions{questions.length ? ` (${questions.length})` : ''}
        </button>
      </div>

      <div className="prep-grid" data-tab={tab}>
        {/* LEFT: reference */}
        <div className="compose-pane pane-reference">
          <div className="panel">
            <h2>The role</h2>
            <dl className="facts">
              <dt>Role</dt>
              <dd>{app.role}</dd>
              {app.company && (
                <>
                  <dt>Company</dt>
                  <dd>{app.company}</dd>
                </>
              )}
              {app.salary_stated && (
                <>
                  <dt>Salary</dt>
                  <dd>{app.salary_stated}</dd>
                </>
              )}
              {app.location && (
                <>
                  <dt>Location</dt>
                  <dd>{app.location}</dd>
                </>
              )}
            </dl>
          </div>

          {profile && (profile.positioning || profile.vocabulary || profile.priority_capabilities.length > 0) && (
            <div className="panel">
              <h2>Position yourself</h2>
              {profile.positioning && <p>{profile.positioning}</p>}
              {profile.vocabulary && (
                <p className="muted" style={{ fontSize: 13 }}>
                  <strong>Their words:</strong> {profile.vocabulary}
                </p>
              )}
              {profile.priority_capabilities.length > 0 && (
                <div className="chips" style={{ marginTop: 8 }}>
                  {profile.priority_capabilities.map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {criteria.length > 0 && (
            <div className="panel">
              <h2>What they’re judging</h2>
              <ul className="crit-ref">
                {criteria.map((c) => {
                  const ev = c.covered_by ? evidenceById.get(c.covered_by) : undefined
                  return (
                    <li key={c.id}>
                      <span className={`crit-dot ${c.covered_by ? 'covered' : ''}`} aria-hidden />
                      <span className="crit-text">
                        {c.text}
                        {ev && <span className="muted"> · {ev.title}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {(told.length > 0 || app.told_them) && (
            <div className="panel">
              <h2>Stay consistent — you told them</h2>
              {app.told_them && (
                <p className="muted" style={{ fontSize: 13 }}>
                  {app.told_them}
                </p>
              )}
              {told.length > 0 && (
                <ul className="tell-log" style={{ marginTop: 0 }}>
                  {told.map((e) => (
                    <li key={e.id}>
                      <div className="body">{e.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {app.ad_text && (
            <div className="panel">
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  The ad
                </summary>
                <div className="ad-text" style={{ maxHeight: '40vh', marginTop: 10 }}>
                  {app.ad_text}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* RIGHT: questions */}
        <div className="compose-pane pane-questions">
          <div className="panel">
            <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Questions</h2>
              {questions.length > 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  {askedCount}/{questions.length} came up
                </span>
              )}
              <span className="spacer" style={{ flex: 1 }} />
              <button
                className="btn small"
                onClick={() => store.addQuestionsFromCriteria(app.id)}
                disabled={criteria.length === 0}
                title={
                  criteria.length
                    ? 'Turn each criterion into a question stub'
                    : 'Add criteria on the application first'
                }
              >
                Draft from criteria
              </button>
            </div>
            <p className="section-note" style={{ marginTop: 0, marginBottom: 12 }}>
              Rehearse a story for each. Link the evidence and its full answer shows below to
              practise. After the interview, mark what actually came up.
            </p>

            {questions.length === 0 ? (
              <p className="muted" style={{ marginBottom: 12 }}>
                No questions yet. <strong>Draft from criteria</strong> to seed them from the ad, or
                add your own below.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} q={q} first={i === 0} last={i === questions.length - 1} />
                ))}
              </div>
            )}

            <div className="inline-add">
              <input
                type="text"
                aria-label="New interview question"
                placeholder="Add a question you expect…"
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addQ()}
              />
              <button className="btn" onClick={addQ}>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({ q, first, last }: { q: InterviewQuestion; first: boolean; last: boolean }) {
  const store = useStore()
  const evidence = store.data.evidence
  const linked = q.covered_by ? evidence.find((e) => e.id === q.covered_by) : undefined
  const answer = linked?.full_text || linked?.bullet || ''

  const [text, setText] = useState(q.text)
  const [notes, setNotes] = useState(q.notes ?? '')
  useEffect(() => setText(q.text), [q.text])
  useEffect(() => setNotes(q.notes ?? ''), [q.notes])

  // Grow the question box to fit its text — questions wrap on narrow screens and
  // a fixed one-row height would clip them.
  const [textEl, setTextEl] = useState<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    if (!textEl) return
    textEl.style.height = 'auto'
    textEl.style.height = textEl.scrollHeight + 'px'
  }, [textEl, text])

  return (
    <div className={`prep-q ${q.asked ? 'asked' : ''}`}>
      <div className="prep-q-head">
        <textarea
          ref={setTextEl}
          className="prep-q-text"
          aria-label="Interview question"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text !== q.text && store.updateInterviewQuestion(q.id, { text: text.trim() })}
        />
        <button
          className={`chip selectable ${q.asked ? 'on' : ''}`}
          onClick={() => store.updateInterviewQuestion(q.id, { asked: !q.asked })}
          title="Mark whether this came up in the interview"
          style={{ whiteSpace: 'nowrap' }}
        >
          {q.asked ? '✓ Came up' : 'Came up?'}
        </button>
        <button className="btn ghost small" onClick={() => store.moveInterviewQuestion(q.id, -1)} disabled={first} aria-label="Move up" title="Move up">
          ↑
        </button>
        <button className="btn ghost small" onClick={() => store.moveInterviewQuestion(q.id, 1)} disabled={last} aria-label="Move down" title="Move down">
          ↓
        </button>
        <button className="btn ghost small" onClick={() => store.deleteInterviewQuestion(q.id)} aria-label="Delete question" title="Delete">
          ×
        </button>
      </div>

      <div className="row" style={{ gap: 8, margin: '8px 0 6px' }}>
        <span className="lbl" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
          Story
        </span>
        <select
          value={q.covered_by ?? ''}
          onChange={(e) => store.updateInterviewQuestion(q.id, { covered_by: e.target.value || null })}
          aria-label="Evidence story for this question"
          style={{ width: 'auto', flex: 1, maxWidth: 320 }}
        >
          <option value="">— pick a story —</option>
          {evidence.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>
      </div>

      {linked && answer && <div className="prep-answer">{answer}</div>}
      {linked && !answer && (
        <p className="section-note">
          “{linked.title}” has no full answer yet — add one in the evidence bank to rehearse it.
        </p>
      )}

      <textarea
        className="prep-q-notes"
        aria-label="Answer notes"
        rows={2}
        placeholder="Your angle / reminders for this answer…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (q.notes ?? '') && store.updateInterviewQuestion(q.id, { notes: notes || null })}
      />
    </div>
  )
}
