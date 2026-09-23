import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  TabStopType,
} from 'docx'
import type { RenderedCv } from './cv'

// True OOXML (.docx) projection of a rendered CV. Unlike the HTML exports this
// produces a real Word container (PK-zip OOXML), so ATS parsers that dispatch on
// the Word format — the rigid ones like Workday/Taleo — extract clean, ordered
// text instead of choking on an HTML file wearing a .doc name. Section order is
// the same ATS-safe Summary → Experience → Skills → Education, single column,
// standard headings, real bullet lists — no tables, columns or graphics.

/** Title line + a right-tabbed date, so the entry reads cleanly on the page while
 * still parsing in source (left-to-right) order. */
function titleWithDates(title: TextRun[], dates: string): Paragraph {
  return new Paragraph({
    tabStops: dates ? [{ type: TabStopType.RIGHT, position: 9026 }] : undefined,
    children: dates ? [...title, new TextRun({ text: `\t${dates}` })] : title,
  })
}

export async function cvToDocxBlob(cv: RenderedCv): Promise<Blob> {
  const kids: Paragraph[] = []

  kids.push(new Paragraph({ heading: HeadingLevel.TITLE, text: cv.name || 'Your Name' }))
  if (cv.headline) {
    kids.push(new Paragraph({ children: [new TextRun({ text: cv.headline, bold: true })] }))
  }
  if (cv.contacts.length) {
    kids.push(new Paragraph({ children: [new TextRun(cv.contacts.join('  ·  '))] }))
  }

  if (cv.summary) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Summary' }))
    kids.push(new Paragraph(cv.summary))
  }

  if (cv.experiences.length) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Experience' }))
    for (const e of cv.experiences) {
      const title = e.title + (e.company ? `, ${e.company}` : '')
      kids.push(titleWithDates([new TextRun({ text: title, bold: true })], e.dates))
      if (e.location) {
        kids.push(new Paragraph({ children: [new TextRun({ text: e.location, italics: true })] }))
      }
      for (const b of e.bullets) {
        kids.push(new Paragraph({ text: b, bullet: { level: 0 } }))
      }
    }
  }

  if (cv.skillGroups.length) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Skills' }))
    for (const g of cv.skillGroups) {
      kids.push(
        new Paragraph({
          children: g.name
            ? [new TextRun({ text: `${g.name}: `, bold: true }), new TextRun(g.items.join(', '))]
            : [new TextRun(g.items.join(', '))],
        }),
      )
    }
  }

  if (cv.education.length) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Education' }))
    for (const e of cv.education) {
      kids.push(titleWithDates([new TextRun({ text: e.institution, bold: true })], e.dates))
      if (e.line) kids.push(new Paragraph(e.line))
      if (e.note) kids.push(new Paragraph({ children: [new TextRun({ text: e.note, italics: true })] }))
    }
  }

  const doc = new Document({
    // Web-safe body font at an ATS-legible size (see the print stylesheet's ≥10pt
    // floor). Sizes are half-points; 22 = 11pt.
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [
      {
        properties: {},
        children: kids,
      },
    ],
  })

  return Packer.toBlob(doc)
}
