// Zero-model, fully-private writing checks for CV bullets. Flags weak phrasing,
// missing numbers, and over-long lines with no download and nothing leaving the
// device. (Keyword extraction and CV coverage live in src/lib/keywords.ts.)

export interface BulletIssue {
  kind: 'weak' | 'number' | 'length'
  msg: string
}

const WEAK_START =
  /^\s*(responsible for|worked on|helped( to)?|assisted( with)?|duties included|involved in|tasked with|in charge of)\b/i

/** Lint a single CV bullet. Returns [] when it's clean. */
export function checkBullet(text: string): BulletIssue[] {
  const t = text.trim()
  if (!t) return []
  const issues: BulletIssue[] = []
  if (WEAK_START.test(t)) {
    issues.push({ kind: 'weak', msg: 'Starts weak — lead with a strong action verb (Rebuilt, Cut, Led…).' })
  }
  if (!/\d/.test(t)) {
    issues.push({ kind: 'number', msg: 'No number — add a metric (%, £, time saved) to make the impact land.' })
  }
  const words = t.split(/\s+/).length
  if (words > 30 || t.length > 240) {
    issues.push({ kind: 'length', msg: 'Long — tighten to one line so it scans fast.' })
  }
  return issues
}
