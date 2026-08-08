import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { RoleProfile } from '../types'
import { TextField, TextArea } from './fields'
import { EmptyState } from './common'

export function Profiles() {
  const store = useStore()
  const profiles = store.data.role_profiles
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null)
  const [newName, setNewName] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null

  function openProfile(id: string) {
    setSelectedId(id)
    setMobileView('detail')
  }

  function addProfile() {
    const name = newName.trim()
    if (!name) return
    const p = store.addProfile(name)
    setNewName('')
    openProfile(p.id)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Role profiles</h1>
        <span className="sub">The framing layer: positioning, priority capabilities, vocabulary.</span>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          title="No role profiles yet"
          action={
            <div className="inline-add" style={{ justifyContent: 'center' }}>
              <input
                type="text"
                aria-label="New profile name"
                placeholder="e.g. General operations manager"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProfile()}
                style={{ maxWidth: 320 }}
              />
              <button className="btn primary" onClick={addProfile}>
                Add profile
              </button>
            </div>
          }
        >
          A profile holds how you frame yourself for a kind of role &mdash; not the facts, which
          live once in the evidence bank. Start with the two or three kinds of role you actually
          apply for.
        </EmptyState>
      ) : (
        <div className="detail-grid master-detail" data-mobile-view={mobileView}>
          <div className="md-list">
            <div className="panel">
              <h2>Profiles</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    className={`btn ghost ${p.id === selected?.id ? '' : ''}`}
                    style={{
                      justifyContent: 'flex-start',
                      background: p.id === selected?.id ? 'var(--accent-soft)' : undefined,
                      fontWeight: p.id === selected?.id ? 600 : 500,
                    }}
                    onClick={() => openProfile(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <hr className="hr" />
              <div className="inline-add">
                <input
                  type="text"
                  aria-label="New profile name"
                  placeholder="New profile name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addProfile()}
                />
                <button className="btn" onClick={addProfile}>
                  Add
                </button>
              </div>
            </div>

            <CapabilityManager />
          </div>

          <div className="md-detail">
            <button className="md-back btn ghost small" onClick={() => setMobileView('list')}>
              ← All profiles
            </button>
            {selected && <ProfileEditor key={selected.id} profile={selected} />}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileEditor({ profile }: { profile: RoleProfile }) {
  const store = useStore()
  const capabilities = store.data.capabilities
  const evidence = store.data.evidence

  const coverage = useMemo(() => {
    return profile.priority_capabilities.map((name) => ({
      name,
      count: evidence.filter((e) => e.capabilities.includes(name)).length,
    }))
  }, [profile.priority_capabilities, evidence])

  function togglePriority(name: string) {
    const has = profile.priority_capabilities.includes(name)
    const next = has
      ? profile.priority_capabilities.filter((n) => n !== name)
      : [...profile.priority_capabilities, name]
    store.updateProfile(profile.id, { priority_capabilities: next })
  }

  function del() {
    if (confirm(`Delete profile "${profile.name}"? Applications keep their data but lose the link.`)) {
      store.deleteProfile(profile.id)
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Edit profile</h2>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn danger small" onClick={del}>
            Delete
          </button>
        </div>

        <TextField label="Name" value={profile.name} onCommit={(v) => store.updateProfile(profile.id, { name: v })} />
        <TextArea
          label="Positioning"
          value={profile.positioning ?? ''}
          rows={3}
          onCommit={(v) => store.updateProfile(profile.id, { positioning: v || null })}
          placeholder="The two-line pitch for this kind of role."
        />
        <TextArea
          label="Vocabulary"
          value={profile.vocabulary ?? ''}
          rows={2}
          onCommit={(v) => store.updateProfile(profile.id, { vocabulary: v || null })}
          placeholder="Terms this sector uses (P&L, covers, SLA…)."
        />

        <label className="field">
          <span className="lbl">Priority capabilities</span>
          {capabilities.length === 0 ? (
            <p className="section-note">Add capabilities in the panel on the left, then select them here.</p>
          ) : (
            <div className="chips">
              {capabilities.map((c) => {
                const on = profile.priority_capabilities.includes(c.name)
                return (
                  <button
                    key={c.id}
                    className={`chip selectable ${on ? 'on' : ''}`}
                    onClick={() => togglePriority(c.name)}
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
        <h2>Coverage</h2>
        <p className="section-note" style={{ marginTop: 0, marginBottom: 10 }}>
          Evidence items matching each priority capability. Zero (red) and one (amber) are the gaps
          to write about <em>before</em> you need them.
        </p>
        {coverage.length === 0 ? (
          <p className="muted">Select priority capabilities above to see coverage.</p>
        ) : (
          <div className="chips">
            {coverage.map((c) => (
              <span
                key={c.name}
                className={`chip ${c.count === 0 ? 'count-0' : c.count === 1 ? 'count-1' : ''}`}
                data-tip={`${c.count} evidence item${c.count === 1 ? '' : 's'} tagged “${c.name}”. Zero/one are gaps to write about.`}
              >
                {c.name} · <strong>{c.count}</strong>
              </span>
            ))}
          </div>
        )}
        {store.data.evidence.length === 0 && (
          <p className="section-note">
            Coverage counts fill in once you build the evidence bank (Phase 2).
          </p>
        )}
      </div>
    </div>
  )
}

function CapabilityManager() {
  const store = useStore()
  const caps = store.data.capabilities
  const [name, setName] = useState('')

  function add() {
    const n = name.trim()
    if (!n) return
    store.addCapability(n)
    setName('')
  }

  return (
    <div className="panel">
      <h2>Capabilities</h2>
      <p className="section-note" style={{ marginTop: 0, marginBottom: 10 }}>
        The shared vocabulary. Keep it small (~15&ndash;25) and curated so you never get
        &ldquo;rotas&rdquo; vs &ldquo;scheduling&rdquo; near-duplicates.
      </p>
      {caps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {caps.map((c) => (
            <div key={c.id} className="row" style={{ gap: 6 }}>
              <input
                type="text"
                defaultValue={c.name}
                aria-label="Capability name"
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && store.updateCapability(c.id, { name: e.target.value.trim() })}
              />
              <button
                className="btn ghost small"
                title="Delete capability"
                aria-label="Delete capability"
                onClick={() =>
                  confirm(`Delete capability "${c.name}"?`) && store.deleteCapability(c.id)
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="inline-add">
        <input
          type="text"
          aria-label="New capability"
          placeholder="Add a capability…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn" onClick={add}>
          Add
        </button>
      </div>
    </div>
  )
}
