import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { Evidence as EvidenceItem } from '../types'
import { TextField, TextArea } from './fields'
import { EmptyState } from './common'
import { fmtDate } from '../lib/dates'
import { routes } from '../router'

// The evidence bank: bullets and answers are the same story at two lengths.
// One item, two length fields. Tagged by capability, never by industry.
export function Evidence() {
  const store = useStore()
  const evidence = store.data.evidence
  const capabilities = store.data.capabilities

  const [selectedId, setSelectedId] = useState<string | null>(evidence[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [capFilter, setCapFilter] = useState('')
  const [gapsOnly, setGapsOnly] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  // Mobile drill-in: 'list' shows the bank, 'detail' shows the editor. Ignored
  // on desktop, where both are visible.
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  function openItem(id: string) {
    setSelectedId(id)
    setMobileView('detail')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return evidence
      .filter((e) => {
        if (capFilter && !e.capabilities.includes(capFilter)) return false
        if (gapsOnly && !isHalfFinished(e)) return false
        if (q) {
          const hay = `${e.title} ${e.bullet ?? ''} ${e.full_text ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [evidence, search, capFilter, gapsOnly])

  const selected =
    filtered.find((e) => e.id === selectedId) ?? evidence.find((e) => e.id === selectedId) ?? null

  function addEvidence() {
    const title = newTitle.trim()
    if (!title) return
    const item = store.addEvidence(title)
    setNewTitle('')
    setSearch('')
    setCapFilter('')
    setGapsOnly(false)
    openItem(item.id)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Evidence bank</h1>
        <span className="sub">Your stories, stored once. Tag by capability, reuse everywhere.</span>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="inline-add">
          <input
            type="text"
            aria-label="New evidence title"
            placeholder="Title, e.g. Rebuilt the prep rota"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEvidence()}
            style={{ minWidth: 240 }}
          />
          <button className="btn primary" onClick={addEvidence}>
            + Add evidence
          </button>
        </div>
      </div>

      {evidence.length === 0 ? (
        <EmptyState title="No evidence yet">
          Bank the stories you keep reaching for &mdash; a rota you rebuilt, a cost you cut, a
          conflict you defused. Store each once with a short <em>bullet</em> (CV length) and a full
          <em> answer</em> (interview length), tagged by capability. Then a CV line and an interview
          answer are the same item at two lengths, not four copies to maintain.
        </EmptyState>
      ) : (
        <div className="detail-grid master-detail" data-mobile-view={mobileView}>
          {/* LEFT: search, filter, list */}
          <div className="md-list">
            <div className="panel">
              <div className="filters" style={{ marginBottom: 10 }}>
                <div className="search-box" style={{ flex: 1 }}>
                  <input
                    type="search"
                    aria-label="Search evidence"
                    placeholder="Search title, bullet, answer…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <select
                  value={capFilter}
                  onChange={(e) => setCapFilter(e.target.value)}
                  style={{ width: 'auto', flex: 1 }}
                >
                  <option value="">All capabilities</option>
                  {capabilities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="row" style={{ gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={gapsOnly}
                    onChange={(e) => setGapsOnly(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Half-finished only</span>
                </label>
              </div>

              {filtered.length === 0 ? (
                <p className="muted" style={{ padding: '8px 2px' }}>
                  Nothing matches.{' '}
                  <button
                    className="btn small"
                    onClick={() => {
                      setSearch('')
                      setCapFilter('')
                      setGapsOnly(false)
                    }}
                  >
                    Clear filters
                  </button>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filtered.map((e) => (
                    <EvidenceRow
                      key={e.id}
                      item={e}
                      active={e.id === selected?.id}
                      onClick={() => openItem(e.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: editor (drill-in on mobile) */}
          <div className="md-detail">
            <button className="md-back btn ghost small" onClick={() => setMobileView('list')}>
              ← All evidence
            </button>
            {selected ? (
              <EvidenceEditor key={selected.id} item={selected} />
            ) : (
              <div className="panel">
                <p className="muted">Select an evidence item on the left, or add a new one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function isHalfFinished(e: EvidenceItem): boolean {
  const hasBullet = !!e.bullet?.trim()
  const hasFull = !!e.full_text?.trim()
  return hasBullet !== hasFull // exactly one filled
}

function EvidenceRow({
  item,
  active,
  onClick,
}: {
  item: EvidenceItem
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="btn ghost"
      style={{
        display: 'block',
        textAlign: 'left',
        padding: '10px 12px',
        height: 'auto',
        background: active ? 'var(--accent-soft)' : undefined,
      }}
    >
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontWeight: 600, flex: 1 }}>{item.title}</span>
        {isHalfFinished(item) && (
          <span className="chip count-1" data-tip="Only one length is filled in — add the missing bullet or full answer.">
            half-finished
          </span>
        )}
      </div>
      {item.capabilities.length > 0 && (
        <div className="chips" style={{ marginTop: 6 }}>
          {item.capabilities.map((c) => (
            <span key={c} className="chip" style={{ fontSize: 11 }}>
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {item.use_count > 0 ? `used ${item.use_count}×` : 'unused'}
        {item.last_used_at ? ` · last ${fmtDate(item.last_used_at)}` : ''}
      </div>
    </button>
  )
}

function EvidenceEditor({ item }: { item: EvidenceItem }) {
  const store = useStore()
  const capabilities = store.data.capabilities

  const half = isHalfFinished(item)

  function toggleCap(name: string) {
    const has = item.capabilities.includes(name)
    const next = has ? item.capabilities.filter((n) => n !== name) : [...item.capabilities, name]
    store.updateEvidence(item.id, { capabilities: next })
  }

  function del() {
    if (confirm(`Delete "${item.title}"? This also removes it from any applications it was used in.`)) {
      store.deleteEvidence(item.id)
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Edit evidence</h2>
          <span className="spacer" style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 13 }}>
            {item.use_count > 0 ? `Used ${item.use_count}×` : 'Not used yet'}
          </span>
          <button className="btn danger small" onClick={del}>
            Delete
          </button>
        </div>

        <div className="field-grid">
          <TextField
            label="Title"
            value={item.title}
            onCommit={(v) => store.updateEvidence(item.id, { title: v })}
            className="full"
          />
          <TextField
            label="When it happened"
            value={item.when_happened ?? ''}
            onCommit={(v) => store.updateEvidence(item.id, { when_happened: v || null })}
            placeholder="2024, first year at the cinema…"
            className="full"
          />
        </div>

        <label className="field">
          <span className="lbl">Capabilities</span>
          {capabilities.length === 0 ? (
            <p className="section-note">
              No capabilities yet. Add them under{' '}
              <a href={routes.profiles()}>Role profiles</a>, then tag this item.
            </p>
          ) : (
            <div className="chips">
              {capabilities.map((c) => {
                const on = item.capabilities.includes(c.name)
                return (
                  <button
                    key={c.id}
                    className={`chip selectable ${on ? 'on' : ''}`}
                    onClick={() => toggleCap(c.name)}
                    title={c.note ?? undefined}
                  >
                    {on ? '✓ ' : ''}
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
        </label>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>The two lengths</h2>
          <span className="spacer" style={{ flex: 1 }} />
          {half && (
            <span className="chip count-1" title="One length is empty">
              half-finished
            </span>
          )}
        </div>
        <p className="section-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Same story, two lengths: a one-line <strong>bullet</strong> for a CV, and a fuller{' '}
          <strong>answer</strong> (situation · action · result) for interviews. Fill both when you
          can &mdash; an item with only one is flagged half-finished.
        </p>
        <div className="two-length">
          <TextArea
            label="Bullet — CV length"
            value={item.bullet ?? ''}
            rows={4}
            onCommit={(v) => store.updateEvidence(item.id, { bullet: v || null })}
            placeholder="Rebuilt the prep rota, cutting weekly overtime by 30%."
          />
          <TextArea
            label="Full text — answer length"
            value={item.full_text ?? ''}
            rows={9}
            onCommit={(v) => store.updateEvidence(item.id, { full_text: v || null })}
            placeholder="The kitchen was running on a rota nobody trusted… (situation, action, result)"
          />
        </div>
      </div>
    </div>
  )
}
