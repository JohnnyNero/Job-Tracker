// Zero-model, fully-private writing checks for CV bullets and coverage. These
// give much of the "help me craft it" value with no download and nothing leaving
// the device — flagging weak phrasing, missing numbers, and job keywords the CV
// doesn't mention yet.

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

const STOP = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'has', 'this', 'that',
  'from', 'they', 'their', 'them', 'able', 'work', 'working', 'role', 'team', 'teams', 'across',
  'within', 'into', 'other', 'strong', 'good', 'must', 'should', 'would', 'including', 'include',
  'experience', 'experienced', 'ability', 'skills', 'knowledge', 'well', 'all', 'any', 'who', 'what',
  'when', 'where', 'which', 'about', 'over', 'under', 'been', 'being', 'both', 'each', 'more', 'most',
])

function terms(text: string): string[] {
  return Array.from(
    new Set(
      (text.toLowerCase().match(/[a-z][a-z+#.]{3,}/g) ?? []).filter((w) => !STOP.has(w)),
    ),
  )
}

export interface KeywordCoverage {
  covered: number
  total: number
  /** Keywords from the essential criteria not found in the CV text. */
  missing: string[]
}

/** How many keywords from the (essential) job criteria appear in the assembled
 * CV text — the poor-man's ATS match, computed entirely locally. */
export function keywordCoverage(
  cvText: string,
  criteria: { text: string; essential: boolean }[],
): KeywordCoverage {
  const wanted = Array.from(new Set(criteria.filter((c) => c.essential).flatMap((c) => terms(c.text))))
  if (wanted.length === 0) return { covered: 0, total: 0, missing: [] }
  const hay = cvText.toLowerCase()
  const missing = wanted.filter((w) => !hay.includes(w))
  return { covered: wanted.length - missing.length, total: wanted.length, missing: missing.slice(0, 14) }
}
