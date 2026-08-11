import { useState } from 'react'
import { useStore } from '../store/store'
import type { CvBullet, CvExperience, CvEducation, CvLayout, CvVersion } from '../types'
import { routes } from '../router'
import { TextField, TextArea, SelectField } from './fields'
import { CvPreview } from './CvPreview'
import { assembleCv, cvToMarkdown, cvToJsonResume } from '../lib/cv'
import type { RenderedCv } from '../lib/cv'
import { checkBullet, keywordCoverage } from '../lib/cvChecks'

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
// history, and evidence-bank bullets, then export an ATS-clean PDF/Markdown/
// JSON Resume. Left pane edits, right pane is the live document.
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
          <div className="cv-sheet-wrap">
            <CvPreview cv={cv} printable />
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
  const profiles = store.data.role_profiles

  function toggleCurrent(next: boolean) {
    // At most one current CV per profile.
    if (next && version.profile_id) {
      store.data.cv_versions
        .filter((c) => c.id !== version.id && c.profile_id === version.profile_id && c.is_current)
        .forEach((c) => store.updateCvVersion(c.id, { is_current: false }))
    }
    store.updateCvVersion(version.id, { is_current: next })
  }

  return (
    <div className="panel">
      <h2>This CV</h2>
      <div className="field-grid">
        <TextField label="Label" value={version.label} onCommit={(v) => store.updateCvVersion(version.id, { label: v })} />
        <SelectField
          label="Role profile"
          value={version.profile_id ?? ''}
          onChange={(v) => store.updateCvVersion(version.id, { profile_id: v || null })}
          allowEmpty="—"
          options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
      <label className="row" style={{ gap: 8, cursor: version.profile_id ? 'pointer' : 'default', marginTop: 4 }}>
        <input type="checkbox" checked={version.is_current} disabled={!version.profile_id} onChange={(e) => toggleCurrent(e.target.checked)} style={{ width: 'auto' }} />
        <span>Current CV for this profile{!version.profile_id ? ' (pick a profile first)' : ''}</span>
      </label>
      <p className="section-note">
        Allocate a CV to a role profile and it&rsquo;s pulled in automatically on any application you
        set to that profile.
      </p>
    </div>
  )
}

function AboutYou() {
  const store = useStore()
  const p = store.data.person
  const [skill, setSkill] = useState('')

  function addSkill() {
    const s = skill.trim()
    if (!s || p.skills.includes(s)) return
    store.updatePerson({ skills: [...p.skills, s] })
    setSkill('')
  }

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
      <label className="field">
        <span className="lbl">Skills</span>
        <div className="chips" style={{ marginBottom: 8 }}>
          {p.skills.map((s) => (
            <span key={s} className="chip">
              {s}
              <button
                className="chip-x"
                aria-label={`Remove ${s}`}
                onClick={() => store.updatePerson({ skills: p.skills.filter((x) => x !== s) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="inline-add">
          <input
            type="text"
            aria-label="Add a skill"
            placeholder="Add a skill…"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
          />
          <button className="btn" onClick={addSkill}>
            Add
          </button>
        </div>
      </label>
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
  const cov = keywordCoverage(cvText, criteria)

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
              This application has no essential criteria yet — add them on the application to check
              coverage.
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
        {bullets.map((b, i) => (
          <BulletRow
            key={b.id}
            bullet={b}
            evidenceTitle={b.evidence_id ? evidence.find((e) => e.id === b.evidence_id)?.title ?? '(deleted evidence)' : null}
            evidenceText={b.evidence_id ? evidence.find((e) => e.id === b.evidence_id)?.bullet ?? '' : ''}
            onText={(t) => setBullets(bullets.map((x) => (x.id === b.id ? { ...x, text: t } : x)))}
            onUp={() => i > 0 && setBullets(swap(bullets, i, i - 1))}
            onDown={() => i < bullets.length - 1 && setBullets(swap(bullets, i, i + 1))}
            onDelete={() => setBullets(bullets.filter((x) => x.id !== b.id))}
            first={i === 0}
            last={i === bullets.length - 1}
          />
        ))}
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

function BulletRow({ bullet, evidenceTitle, evidenceText, onText, onUp, onDown, onDelete, first, last }: {
  bullet: CvBullet
  evidenceTitle: string | null
  evidenceText: string
  onText: (t: string) => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
  first: boolean
  last: boolean
}) {
  const text = bullet.evidence_id ? evidenceText : bullet.text ?? ''
  const issues = checkBullet(text)
  return (
    <div className="cv-bullet-row">
      <div className="cv-bullet-main">
        {bullet.evidence_id ? (
          <div className="cv-bullet-linked">
            <span className="cv-bullet-text">{text || <em className="muted">empty evidence bullet</em>}</span>
            <span className="cv-bullet-tag" title={`Linked to evidence: ${evidenceTitle}`}>↳ {evidenceTitle}</span>
          </div>
        ) : (
          <textarea
            className="cv-bullet-input"
            rows={2}
            aria-label="Bullet text"
            placeholder="Achievement — lead with a verb, add a number."
            defaultValue={bullet.text ?? ''}
            onBlur={(e) => e.target.value !== (bullet.text ?? '') && onText(e.target.value)}
          />
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
    </div>
  )
}
