import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { CvVersion } from '../types'
import { TextField, TextArea, SelectField } from './fields'
import { EmptyState } from './common'
import { navigate, routes } from '../router'

export function CvLocker() {
  const store = useStore()
  const cvs = store.data.cv_versions
  const [newLabel, setNewLabel] = useState('')

  function add() {
    const label = newLabel.trim()
    if (!label) return
    store.addCvVersion(label)
    setNewLabel('')
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>CV locker</h1>
        <span className="sub">The finished files you actually sent. Roughly one base CV per profile.</span>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="inline-add">
          <input
            type="text"
            aria-label="New CV label"
            placeholder="Label, e.g. ops-v3"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn primary" onClick={add}>
            + Add CV
          </button>
        </div>
      </div>

      <div className="banner">
        <strong>Build a CV here</strong> from your evidence bank, or just track the files you send.
        Each version has a <strong>Build / Edit CV</strong> button — assemble it from lego blocks and
        export an ATS-clean PDF. You can still record an external file name or link below.
      </div>

      {cvs.length === 0 ? (
        <EmptyState
          title="No CV versions yet"
          action={
            <button className="btn primary" onClick={() => store.addCvVersion('cv-v1')}>
              Start a CV
            </button>
          }
        >
          Add a CV version, then <strong>build it</strong> from your evidence bank — one base per
          role profile. Tracking which version went to which application means that when one lands,
          you know which CV did it.
        </EmptyState>
      ) : (
        <div className="card-list">
          {cvs.map((cv) => (
            <CvCard key={cv.id} cv={cv} />
          ))}
        </div>
      )}
    </div>
  )
}

function CvCard({ cv }: { cv: CvVersion }) {
  const store = useStore()

  const usedBy = useMemo(
    () => store.data.applications.filter((a) => a.cv_version_id === cv.id),
    [store.data.applications, cv.id],
  )

  function toggleCurrent() {
    const next = !cv.is_current
    // At most one current CV per profile: unset siblings when turning this on.
    if (next && cv.profile_id) {
      store.data.cv_versions
        .filter((c) => c.id !== cv.id && c.profile_id === cv.profile_id && c.is_current)
        .forEach((c) => store.updateCvVersion(c.id, { is_current: false }))
    }
    store.updateCvVersion(cv.id, { is_current: next })
  }

  function del() {
    if (confirm(`Delete CV "${cv.label}"? Applications that used it keep their data but lose the link.`)) {
      store.deleteCvVersion(cv.id)
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>{cv.label || 'Untitled'}</h3>
        {cv.is_current && <span className="chip on">current</span>}
        {cv.layout && <span className="chip" title="Built in the CV builder">built</span>}
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn ghost small" onClick={del} aria-label="Delete CV">
          ×
        </button>
      </div>

      <a className="btn primary" style={{ marginBottom: 12 }} href={routes.cvBuild(cv.id)}>
        {cv.layout ? 'Edit CV' : 'Build this CV'}
      </a>

      <TextField label="Label" value={cv.label} onCommit={(v) => store.updateCvVersion(cv.id, { label: v })} />
      <SelectField
        label="Role profile"
        value={cv.profile_id ?? ''}
        onChange={(v) => store.updateCvVersion(cv.id, { profile_id: v || null })}
        allowEmpty="—"
        options={store.data.role_profiles.map((p) => ({ value: p.id, label: p.name }))}
      />
      <TextArea
        label="Angle"
        value={cv.angle ?? ''}
        rows={2}
        onCommit={(v) => store.updateCvVersion(cv.id, { angle: v || null })}
        placeholder="What this version leans into."
      />
      <TextField
        label="File name or link"
        value={cv.file_path ?? ''}
        onCommit={(v) => store.updateCvVersion(cv.id, { file_path: v || null })}
        placeholder="CV - operations manager v3.docx"
      />

      <label className="row" style={{ gap: 8, marginTop: 4, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={cv.is_current} onChange={toggleCurrent} style={{ width: 'auto' }} />
        <span>Current version for this profile</span>
      </label>

      <hr className="hr" />
      <div className="lbl" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
        Used by {usedBy.length} application{usedBy.length === 1 ? '' : 's'}
      </div>
      {usedBy.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Not sent with any application yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {usedBy.map((a) => (
            <a
              key={a.id}
              href={routes.application(a.id)}
              onClick={(e) => {
                e.preventDefault()
                navigate(routes.application(a.id))
              }}
            >
              {a.role}
              {a.company ? ` · ${a.company}` : ''}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
