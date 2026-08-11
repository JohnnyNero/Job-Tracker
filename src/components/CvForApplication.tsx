import { useStore } from '../store/store'
import type { Application } from '../types'
import { navigate, routes } from '../router'
import { assembleCv } from '../lib/cv'
import { keywordCoverage } from '../lib/cvChecks'
import { CvPreview } from './CvPreview'

// The bridge between an application and its CV: with a role profile set, pull in
// that profile's current CV, show how well it covers this job's criteria, and
// offer to use it or tailor a job-specific copy.
export function CvForApplication({ app }: { app: Application }) {
  const store = useStore()
  const profile = app.profile_id ? store.data.role_profiles.find((p) => p.id === app.profile_id) : null
  const profileCvs = profile ? store.data.cv_versions.filter((c) => c.profile_id === profile.id) : []
  const currentCv = profileCvs.find((c) => c.is_current) ?? null
  const assignedCv = app.cv_version_id ? store.data.cv_versions.find((c) => c.id === app.cv_version_id) ?? null : null
  const cv = assignedCv ?? currentCv // the CV in play for this application

  const criteria = store.data.criteria.filter((c) => c.application_id === app.id)
  const rendered = cv ? assembleCv(store.data, cv.id) : null
  const cvText = rendered
    ? [
        rendered.name,
        rendered.headline,
        rendered.summary,
        ...rendered.experiences.flatMap((e) => [e.title, e.company, ...e.bullets]),
        ...rendered.skills,
      ]
        .filter(Boolean)
        .join(' ')
    : ''
  const cov = rendered ? keywordCoverage(cvText, criteria) : null

  const usedEvidence = new Set(
    cv?.layout ? Object.values(cv.layout.bullets).flat().map((b) => b.evidence_id).filter(Boolean) as string[] : [],
  )
  const toAdd = criteria.filter((c) => c.essential && c.covered_by && !usedEvidence.has(c.covered_by))

  function tailorCopy() {
    if (!cv) return
    const label = `${cv.label} · ${(app.company || app.role || 'job').slice(0, 24)}`
    const copy = store.duplicateCvVersion(cv.id, label)
    store.updateApplication(app.id, { cv_version_id: copy.id })
    navigate(routes.cvBuild(copy.id) + `?app=${app.id}`)
  }

  return (
    <div className="panel">
      <h2>CV for this application</h2>

      {!profile ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Set a <strong>role profile</strong> above and its current CV is pulled in here — ready to
          use or tailor to this job.
        </p>
      ) : profileCvs.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          No CV built for <strong>{profile.name}</strong> yet.{' '}
          <a
            href={routes.cv()}
            onClick={(e) => {
              e.preventDefault()
              navigate(routes.cv())
            }}
          >
            Build one in the CV locker
          </a>{' '}
          and mark it the profile&rsquo;s current CV.
        </p>
      ) : !cv ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          {profile.name} has CVs, but none is marked <strong>current</strong> — set one in the CV
          locker, or pick a version in “CV version sent” above.
        </p>
      ) : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <span className="cvfa-name">{cv.label}</span>
            <span className="chip">{assignedCv ? 'assigned to this job' : `current for ${profile.name}`}</span>
            {cov && cov.total > 0 && (
              <span className={`chip ${cov.covered === cov.total ? 'on' : cov.covered === 0 ? 'count-0' : 'count-1'}`}>
                {cov.covered}/{cov.total} keywords
              </span>
            )}
          </div>

          {cov && cov.total > 0 && cov.missing.length > 0 && (
            <p className="section-note" style={{ marginTop: 0 }}>
              Missing from the CV: {cov.missing.join(', ')}
            </p>
          )}
          {toAdd.length > 0 && (
            <p className="section-note" style={{ marginTop: 0 }}>
              <strong>{toAdd.length}</strong> achievement{toAdd.length === 1 ? '' : 's'} you&rsquo;ve
              already linked to this job&rsquo;s criteria {toAdd.length === 1 ? "isn't" : "aren't"} in
              this CV — tailor a copy to add {toAdd.length === 1 ? 'it' : 'them'}.
            </p>
          )}

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {!assignedCv && currentCv && (
              <button className="btn" onClick={() => store.updateApplication(app.id, { cv_version_id: currentCv.id })}>
                Use this CV for the application
              </button>
            )}
            <a className="btn" href={routes.cvBuild(cv.id) + `?app=${app.id}`}>
              Open in builder
            </a>
            <button className="btn primary" onClick={tailorCopy}>
              Tailor a copy for this job
            </button>
          </div>

          {rendered && (
            <details className="cvfa-preview">
              <summary>Preview this CV</summary>
              <div className="cv-sheet-wrap" style={{ maxHeight: '60vh', marginTop: 10 }}>
                <CvPreview cv={rendered} template={cv.layout?.template} />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
