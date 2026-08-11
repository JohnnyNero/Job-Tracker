// Split pasted ad text into candidate criteria. The parse will still be wrong
// sometimes — and that's fine, the editable checklist is the point, not the
// parse. But a section-aware, bullets-first pass keeps out most of the noise
// (intro prose, benefits, salary blurb) so the list starts closer to right.

const BULLET_PREFIX = /^\s*(?:[-*•·▪◦‣o–—]|\d+[.)]|\([a-z0-9]+\)|[a-z][.)])\s+/i

// Section headings that introduce things we WANT as criteria.
const WANT_HEADING =
  /\b(requirements?|responsibilities|duties|about you|what you.ll (do|bring|need)|who you are|the role|key (skills|tasks|responsibilities)|essential|desirable|qualifications?|experience|skills?|we.?re looking for|you.?ll need|the (ideal )?candidate|person specification|criteria)\b/i

// Section headings that introduce things we do NOT want (benefits / company blurb).
const SKIP_HEADING =
  /\b(benefits?|what we offer|we offer|package|perks|rewards?|why (work|join)|about (us|the (company|role|team|organisation))|our (company|culture|team|values)|the (offer|package)|how to apply|hours|salary)\b/i

// Boilerplate / benefits noise to drop even when it appears as a bullet.
const NOISE =
  /\b(pension|holiday|annual leave|bonus scheme|staff discount|free parking|cycle to work|health ?care|health cash|life assurance|equal opportunit|we are committed to|apply (now|today|below|online)|click (to )?apply|to apply|competitive salary|per annum|per hour|paid (weekly|monthly))\b|£\s?\d/i

/** Is this line a section heading (and if so which kind)? A heading is a short
 * line that either ends in a colon or is a few words of a known heading term. */
function headingKind(s: string): 'want' | 'skip' | null {
  const short = s.split(/\s+/).length <= 6
  const looksHeading = /:$/.test(s) || short
  if (!looksHeading) return null
  // Check skip first so "What we offer:" isn't caught by the bare "offer" want.
  if (SKIP_HEADING.test(s)) return 'skip'
  if (WANT_HEADING.test(s)) return 'want'
  return /:$/.test(s) && short ? 'want' : null // a bare "X:" heading opens a want-ish list
}

export function splitCriteria(text: string | null): string[] {
  if (!text) return []
  const out: string[] = []
  const seen = new Set<string>()
  // Start neutral: a plain bullet list with no headings (common) is still taken.
  let mode: 'want' | 'skip' | 'neutral' = 'neutral'

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const heading = headingKind(line)
    if (heading) {
      mode = heading
      continue
    }

    const hadBullet = BULLET_PREFIX.test(line)
    // One physical line can hold several bullets joined by " • " / " · ".
    for (const piece of line.split(/\s*[•·]\s+|;\s+/)) {
      let s = piece.trim().replace(BULLET_PREFIX, '').trim()
      s = s.replace(/[;,]+\s*$/, '').trim()
      if (s.length < 4) continue // headers/noise
      if (NOISE.test(s)) continue
      // Skip obvious "Word Word:" section labels that slipped through.
      if (/^[A-Z][a-z]+(\s[A-Za-z&]+){0,2}:$/.test(s)) continue

      // Keep bullets everywhere except an explicit benefits/blurb section; keep
      // non-bullet lines only inside a "want" section and only when they read
      // like a requirement (a clause, not a paragraph of prose).
      const listy = s.split(/\s+/).length <= 16
      const keep = mode === 'skip' ? false : hadBullet ? true : mode === 'want' && listy
      if (!keep) continue

      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
      if (out.length >= 25) return out // a checklist, not the whole ad
    }
  }
  return out
}
