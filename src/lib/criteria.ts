// Split pasted ad text into candidate criteria. This WILL be wrong often — that
// is expected and fine. The value is the editable checklist, not the parse
// quality, so the rule is deliberately simple and forgiving.

const BULLET_PREFIX = /^\s*(?:[-*•·▪◦‣o–—]|\d+[.)]|\([a-z0-9]+\)|[a-z][.)])\s+/i

export function splitCriteria(text: string | null): string[] {
  if (!text) return []
  const out: string[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split(/\r?\n/)) {
    // A single line can hold several bullets separated by " • " or " - ".
    const pieces = rawLine.split(/\s+[•·]\s+/)
    for (const piece of pieces) {
      let s = piece.trim()
      // strip a leading bullet / numbering marker
      s = s.replace(BULLET_PREFIX, '').trim()
      // drop trailing list punctuation
      s = s.replace(/[;,]\s*$/, '').trim()
      if (s.length < 3) continue // headers/noise
      // skip lines that are obviously section labels ("Requirements:")
      if (/^[A-Z][a-z]+(\s[A-Za-z]+){0,2}:$/.test(s)) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
  }
  return out
}
