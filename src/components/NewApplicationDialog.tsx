import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { NewPrefill } from '../router'
import { useEscape, useModalFocus } from './common'
import { navigate, routes } from '../router'
import { SOURCE_SUGGESTIONS } from '../lib/constants'
import { parseAd, titleToRoleCompany, sourceFromUrl } from '../lib/parseAd'
import { splitCriteria } from '../lib/criteria'
import { extractKeywords } from '../lib/keywords'

// Compute initial field values from a capture prefill (bookmarklet / share):
// selection text runs through the ad parser; the page title backfills role /
// company; the URL becomes the link and infers the source.
function initialFrom(prefill?: NewPrefill) {
  const pf = prefill ?? {}
  const ad = pf.text ?? ''
  const p = ad ? parseAd(ad) : {}
  const t = pf.title ? titleToRoleCompany(pf.title) : { role: '', company: '' }
  return {
    adText: ad,
    role: p.role || t.role || '',
    company: p.company || t.company || '',
    location: p.location || '',
    salary: p.salary || '',
    link: pf.url ?? '',
    source: pf.url ? sourceFromUrl(pf.url) : '',
    filled: !!(p.role || t.role || p.company || t.company),
  }
}

// Paste-to-create. Paste the ad and the fields fill themselves; the ad is
// archived and its requirements seed the criteria checklist — so capturing an
// application costs one paste, not a form. Role is the only required field.
// A capture prefill (from the bookmarklet or the phone share sheet) seeds it.
export function NewApplicationDialog({ onClose, prefill }: { onClose: () => void; prefill?: NewPrefill }) {
  const store = useStore()
  const ref = useRef<HTMLDivElement>(null)
  useEscape(onClose)
  useModalFocus(ref)

  const [init] = useState(() => initialFrom(prefill))
  const [adText, setAdText] = useState(init.adText)
  const [role, setRole] = useState(init.role)
  const [company, setCompany] = useState(init.company)
  const [location, setLocation] = useState(init.location)
  const [salary, setSalary] = useState(init.salary)
  const [profileId, setProfileId] = useState('')
  const [source, setSource] = useState(init.source)
  const [link, setLink] = useState(init.link)
  const [filled, setFilled] = useState(init.filled)

  // Remember what we auto-filled so a re-parse never clobbers a manual edit.
  const auto = useRef<{ role: string; company: string; location: string; salary: string }>({
    role: init.role,
    company: init.company,
    location: init.location,
    salary: init.salary,
  })

  const canSave = role.trim().length > 0
  const criteriaCount = splitCriteria(adText).length

  function onAdChange(text: string) {
    setAdText(text)
    const p = parseAd(text)
    const prev = auto.current
    // Only fill a field if it's empty or still holds the value we auto-filled.
    if (p.role && (role === '' || role === prev.role)) setRole(p.role)
    if (p.company && (company === '' || company === prev.company)) setCompany(p.company)
    if (p.location && (location === '' || location === prev.location)) setLocation(p.location)
    if (p.salary && (salary === '' || salary === prev.salary)) setSalary(p.salary)
    auto.current = {
      role: p.role ?? prev.role,
      company: p.company ?? prev.company,
      location: p.location ?? prev.location,
      salary: p.salary ?? prev.salary,
    }
    if (p.role || p.company || p.location || p.salary) setFilled(true)
  }

  function save() {
    if (!canSave) return
    // Seed the criteria checklist and keyword list from the ad at capture time.
    const criteria = splitCriteria(adText)
    const keywords = extractKeywords(adText, criteria.join('\n'))
    const app = store.addApplication({
      role: role.trim(),
      company: company.trim() || null,
      location: location.trim() || null,
      salary_stated: salary.trim() || null,
      profile_id: profileId || null,
      source: source.trim() || null,
      link: link.trim() || null,
      ad_text: adText.trim() || null,
      keywords,
    })
    if (criteria.length) store.addCriteriaBulk(app.id, criteria)
    onClose()
    navigate(routes.application(app.id))
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-label="New application"
        ref={ref}
        tabIndex={-1}
      >
        <h2>New application</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Paste the ad &mdash; the fields fill in, it&rsquo;s archived, and its requirements become a
          criteria checklist. Fix anything that&rsquo;s wrong.
        </p>

        <label className="field">
          <span className="lbl">Job ad</span>
          <textarea
            rows={6}
            autoFocus
            value={adText}
            placeholder="Paste the full job ad here."
            onChange={(e) => onAdChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSave) save()
            }}
          />
          <span className="section-note" aria-live="polite">
            {filled ? 'Filled from the ad below — edit anything. ' : ''}
            {criteriaCount > 0
              ? `${criteriaCount} criteria will seed the checklist.`
              : 'Fields you leave blank are fine — add them later.'}
          </span>
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="lbl">Role *</span>
            <input
              type="text"
              value={role}
              placeholder="Operations Manager"
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) save()
              }}
            />
          </label>
          <label className="field">
            <span className="lbl">Company</span>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Location</span>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Salary stated</span>
            <input type="text" value={salary} onChange={(e) => setSalary(e.target.value)} />
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
          <label className="field full">
            <span className="lbl">Link</span>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} />
          </label>
        </div>

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
