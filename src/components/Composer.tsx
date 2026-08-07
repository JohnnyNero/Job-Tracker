import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { Evidence } from '../types'
import { routes } from '../router'

// The composer: three panes, side by side. It CONCATENATES — it never rewrites,
// blends, or generates. You do the framing yourself before copying. Left: what
// you're answering + the profile's positioning. Middle: the evidence bank,
// filtered to the profile's priority capabilities, click-to-insert. Right: the
// draft, as reorderable blocks. "Copy all" copies the concatenation, records
// the evidence links, and bumps use_count.

type Length = 'bullet' | 'full_text'

interface Block {
  key: string
  evidenceId: string
  length: Length
  text: string
}

export function Composer({ id }: { id: string }) {
  const store = useStore()
  const app = store.data.applications.find((a) => a.id === id)
  const profile = store.data.role_profiles.find((p) => p.id === app?.profile_id)

  const [blocks, setBlocks] = useState<Block[]>([])
  const [search, setSearch] = useState('')
  const [priorityOnly, setPriorityOnly] = useState(true)
  const [question, setQuestion] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const keySeq = useRef(1)
  const dragFrom = useRef<number | null>(null)

  const priorityCaps = profile?.priority_capabilities ?? []
  const hasPriority = priorityCaps.length > 0

  const evidence = useMemo(() => {
    const q = search.trim().toLowerCase()
    return store.data.evidence
      .filter((e) => {
        if (priorityOnly && hasPriority) {
          if (!e.capabilities.some((c) => priorityCaps.includes(c))) return false
        }
        if (q) {
          const hay = `${e.title} ${e.bullet ?? ''} ${e.full_text ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [store.data.evidence, search, priorityOnly, hasPriority, priorityCaps])

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

  function insert(e: Evidence, length: Length) {
    const text = (length === 'bullet' ? e.bullet : e.full_text) ?? ''
    setBlocks((bs) => [...bs, { key: 'b' + keySeq.current++, evidenceId: e.id, length, text }])
  }

  function setBlockText(key: string, text: string) {
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, text } : b)))
  }

  function removeBlock(key: string) {
    setBlocks((bs) => bs.filter((b) => b.key !== key))
  }

  function move(from: number, to: number) {
    setBlocks((bs) => {
      if (to < 0 || to >= bs.length) return bs
      const next = [...bs]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function saveToBank(b: Block) {
    store.updateEvidence(b.evidenceId, { [b.length]: b.text || null })
    flashMsg('Saved back to the evidence item.')
  }

  function flashMsg(m: string) {
    setFlash(m)
    window.setTimeout(() => setFlash(null), 3000)
  }

  async function copyAll() {
    const text = blocks
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join('\n\n')
    if (!text) return
    const ok = await copyToClipboard(text)
    // Record usage regardless of clipboard success — the intent to use is real.
    store.recordEvidenceUse(
      app!.id,
      blocks.map((b) => b.evidenceId),
    )
    const distinct = new Set(blocks.map((b) => b.evidenceId)).size
    flashMsg(
      (ok ? 'Copied' : 'Could not access clipboard — select and copy manually.') +
        ` · recorded ${distinct} evidence item${distinct === 1 ? '' : 's'} used.`,
    )
  }

  return (
    <div className="page" style={{ maxWidth: 1680 }}>
      <a className="link-back" href={routes.application(app.id)}>
        ← {app.role}
        {app.company ? ` · ${app.company}` : ''}
      </a>

      <div className="page-head">
        <h1>Composer</h1>
        <span className="sub">Insert · arrange · copy. It concatenates; you do the framing.</span>
        {flash && <span className="saved-flash">{flash}</span>}
      </div>

      <div className="composer-grid">
        {/* LEFT: what you're answering + positioning */}
        <div className="compose-pane">
          <div className="panel">
            <h2>Answering</h2>
            <textarea
              rows={5}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Paste the question or the criterion you're answering, for reference while you write."
            />
            <p className="section-note">
              Phase 4 will pull these from the ad automatically. For now, keep the prompt in view
              here.
            </p>
          </div>

          {profile ? (
            <div className="panel">
              <h2>{profile.name}</h2>
              {profile.positioning && (
                <p style={{ marginBottom: 10 }}>{profile.positioning}</p>
              )}
              {profile.vocabulary && (
                <>
                  <div className="lbl" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                    Vocabulary
                  </div>
                  <p className="muted" style={{ fontSize: 13 }}>{profile.vocabulary}</p>
                </>
              )}
              {hasPriority && (
                <div className="chips" style={{ marginTop: 10 }}>
                  {priorityCaps.map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="panel">
              <p className="muted">
                No role profile on this application. Set one on the{' '}
                <a href={routes.application(app.id)}>detail screen</a> to filter the bank by its
                priority capabilities.
              </p>
            </div>
          )}
        </div>

        {/* MIDDLE: the evidence bank */}
        <div className="compose-pane">
          <div className="panel" style={{ position: 'sticky', top: 'calc(var(--h-nav) + 16px)' }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Evidence</h2>
              <span className="spacer" style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12 }}>{evidence.length}</span>
            </div>
            <input
              type="search"
              placeholder="Search the bank…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            {hasPriority && (
              <label className="row" style={{ gap: 6, cursor: 'pointer', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={priorityOnly}
                  onChange={(e) => setPriorityOnly(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span style={{ fontSize: 13 }}>Priority capabilities only</span>
              </label>
            )}

            <div className="ev-scroll">
              {evidence.length === 0 ? (
                <p className="muted" style={{ padding: '6px 2px' }}>
                  {store.data.evidence.length === 0
                    ? 'Your evidence bank is empty. Add stories on the Evidence screen first.'
                    : 'Nothing matches. Widen the search or turn off the priority filter.'}
                </p>
              ) : (
                evidence.map((e) => (
                  <div key={e.id} className="ev-card">
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    {e.capabilities.length > 0 && (
                      <div className="chips" style={{ margin: '6px 0' }}>
                        {e.capabilities.map((c) => (
                          <span key={c} className="chip" style={{ fontSize: 11 }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className="btn small"
                        disabled={!e.bullet}
                        onClick={() => insert(e, 'bullet')}
                        title={e.bullet ? 'Insert the bullet' : 'No bullet on this item'}
                      >
                        + Bullet
                      </button>
                      <button
                        className="btn small"
                        disabled={!e.full_text}
                        onClick={() => insert(e, 'full_text')}
                        title={e.full_text ? 'Insert the full answer' : 'No full text on this item'}
                      >
                        + Full
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: the draft */}
        <div className="compose-pane">
          <div className="panel">
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Draft</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                {blocks.length} block{blocks.length === 1 ? '' : 's'}
              </span>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn primary" onClick={copyAll} disabled={blocks.length === 0}>
                Copy all
              </button>
            </div>

            {blocks.length === 0 ? (
              <div className="empty" style={{ padding: '28px 20px' }}>
                <h3>Nothing inserted yet</h3>
                <p>
                  Click <strong>+ Bullet</strong> or <strong>+ Full</strong> on the evidence in the
                  middle to drop it here. Edit freely, drag to reorder, then <strong>Copy all</strong>{' '}
                  and paste into your application. Editing here doesn&rsquo;t change the bank unless
                  you save it back.
                </p>
              </div>
            ) : (
              <div>
                {blocks.map((b, i) => {
                  const source = store.data.evidence.find((e) => e.id === b.evidenceId)
                  const sourceText = (b.length === 'bullet' ? source?.bullet : source?.full_text) ?? ''
                  const dirty = b.text !== sourceText
                  return (
                    <div
                      key={b.key}
                      className="draft-block"
                      draggable
                      onDragStart={() => (dragFrom.current = i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragFrom.current !== null) move(dragFrom.current, i)
                        dragFrom.current = null
                      }}
                    >
                      <div className="draft-head">
                        <span className="drag-handle" title="Drag to reorder" aria-hidden>
                          ⠿
                        </span>
                        <span className="muted" style={{ fontSize: 12, flex: 1 }}>
                          {source?.title ?? 'Deleted item'} ·{' '}
                          {b.length === 'bullet' ? 'bullet' : 'full'}
                        </span>
                        <button className="btn ghost small" onClick={() => move(i, i - 1)} disabled={i === 0} title="Move up" aria-label="Move up">
                          ↑
                        </button>
                        <button
                          className="btn ghost small"
                          onClick={() => move(i, i + 1)}
                          disabled={i === blocks.length - 1}
                          title="Move down"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button className="btn ghost small" onClick={() => removeBlock(b.key)} title="Remove" aria-label="Remove">
                          ×
                        </button>
                      </div>
                      <textarea
                        rows={b.length === 'bullet' ? 2 : 6}
                        value={b.text}
                        onChange={(ev) => setBlockText(b.key, ev.target.value)}
                      />
                      {dirty && source && (
                        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                          <button className="btn small" onClick={() => saveToBank(b)}>
                            Save changes to this item
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers / contexts without the async clipboard API.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
