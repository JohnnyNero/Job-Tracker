import { useLayoutEffect, useRef, useState } from 'react'
import { CvPreview } from './CvPreview'
import type { RenderedCv } from '../lib/cv'

// A faithful A4 print-preview of the CV. The document is rendered at true A4
// (210×297mm) with the same 16mm margins the PDF uses, so a short CV visibly
// sits on a full page with the empty space at the bottom — the thing the plain
// preview couldn't show. The page is scaled down to fit the pane width (never up)
// so it never scrolls sideways, and a caption reports how full the page is.
//
// Screen-only: the print path is untouched (real A4 comes from @page), and the
// print stylesheet neutralises the scaling wrappers (see app.css).

const MM = 96 / 25.4 // CSS px per mm at 96dpi
const A4_W = 210 * MM // ≈ 793.7px
const A4_H = 297 * MM // ≈ 1122.5px
const MARGIN = 16 * MM // matches the @page print margin

export function CvPagePreview({ cv, template }: { cv: RenderedCv; template?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  // Unscaled geometry (offset* values are layout px, unaffected by the transform).
  const [boxH, setBoxH] = useState(A4_H) // the sheet's own height (≥ one A4 page)
  const [usedH, setUsedH] = useState(0) // height of actual content, margins included

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const scaleEl = scaleRef.current
    if (!wrap || !scaleEl) return
    const sheet = scaleEl.querySelector('.cv-sheet') as HTMLElement | null
    if (!sheet) return

    const measure = () => {
      // clientWidth includes the wrap's padding — the page sits inside it, so
      // subtract it or the scaled page spills past the content box.
      const cs = getComputedStyle(wrap)
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
      const avail = Math.max(0, wrap.clientWidth - pad)
      setScale(Math.min(1, avail / A4_W))
      setBoxH(sheet.offsetHeight)
      const kids = sheet.children
      const last = kids.length ? (kids[kids.length - 1] as HTMLElement) : null
      // last child's bottom (from the sheet's top, so top margin is included)
      // plus the sheet's bottom margin = total ink height on the page(s).
      setUsedH(last ? last.offsetTop + last.offsetHeight + MARGIN : sheet.offsetHeight)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    ro.observe(sheet)
    return () => ro.disconnect()
  }, [cv, template])

  const pages = Math.max(1, Math.ceil(usedH / A4_H - 0.01))
  const lastFill = Math.min(100, Math.round(((usedH - (pages - 1) * A4_H) / A4_H) * 100))
  const caption =
    pages === 1
      ? `A4 · about ${lastFill}% of the page used${lastFill < 80 ? ' — room to add more' : ''}`
      : `A4 · ${pages} pages · last page about ${lastFill}% full`

  return (
    <>
      <div className="cv-sheet-wrap" ref={wrapRef}>
        <div className="cv-page-frame" style={{ width: A4_W * scale, height: boxH * scale }}>
          <div
            className="cv-page-scale"
            ref={scaleRef}
            style={{ width: A4_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            <CvPreview cv={cv} printable template={template} />
          </div>
        </div>
      </div>
      <p className="cv-fill-note" aria-live="polite">
        {caption}
      </p>
    </>
  )
}
