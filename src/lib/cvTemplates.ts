// The visual templates for the CV builder. Every one is single-column, real
// text, standard headings, system fonts only — so they look distinct but all
// stay ATS-safe and print cleanly with no external assets. The id maps to a
// `.tpl-<id>` class in app.css; the look is CSS-only over the same DOM.
export interface CvTemplate {
  id: string
  name: string
  blurb: string
}

export const CV_TEMPLATES: CvTemplate[] = [
  { id: 'classic', name: 'Classic', blurb: 'Georgia serif, ruled headings — the university standard.' },
  { id: 'modern', name: 'Modern', blurb: 'Helvetica, no rules, hierarchy by weight.' },
  { id: 'elegant', name: 'Elegant', blurb: 'Garamond, small-caps, a whisper of burgundy.' },
  { id: 'executive', name: 'Executive', blurb: 'Cambria with a navy accent — authoritative.' },
  { id: 'compact', name: 'Compact', blurb: 'Calibri, tight — fits more on one page.' },
  { id: 'accent', name: 'Accent', blurb: 'Sans with one restrained teal accent.' },
]

export const DEFAULT_TEMPLATE = 'classic'
