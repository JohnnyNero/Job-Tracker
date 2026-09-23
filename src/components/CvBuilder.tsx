import { useState } from 'react'
import { useStore } from '../store/store'
import type { CvBullet, CvExperience, CvEducation, CvLayout, CvVersion, SkillGroup } from '../types'
import { navigate, routes } from '../router'
import { TextField, TextArea } from './fields'
import { CvPreview } from './CvPreview'
import { assembleCv, cvToMarkdown, cvToJsonResume, cvToDoc } from '../lib/cv'
import type { RenderedCv } from '../lib/cv'
import { checkBullet } from '../lib/cvChecks'
import { keywordsForApp, keywordCoverage } from '../lib/keywords'
import { CV_TEMPLATES } from '../lib/cvTemplates'

const EMPTY_LAYOUT: CvLayout = {
  summary: null,
  hidden_experience_ids: [],
  hidden_education_ids: [],
  bullets: {},
  skills: null,
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// The CV builder: assemble one CV version from your "about you" record, work
// history, and evidence-bank bullets, then export an ATS-clean PDF/Word/
// Markdown/JSON Resume. Left pane edits, right pane is the live document.
export function CvBuilder({ id, appId }: { id: string; appId?: string }) {
  const store = useStore()
  const version = store.data.cv_versions.find((c) => c.id === id)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  if (!version) {
    return (
      <div className="page page-narrow">
        <a className="link-back" href={routes.cv()}>
          ← CV locker
        </a>
        <div className="empty">
          <h3>CV not found</h3>
          <a className="btn" href={routes.cv()}>
            Back to the CV locker
          </a>
        </div>
      </div>
    )
  }

  const layout = version.layout ?? EMPTY_LAYOUT
  const cv = assembleCv(store.data, id) as RenderedCv
  const patchLayout = (p: Partial<CvLayout>) => store.updateCvLayout(id, p)
  const slug = (version.label || 'cv').replace(/[^a-z0-9-_]+/gi, '-')

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <a className="link-back" href={routes.cv()}>
        ← CV locker
      </a>
      <div className="page-head">
        <h1>CV builder</h1>
        <span className="sub">{version.label}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" onClick={() => download(`${slug}.doc`, cvToDoc(cv), 'application/msword')}>
          Word (.doc)
        </button>
        <button className="btn" onClick={() => download(`${slug}.md`, cvToMarkdown(cv), 'text/markdown')}>
          Markdown
        </button>
        <button
          className="btn"
          onClick={() => download(`${slug}.resume.json`, JSON.stringify(cvToJsonResume(cv), null, 2), 'application/json')}
        >
          JSON Resume
        </button>
        <button className="btn primary" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>

      <div className="seg composer-tabs" role="tablist" aria-label="Builder panes">
        <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>
          Edit
        </button>
        <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
          Preview
        </button>
      </div>

      <div className="cv-build-grid" data-tab={tab}>
        <div className="compose-pane cv-build-editor">
          <VersionMeta version={version} />
          <AboutYou />
          <SummaryPanel layout={layout} personSummary={store.data.person.summary} patchLayout={patchLayout} />
          <TailorPanel cv={cv} versionId={id} layout={layout} defaultAppId={appId} />
          <ExperiencePanel layout={layout} patchLayout={patchLayout} />
          <EducationPanel layout={layout} patchLayout={patchLayout} />
        </div>

        <div className="compose-pane cv-build-preview">
          <div className="cv-template-picker">
            <span className="lbl">Template</span>
            <div className="cv-template-btns">
              {CV_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className={`btn small ${(layout.template || 'classic') === t.id ? 'primary' : ''}`}
                  onClick={() => patchLayout({ template: t.id })}
                  title={t.blurb}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="cv-sheet-wrap">
            <CvPreview cv={cv} printable template={layout.template} />
          </div>
          <p className="section-note" style={{ marginTop: 10 }}>
            <strong>Print / PDF</strong> opens your browser&rsquo;s print dialog — choose{' '}
            <em>Save as PDF</em>, and for the cleanest result set margins to Default and turn
            <em> Headers and footers</em> off. The output is single-column selectable text, so ATS
            can read it.
          </p>
        </div>
      </div>
    </div>
  )
}

function VersionMeta({ version }: { version: CvVersion }) {
  const store = useStore()
  const profile = version.profile_id
    ? store.data.role_profiles.find((p) => p.id === version.profile_id)
    : null

  return (
    <div className="panel">
      <h2>This CV</h2>
      <div className="field-grid">
        <TextField label="Label" value={version.label} onCommit={(v) => store.updateCvVersion(version.id, { label: v })} />
        <TextField
          label="Angle"
          value={version.angle ?? ''}
          onCommit={(v) => store.updateCvVersion(version.id, { angle: v || null })}
          placeholder="What this version leans into."
        />
      </div>
      <p className="section-note">
        {profile ? (
          <>
            Allocated to the <strong>{profile.name}</strong> profile
            {version.is_current ? ' (its current CV)' : ''}.{' '}
          </>
        ) : (
          'Not allocated to a role profile yet. '
        )}
        Set which profile pulls this CV in — and mark it current — under{' '}
        <a href={routes.profiles()} onClick={(e) => { e.preventDefault(); navigate(routes.profiles()) }}>
          Role profiles
        </a>
        .
      </p>
    </div>
  )
}

function AboutYou() {
  const store = useStore()
  const p = store.data.person

  return (
    <div className="panel">
      <h2>About you</h2>
      <div className="field-grid">
        <TextField label="Full name" value={p.full_name} onCommit={(v) => store.updatePerson({ full_name: v })} className="full" />
        <TextField label="Headline" value={p.headline ?? ''} onCommit={(v) => store.updatePerson({ headline: v || null })} placeholder="Operations Manager" className="full" />
        <TextField label="Email" value={p.email ?? ''} onCommit={(v) => store.updatePerson({ email: v || null })} />
        <TextField label="Phone" value={p.phone ?? ''} onCommit={(v) => store.updatePerson({ phone: v || null })} />
        <TextField label="Location" value={p.location ?? ''} onCommit={(v) => store.updatePerson({ location: v || null })} />
      </div>
      <TextArea
        label="Links (one per line)"
        value={p.links.join('\n')}
        rows={2}
        onCommit={(v) => store.updatePerson({ links: v.split('\n').map((s) => s.trim()).filter(Boolean) })}
        placeholder="linkedin.com/in/you"
      />
      <TextArea
        label="Default summary"
        value={p.summary ?? ''}
        rows={3}
        onCommit={(v) => store.updatePerson({ summary: v || null })}
        placeholder="A two-line pitch — used on every CV unless a version overrides it."
      />
      <div className="field">
        <span className="lbl">Skills</span>
        <p className="section-note" style={{ marginTop: 0, marginBottom: 8 }}>
          Group skills into optional sub-categories (Technical, Leadership…), or leave a category
          blank for a plain list.
        </p>
        <SkillsEditor groups={p.skills} onChange={(g) => store.updatePerson({ skills: g })} />
      </div>
    </div>
  )
}

/** Edit grouped skills. Operates on the committed groups directly; when there are
 * none, a single implicit unnamed group lets you just start typing (the flat,
 * category-free case). */
function SkillsEditor({ groups, onChange }: { groups: SkillGroup[]; onChange: (g: SkillGroup[]) => void }) {
  const base: SkillGroup[] = groups.length ? groups : [{ name: '', items: [] }]
  const setGroup = (i: number, patch: Partial<SkillGroup>) =>
    onChange(base.map((g, gi) => (gi === i ? { ...g, ...patch } : g)))

  return (
    <div className="skills-editor">
      {base.map((g, i) => (
        <SkillGroupRow
          key={i}
          group={g}
          removable={base.length > 1}
          onName={(name) => setGroup(i, { name })}
          onAdd={(raw) => {
            const t = raw.trim()
            if (!t || g.items.some((x) => x.toLowerCase() === t.toLowerCase())) return
            setGroup(i, { items: [...g.items, t] })
          }}
          onRemoveItem={(item) => setGroup(i, { items: g.items.filter((x) => x !== item) })}
          onRemoveGroup={() => onChange(base.filter((_, gi) => gi !== i))}
        />
      ))}
      <button type="button" className="btn ghost small" onClick={() => onChange([...base, { name: '', items: [] }])}>
        + Add category
      </button>
    </div>
  )
}

function SkillGroupRow({
  group,
  removable,
  onName,
  onAdd,
  onRemoveItem,
  onRemoveGroup,
}: {
  group: SkillGroup
  removable: boolean
  onName: (name: string) => void
  onAdd: (item: string) => void
  onRemoveItem: (item: string) => void
  onRemoveGroup: () => void
}) {
  const [entry, setEntry] = useState('')
  const add = () => {
    if (entry.trim()) {
      onAdd(entry)
      setEntry('')
    }
  }
  return (
    <div className="skill-group">
      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
        <input
          key={group.name}
          className="grow"
          aria-label="Skill category"
          placeholder="Category (optional) — e.g. Technical, Leadership"
          defaultValue={group.name}
          onBlur={(e) => e.target.value !== group.name && onName(e.target.value)}
        />
        {removable && (
          <button type="button" className="btn ghost small" onClick={onRemoveGroup} aria-label="Remove category" title="Remove this category">
            ×
          </button>
        )}
      </div>
      {group.items.length > 0 && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {group.items.map((s) => (
            <span key={s} className="chip">
              {s}
              <button className="chip-x" aria-label={`Remove ${s}`} onClick={() => onRemoveItem(s)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="inline-add">
        <input
          type="text"
          aria-label="Add a skill"
          placeholder="Add a skill…"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" className="btn" onClick={add}>
          Add
        </button>
      </div>
    </div>
  )
}

function SummaryPanel({ layout, personSummary, patchLayout }: { layout: CvLayout; personSummary: string | null; patchLayout: (p: Partial<CvLayout>) => void }) {
  return (
    <div className="panel">
      <h2>Summary for this version</h2>
      <TextArea
        label="Summary override"
        value={layout.summary ?? ''}
        rows={3}
        onCommit={(v) => patchLayout({ summary: v || null })}
        placeholder={personSummary || 'Leave blank to use your default summary.'}
      />
      <p className="section-note">Leave blank to use your default summary from “About you”.</p>
    </div>
  )
}

function TailorPanel({ cv, versionId, layout, defaultAppId }: { cv: RenderedCv; versionId: string; layout: CvLayout; defaultAppId?: string }) {
  const store = useStore()
  const [appId, setAppId] = useState(defaultAppId ?? '')
  const [targetExp, setTargetExp] = useState('')
  const apps = store.data.applications.filter((a) => a.stage !== 'closed')
  const app = apps.find((a) => a.id === appId)
  const criteria = app ? store.data.criteria.filter((c) => c.application_id === app.id) : []
  const cvText = [
    cv.name,
    cv.headline,
    cv.summary,
    ...cv.experiences.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...cv.skills,
    ...cv.education.map((e) => `${e.institution} ${e.line ?? ''}`),
  ]
    .filter(Boolean)
    .join(' ')
  const cov = app ? keywordCoverage(cvText, keywordsForApp(app, criteria)) : { covered: 0, total: 0, missing: [] }

  const experiences = [...store.data.cv_experience].sort((a, b) => a.position - b.position)
  const usedEvidence = new Set(
    Object.values(layout.bullets).flat().map((b) => b.evidence_id).filter(Boolean) as string[],
  )
  const covering = criteria
    .filter((c) => c.essential && c.covered_by && !usedEvidence.has(c.covered_by))
    .map((c) => c.covered_by as string)

  function addCovering() {
    const dest = targetExp || experiences.find((e) => !layout.hidden_experience_ids.includes(e.id))?.id
    if (!dest || covering.length === 0) return
    const existing = layout.bullets[dest] ?? []
    const added: CvBullet[] = Array.from(new Set(covering)).map((evId) => ({
      id: crypto.randomUUID(),
      evidence_id: evId,
      text: null,
    }))
    store.updateCvLayout(versionId, { bullets: { ...layout.bullets, [dest]: [...existing, ...added] } })
  }

  return (
    <div className="panel">
      <h2>Tailor to an application</h2>
      <p className="section-note" style={{ marginTop: 0 }}>
        Check this CV against a job&rsquo;s criteria, then pull in the achievements that cover them.
      </p>
      <select value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="Application to tailor to">
        <option value="">— pick an application —</option>
        {apps.map((a) => (
          <option key={a.id} value={a.id}>
            {a.role}
            {a.company ? ` · ${a.company}` : ''}
          </option>
        ))}
      </select>

      {app && (
        <div style={{ marginTop: 12 }}>
          {cov.total > 0 ? (
            <>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span
                  className={`chip ${cov.covered === cov.total ? 'on' : cov.covered === 0 ? 'count-0' : 'count-1'}`}
                >
                  {cov.covered}/{cov.total} keywords covered
                </span>
              </div>
              {cov.missing.length > 0 && (
                <p className="section-note" style={{ marginTop: 0 }}>
                  Missing: {cov.missing.join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="section-note" style={{ marginTop: 0 }}>
              This application has no keywords yet — add some in its Keywords panel to check coverage.
            </p>
          )}

          {covering.length > 0 && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              <select value={targetExp} onChange={(e) => setTargetExp(e.target.value)} aria-label="Add achievements to which role" style={{ width: 'auto', flex: 1 }}>
                <option value="">first role</option>
                {experiences.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title || e.company || 'Untitled role'}
                  </option>
                ))}
              </select>
              <button className="btn small primary" onClick={addCovering}>
                Add {covering.length} covering achievement{covering.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExperiencePanel({ layout, patchLayout }: { layout: CvLayout; patchLayout: (p: Partial<CvLayout>) => void }) {
  const store = useStore()
  const experiences = [...store.data.cv_experience].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Experience</h2>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn small" onClick={() => store.addExperience()}>
          + Add role
        </button>
      </div>
      {experiences.length === 0 ? (
        <p className="muted">Add the roles in your work history — bullets come next.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {experiences.map((e, i) => (
            <ExperienceCard
              key={e.id}
              exp={e}
              layout={layout}
              patchLayout={patchLayout}
              first={i === 0}
              last={i === experiences.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExperienceCard({ exp, layout, patchLayout, first, last }: { exp: CvExperience; layout: CvLayout; patchLayout: (p: Partial<CvLayout>) => void; first: boolean; last: boolean }) {
  const store = useStore()
  const included = !layout.hidden_experience_ids.includes(exp.id)
  const bullets = layout.bullets[exp.id] ?? []
  const evidence = store.data.evidence

  function toggle() {
    const set = new Set(layout.hidden_experience_ids)
    included ? set.add(exp.id) : set.delete(exp.id)
    patchLayout({ hidden_experience_ids: [...set] })
  }
  function setBullets(next: CvBullet[]) {
    patchLayout({ bullets: { ...layout.bullets, [exp.id]: next } })
  }
  function addEvidence(evId: string) {
    setBullets([...bullets, { id: crypto.randomUUID(), evidence_id: evId, text: null }])
  }
  function addManual() {
    setBullets([...bullets, { id: crypto.randomUUID(), evidence_id: null, text: '' }])
  }

  return (
    <div className={`cv-exp ${included ? '' : 'excluded'}`}>
      <div className="cv-exp-head">
        <label className="cv-include" title="Show this role on this CV">
          <input type="checkbox" checked={included} onChange={toggle} />
        </label>
        <input
          className="grow"
          aria-label="Job title"
          placeholder="Job title"
          defaultValue={exp.title}
          onBlur={(e) => e.target.value !== exp.title && store.updateExperience(exp.id, { title: e.target.value })}
        />
        <button className="btn ghost small" onClick={() => store.moveExperience(exp.id, -1)} disabled={first} aria-label="Move up">↑</button>
        <button className="btn ghost small" onClick={() => store.moveExperience(exp.id, 1)} disabled={last} aria-label="Move down">↓</button>
        <button
          className="btn ghost small"
          onClick={() => confirm(`Delete role “${exp.title || exp.company || 'Untitled'}”?`) && store.deleteExperience(exp.id)}
          aria-label="Delete role"
        >
          ×
        </button>
      </div>
      <div className="cv-exp-fields">
        <input aria-label="Company" placeholder="Company" defaultValue={exp.company} onBlur={(e) => e.target.value !== exp.company && store.updateExperience(exp.id, { company: e.target.value })} />
        <input aria-label="Location" placeholder="Location" defaultValue={exp.location ?? ''} onBlur={(e) => e.target.value !== (exp.location ?? '') && store.updateExperience(exp.id, { location: e.target.value || null })} />
        <input aria-label="Start" placeholder="Start (2021-03)" defaultValue={exp.start ?? ''} onBlur={(e) => e.target.value !== (exp.start ?? '') && store.updateExperience(exp.id, { start: e.target.value || null })} />
        <input aria-label="End" placeholder="End (blank = Present)" defaultValue={exp.end ?? ''} onBlur={(e) => e.target.value !== (exp.end ?? '') && store.updateExperience(exp.id, { end: e.target.value || null })} />
      </div>

      <div className="cv-bullets-edit">
        {bullets.map((b, i) => {
          const ev = b.evidence_id ? evidence.find((e) => e.id === b.evidence_id) : undefined
          const evText = ev?.bullet ?? ''
          const update = (patch: Partial<CvBullet>) =>
            setBullets(bullets.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))
          return (
            <BulletRow
              key={b.id}
              bullet={b}
              evidenceTitle={b.evidence_id ? ev?.title ?? '(deleted evidence)' : null}
              evidenceText={evText}
              onText={(t) => {
                if (b.evidence_id) {
                  const v = t.trim()
                  // Store an override only when it differs from the evidence; an
                  // empty or identical value stays live-linked.
                  update({ text: !v || v === evText.trim() ? null : v })
                } else {
                  update({ text: t })
                }
              }}
              onReset={() => update({ text: null })}
              onMakeDefault={() => {
                // Push this CV's reword back into the saved evidence bullet, so it
                // becomes the default everywhere; then drop the per-CV override and
                // go back to live-linked (now showing the updated evidence text).
                const v = b.text?.trim()
                if (b.evidence_id && v) {
                  store.updateEvidence(b.evidence_id, { bullet: v })
                  update({ text: null })
                }
              }}
              onDetach={() => update({ evidence_id: null, text: b.text?.trim() ? b.text : evText })}
              onUp={() => i > 0 && setBullets(swap(bullets, i, i - 1))}
              onDown={() => i < bullets.length - 1 && setBullets(swap(bullets, i, i + 1))}
              onDelete={() => setBullets(bullets.filter((x) => x.id !== b.id))}
              first={i === 0}
              last={i === bullets.length - 1}
            />
          )
        })}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            value=""
            aria-label="Add a bullet from evidence"
            onChange={(e) => {
              if (e.target.value) addEvidence(e.target.value)
              e.target.value = ''
            }}
            style={{ width: 'auto', flex: 1, minWidth: 0, maxWidth: 260 }}
          >
            <option value="">+ Bullet from evidence…</option>
            {evidence.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
          <button className="btn ghost small" onClick={addManual}>
            + Manual bullet
          </button>
        </div>
      </div>
    </div>
  )
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = arr.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function BulletRow({ bullet, evidenceTitle, evidenceText, onText, onReset, onMakeDefault, onDetach, onUp, onDown, onDelete, first, last }: {
  bullet: CvBullet
  evidenceTitle: string | null
  evidenceText: string
  onText: (t: string) => void
  onReset: () => void
  onMakeDefault: () => void
  onDetach: () => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
  first: boolean
  last: boolean
}) {
  const isEvidence = !!bullet.evidence_id
  const overridden = isEvidence && !!(bullet.text && bullet.text.trim())
  // The text shown/edited: an evidence bullet's override, else the evidence's own
  // wording; a manual bullet's text. Editing an evidence bullet only changes this
  // CV — the saved evidence item is never touched.
  const effective = isEvidence ? (overridden ? bullet.text! : evidenceText) : bullet.text ?? ''
  const issues = checkBullet(effective)
  return (
    <div className="cv-bullet-row">
      <div className="cv-bullet-main">
        <textarea
          // Remount when the source flips (reset / detach) so the box reflects it.
          key={`${bullet.id}-${isEvidence}-${overridden}`}
          className="cv-bullet-input"
          rows={2}
          aria-label="Bullet text"
          placeholder="Achievement — lead with a verb, add a number."
          defaultValue={effective}
          onBlur={(e) => e.target.value !== effective && onText(e.target.value)}
        />
        {isEvidence && (
          <div className="cv-bullet-linkbar">
            <span className="cv-bullet-tag" title={`Linked to evidence: ${evidenceTitle}`}>
              ↳ {evidenceTitle}
              {overridden ? ' · reworded for this CV' : ''}
            </span>
            {overridden && (
              <>
                <button className="btn ghost small" onClick={onReset} title="Discard the override; use the saved evidence wording">
                  Reset
                </button>
                <button
                  className="btn ghost small"
                  onClick={onMakeDefault}
                  title="Save this wording back to the evidence — makes it the default on every CV that uses it"
                >
                  Save as default
                </button>
              </>
            )}
            <button className="btn ghost small" onClick={onDetach} title="Unlink from evidence — becomes a standalone bullet">
              Detach
            </button>
          </div>
        )}
        {issues.length > 0 && (
          <div className="cv-bullet-issues">
            {issues.map((iss) => (
              <span key={iss.kind} className={`cv-issue ${iss.kind}`} title={iss.msg}>
                {iss.kind === 'weak' ? 'weak verb' : iss.kind === 'number' ? 'no number' : 'too long'}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="cv-bullet-btns">
        <button className="btn ghost small" onClick={onUp} disabled={first} aria-label="Move up">↑</button>
        <button className="btn ghost small" onClick={onDown} disabled={last} aria-label="Move down">↓</button>
        <button className="btn ghost small" onClick={onDelete} aria-label="Remove bullet">×</button>
      </div>
    </div>
  )
}

function EducationPanel({ layout, patchLayout }: { layout: CvLayout; patchLayout: (p: Partial<CvLayout>) => void }) {
  const store = useStore()
  const education = [...store.data.cv_education].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Education</h2>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn small" onClick={() => store.addEducation()}>
          + Add
        </button>
      </div>
      {education.length === 0 ? (
        <p className="muted">Optional — add qualifications you want to show.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {education.map((e, i) => (
            <EducationCard key={e.id} edu={e} layout={layout} patchLayout={patchLayout} first={i === 0} last={i === education.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function EducationCard({ edu, layout, patchLayout, first, last }: { edu: CvEducation; layout: CvLayout; patchLayout: (p: Partial<CvLayout>) => void; first: boolean; last: boolean }) {
  const store = useStore()
  const included = !layout.hidden_education_ids.includes(edu.id)
  function toggle() {
    const set = new Set(layout.hidden_education_ids)
    included ? set.add(edu.id) : set.delete(edu.id)
    patchLayout({ hidden_education_ids: [...set] })
  }
  return (
    <div className={`cv-exp ${included ? '' : 'excluded'}`}>
      <div className="cv-exp-head">
        <label className="cv-include" title="Show on this CV">
          <input type="checkbox" checked={included} onChange={toggle} />
        </label>
        <input className="grow" aria-label="Institution" placeholder="Institution" defaultValue={edu.institution} onBlur={(e) => e.target.value !== edu.institution && store.updateEducation(edu.id, { institution: e.target.value })} />
        <button className="btn ghost small" onClick={() => store.moveEducation(edu.id, -1)} disabled={first} aria-label="Move up">↑</button>
        <button className="btn ghost small" onClick={() => store.moveEducation(edu.id, 1)} disabled={last} aria-label="Move down">↓</button>
        <button className="btn ghost small" onClick={() => confirm('Delete this education entry?') && store.deleteEducation(edu.id)} aria-label="Delete">×</button>
      </div>
      <div className="cv-exp-fields">
        <input aria-label="Qualification" placeholder="Qualification" defaultValue={edu.qualification ?? ''} onBlur={(e) => e.target.value !== (edu.qualification ?? '') && store.updateEducation(edu.id, { qualification: e.target.value || null })} />
        <input aria-label="Field" placeholder="Field" defaultValue={edu.field ?? ''} onBlur={(e) => e.target.value !== (edu.field ?? '') && store.updateEducation(edu.id, { field: e.target.value || null })} />
        <input aria-label="Start" placeholder="Start" defaultValue={edu.start ?? ''} onBlur={(e) => e.target.value !== (edu.start ?? '') && store.updateEducation(edu.id, { start: e.target.value || null })} />
        <input aria-label="End" placeholder="End" defaultValue={edu.end ?? ''} onBlur={(e) => e.target.value !== (edu.end ?? '') && store.updateEducation(edu.id, { end: e.target.value || null })} />
      </div>
      <textarea
        className="cv-edu-note-input"
        aria-label="Extra info"
        rows={2}
        placeholder="Extra info — dissertation, modules, honours, grade…"
        defaultValue={edu.note ?? ''}
        onBlur={(e) => e.target.value !== (edu.note ?? '') && store.updateEducation(edu.id, { note: e.target.value || null })}
      />
    </div>
  )
}
