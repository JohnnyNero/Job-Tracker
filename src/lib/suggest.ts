import type { Evidence } from '../types'

// Offline suggestion of which evidence answers a criterion. No network, no
// model — just token overlap between the criterion text and each evidence
// item, with a bonus when the criterion literally names a capability the
// evidence is tagged with. Rough on purpose; the user confirms the link.

const STOP = new Set([
  'the', 'and', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'is',
  'are', 'be', 'or', 'you', 'your', 'our', 'we', 'they', 'this', 'that', 'these', 'those', 'across',
  'strong', 'proven', 'experience', 'ability', 'able', 'good', 'excellent', 'must', 'should', 'will',
  'have', 'has', 'both', 'their', 'them', 'into', 'over', 'per', 'within', 'up', 'out', 'who', 'what',
])

function tokens(s: string): Set<string> {
  const out = new Set<string>()
  for (const raw of s.toLowerCase().split(/[^a-z0-9%]+/)) {
    const w = raw.trim()
    if (w.length >= 3 && !STOP.has(w)) out.add(w)
  }
  return out
}

export interface Suggestion {
  evidence: Evidence
  score: number
}

/** Rank evidence by how well it answers `criterionText`. Returns matches above
 * a small threshold, best first, capped at `limit`. */
export function suggestEvidence(
  criterionText: string,
  evidence: Evidence[],
  limit = 2,
): Suggestion[] {
  const critTokens = tokens(criterionText)
  const critLower = criterionText.toLowerCase()
  if (critTokens.size === 0) return []

  const scored: Suggestion[] = []
  for (const ev of evidence) {
    const hay = tokens(`${ev.title} ${ev.bullet ?? ''} ${ev.full_text ?? ''}`)
    let overlap = 0
    for (const t of critTokens) if (hay.has(t)) overlap++
    // Bonus when the criterion literally mentions one of the item's capabilities.
    let capBonus = 0
    for (const c of ev.capabilities) {
      if (critLower.includes(c.toLowerCase())) capBonus += 3
    }
    const score = overlap + capBonus
    if (score >= 2) scored.push({ evidence: ev, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
