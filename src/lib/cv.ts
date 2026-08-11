import type { Dataset, CvLayout } from '../types'

// Assemble a CV version into a rendered document (resolving live-linked evidence
// bullets), and project it to Markdown / JSON Resume for export. Pure functions
// over the Dataset — the builder UI and the print view share this output.

export interface RenderedExperience {
  id: string
  company: string
  title: string
  location: string | null
  dates: string
  bullets: string[]
}
export interface RenderedEducation {
  id: string
  institution: string
  line: string | null
  dates: string
}
export interface RenderedCv {
  name: string
  headline: string | null
  contacts: string[]
  summary: string | null
  experiences: RenderedExperience[]
  skills: string[]
  education: RenderedEducation[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2021-03" → "Mar 2021"; anything else passes through; empty → ''. */
function fmtMonth(s: string | null): string {
  if (!s) return ''
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const mi = Number(m[2]) - 1
    return mi >= 0 && mi < 12 ? `${MONTHS[mi]} ${m[1]}` : m[1]
  }
  return s
}

function dateRange(start: string | null, end: string | null): string {
  const s = fmtMonth(start)
  const e = end && end.trim() ? fmtMonth(end) : 'Present'
  if (!s && !e) return ''
  if (!s) return e
  return `${s} – ${e}`
}

const DEFAULT_LAYOUT: CvLayout = {
  summary: null,
  hidden_experience_ids: [],
  hidden_education_ids: [],
  bullets: {},
  skills: null,
}

export function assembleCv(data: Dataset, versionId: string): RenderedCv | null {
  const version = data.cv_versions.find((c) => c.id === versionId)
  if (!version) return null
  const layout = version.layout ?? DEFAULT_LAYOUT
  const p = data.person
  const evById = new Map(data.evidence.map((e) => [e.id, e]))

  const contacts = [p.email, p.phone, p.location, ...p.links].filter(
    (x): x is string => !!x && !!x.trim(),
  )

  const hiddenExp = new Set(layout.hidden_experience_ids)
  const experiences: RenderedExperience[] = [...data.cv_experience]
    .filter((e) => !hiddenExp.has(e.id))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((e) => {
      const bullets = (layout.bullets[e.id] ?? [])
        .map((b) => {
          if (b.evidence_id) {
            // A per-CV override wins over the evidence's own bullet, so you can
            // reword it here without touching the saved evidence item.
            if (b.text && b.text.trim()) return b.text.trim()
            const ev = evById.get(b.evidence_id)
            return (ev?.bullet || ev?.title || '').trim()
          }
          return (b.text ?? '').trim()
        })
        .filter(Boolean)
      return {
        id: e.id,
        company: e.company,
        title: e.title,
        location: e.location,
        dates: dateRange(e.start, e.end),
        bullets,
      }
    })

  const hiddenEdu = new Set(layout.hidden_education_ids)
  const education: RenderedEducation[] = [...data.cv_education]
    .filter((e) => !hiddenEdu.has(e.id))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((e) => ({
      id: e.id,
      institution: e.institution,
      line: [e.qualification, e.field].filter(Boolean).join(', ') || null,
      dates: dateRange(e.start, e.end),
    }))

  return {
    name: p.full_name,
    headline: p.headline,
    contacts,
    summary: (layout.summary && layout.summary.trim()) || p.summary,
    experiences,
    skills: layout.skills ?? p.skills,
    education,
  }
}

export function cvToMarkdown(cv: RenderedCv): string {
  const out: string[] = []
  out.push(`# ${cv.name || 'Your Name'}`)
  if (cv.headline) out.push(`**${cv.headline}**`)
  if (cv.contacts.length) out.push(cv.contacts.join(' · '))
  if (cv.summary) out.push('', '## Summary', cv.summary)
  if (cv.experiences.length) {
    out.push('', '## Experience')
    for (const e of cv.experiences) {
      out.push('', `### ${e.title}, ${e.company}${e.location ? ` — ${e.location}` : ''}`)
      if (e.dates) out.push(`*${e.dates}*`)
      for (const b of e.bullets) out.push(`- ${b}`)
    }
  }
  if (cv.skills.length) out.push('', '## Skills', cv.skills.join(' · '))
  if (cv.education.length) {
    out.push('', '## Education')
    for (const e of cv.education) {
      out.push(`- **${e.institution}**${e.line ? ` — ${e.line}` : ''}${e.dates ? ` (${e.dates})` : ''}`)
    }
  }
  return out.join('\n')
}

/** JSON Resume (jsonresume.org/schema) projection — the portable interchange
 * format, so the CV isn't locked into this app. */
export function cvToJsonResume(cv: RenderedCv): unknown {
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: cv.name,
      label: cv.headline ?? undefined,
      summary: cv.summary ?? undefined,
      profiles: [],
      // contacts are free-form here; email/phone left in the string list too
    },
    work: cv.experiences.map((e) => ({
      name: e.company,
      position: e.title,
      location: e.location ?? undefined,
      highlights: e.bullets,
    })),
    education: cv.education.map((e) => ({
      institution: e.institution,
      studyType: e.line ?? undefined,
    })),
    skills: cv.skills.map((s) => ({ name: s })),
  }
}
