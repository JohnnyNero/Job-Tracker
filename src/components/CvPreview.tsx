import type { RenderedCv } from '../lib/cv'

// The rendered CV as ATS-safe semantic HTML: single column, real text, standard
// headings, no tables/graphics. `printable` adds the .cv-print hook so this is
// the element the print stylesheet targets — only the builder's preview sets it,
// so an inline preview elsewhere never hijacks printing.
export function CvPreview({ cv, printable = false, template }: { cv: RenderedCv; printable?: boolean; template?: string }) {
  return (
    <div className={`cv-sheet tpl-${template || 'classic'} ${printable ? 'cv-print' : ''}`}>
      <header className="cv-head">
        <h1>{cv.name || 'Your Name'}</h1>
        {cv.headline && <p className="cv-headline">{cv.headline}</p>}
        {cv.contacts.length > 0 && <p className="cv-contacts">{cv.contacts.join('  ·  ')}</p>}
      </header>

      {cv.summary && (
        <section className="cv-section">
          <h2>Summary</h2>
          <p className="cv-summary">{cv.summary}</p>
        </section>
      )}

      {cv.experiences.length > 0 && (
        <section className="cv-section">
          <h2>Experience</h2>
          {cv.experiences.map((e) => (
            <div className="cv-entry" key={e.id}>
              <div className="cv-entry-head">
                <span className="cv-entry-title">
                  {e.title}
                  {e.company ? `, ${e.company}` : ''}
                </span>
                {e.dates && <span className="cv-entry-dates">{e.dates}</span>}
              </div>
              {e.location && <div className="cv-entry-sub">{e.location}</div>}
              {e.bullets.length > 0 && (
                <ul className="cv-bullets">
                  {e.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {cv.skills.length > 0 && (
        <section className="cv-section">
          <h2>Skills</h2>
          <p className="cv-skills">{cv.skills.join('  ·  ')}</p>
        </section>
      )}

      {cv.education.length > 0 && (
        <section className="cv-section">
          <h2>Education</h2>
          {cv.education.map((e) => (
            <div className="cv-entry" key={e.id}>
              <div className="cv-entry-head">
                <span className="cv-entry-title">{e.institution}</span>
                {e.dates && <span className="cv-entry-dates">{e.dates}</span>}
              </div>
              {e.line && <div className="cv-entry-sub">{e.line}</div>}
              {e.note && <div className="cv-edu-note">{e.note}</div>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
