import { useState } from 'react'
import { useStore } from '../store/store'
import { useEscape } from './common'
import { navigate, routes } from '../router'
import { SOURCE_SUGGESTIONS } from '../lib/constants'

// The quickest possible capture: role is the only required field. Everything
// else can be filled on the detail screen. Paste the ad text now, though —
// the link will die.
export function NewApplicationDialog({ onClose }: { onClose: () => void }) {
  const store = useStore()
  useEscape(onClose)

  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [profileId, setProfileId] = useState('')
  const [source, setSource] = useState('')
  const [link, setLink] = useState('')
  const [adText, setAdText] = useState('')

  const canSave = role.trim().length > 0

  function save() {
    if (!canSave) return
    const app = store.addApplication({
      role: role.trim(),
      company: company.trim() || null,
      profile_id: profileId || null,
      source: source.trim() || null,
      link: link.trim() || null,
      ad_text: adText.trim() || null,
    })
    onClose()
    navigate(routes.application(app.id))
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="New application">
        <h2>New application</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Just the role to start. Paste the ad now &mdash; the link won&rsquo;t last.
        </p>

        <label className="field">
          <span className="lbl">Role *</span>
          <input
            type="text"
            autoFocus
            value={role}
            placeholder="Operations Manager"
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) save()
            }}
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="lbl">Company</span>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Role profile</span>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">&mdash;</option>
              {store.data.role_profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lbl">Source</span>
            <input
              type="text"
              list="source-suggestions"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <datalist id="source-suggestions">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="lbl">Link</span>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span className="lbl">Ad text</span>
          <textarea
            rows={5}
            value={adText}
            placeholder="Paste the job ad here while you still can."
            onChange={(e) => setAdText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSave) save()
            }}
          />
        </label>

        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!canSave} onClick={save}>
            Create &amp; open
          </button>
        </div>
      </div>
    </div>
  )
}
