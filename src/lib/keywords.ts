// Keyword extraction + coverage — fully local, no model, nothing leaves the
// device. Turns a job ad (and its criteria) into a short list of the terms an
// ATS and a hiring skim look for, so the CV can be checked against them. The
// guess only needs to be a decent *starting point*: the list is user-editable
// (Application.keywords), and that curated list — not this heuristic — is what
// coverage runs on once it exists.

// Words too common to be useful as keywords. Superset of the old cvChecks list.
const STOP = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'has', 'this', 'that',
  'from', 'they', 'their', 'them', 'able', 'work', 'working', 'role', 'team', 'teams', 'across',
  'within', 'into', 'other', 'strong', 'good', 'must', 'should', 'would', 'including', 'include',
  'experience', 'experienced', 'ability', 'skills', 'skill', 'knowledge', 'well', 'all', 'any',
  'who', 'what', 'when', 'where', 'which', 'about', 'over', 'under', 'been', 'being', 'both', 'each',
  'more', 'most', 'looking', 'candidate', 'candidates', 'ideal', 'essential', 'desirable', 'seeking',
  'join', 'busy', 'help', 'ensure', 'ensuring', 'support', 'provide', 'providing', 'deliver',
  'manage', 'managing', 'run', 'running', 'looking', 'require', 'required', 'requirements', 'plus',
  'excellent', 'proven', 'demonstrable', 'ideally', 'etc', 'day', 'days', 'week', 'year', 'years',
  // Common ad verbs/adjectives that read as filler, not keywords.
  'build', 'building', 'handle', 'handling', 'maintain', 'maintaining', 'resolve', 'resolving',
  'comfortable', 'calm', 'calmly', 'lead', 'leading', 'drive', 'driving', 'create', 'creating',
  'own', 'owning', 'confident', 'flexible', 'reliable', 'passionate', 'motivated', 'hands',
])

// Multi-word phrases worth keeping whole — checked before single words so, e.g.
// "health and safety" beats loose "health"/"safety". General enough to help
// across sectors, weighted toward ops/service/management language.
const KNOWN_PHRASES = [
  'health and safety', 'health & safety', 'cost control', 'profit and loss', 'p&l', 'p & l',
  'customer service', 'project management', 'stock control', 'line management', 'people management',
  'team leadership', 'continuous improvement', 'business development', 'account management',
  'stakeholder management', 'time management', 'problem solving', 'attention to detail',
  'quality assurance', 'food safety', 'due diligence', 'data analysis', 'social media',
  'supply chain', 'change management', 'risk management', 'front of house', 'back of house',
  'cash handling', 'staff training', 'performance management', 'labour costs',
  'budget management', 'health and safety compliance', 'customer experience', 'kpi', 'kpis',
  'staff rotas', 'duty management', 'duty manager', 'operations management', 'shift management',
  'staff development', 'staff management', 'food hygiene', 'loss prevention', 'stakeholder engagement',
]

/** Canonical display form for a known phrase (title-ish, keeps ampersands). */
function canonPhrase(p: string): string {
  if (p === 'p&l' || p === 'p & l') return 'P&L'
  if (p === 'kpi' || p === 'kpis') return 'KPIs'
  if (p === 'health & safety') return 'health & safety'
  return p
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = hay.indexOf(needle)
  while (i !== -1) {
    n++
    i = hay.indexOf(needle, i + needle.length)
  }
  return n
}

function tokenize(text: string): string[] {
  return text.match(/[a-z][a-z&+#.]{2,}/g) ?? []
}

const isStop = (w: string) => STOP.has(w.replace(/[.]+$/, ''))

/**
 * Derive a short keyword list from an ad (and, optionally, its criteria text —
 * counted with extra weight, since criteria are the distilled requirements).
 * Returns known phrases first, then the strongest recurring bigrams/unigrams,
 * de-duplicated so a word already inside a kept phrase isn't repeated. Capped so
 * the result is a checklist, not a word cloud.
 */
export function extractKeywords(
  adText: string | null | undefined,
  criteriaText?: string | null,
): string[] {
  const ad = (adText ?? '').toLowerCase()
  const crit = (criteriaText ?? '').toLowerCase()
  if (!ad && !crit) return []
  const full = `${ad}\n${crit}`

  const score = new Map<string, number>() // display keyword -> score
  const bump = (k: string, s: number) => score.set(k, (score.get(k) ?? 0) + s)

  // 1) Known multi-word phrases (high-precision, kept whole); a light boost when
  // they surface in the distilled criteria rather than only the ad prose.
  for (const p of KNOWN_PHRASES) {
    const n = countOccurrences(full, p)
    if (n > 0) bump(canonPhrase(p), n * 3 + 2 + (crit.includes(p) ? 3 : 0))
  }

  // 2) Frequency over the text, but only WITHIN a line/clause — so bigrams can't
  // straddle a line break ("costs build") or a sentence boundary. Counted once
  // (no doubling), with a small boost for terms the criteria also mention, so
  // the requirements steer the ranking without every criteria pair becoming a
  // "keyword".
  const uni = new Map<string, number>()
  const bi = new Map<string, number>()
  for (const seg of full.split(/[\n.;:,()/|]+/)) {
    const toks = tokenize(seg)
    for (let i = 0; i < toks.length; i++) {
      const a = toks[i]
      if (!isStop(a) && a.length >= 4) uni.set(a, (uni.get(a) ?? 0) + 1)
      if (i + 1 < toks.length) {
        const b = toks[i + 1]
        if (!isStop(a) && !isStop(b) && a.length >= 3 && b.length >= 3) {
          const g = `${a} ${b}`
          bi.set(g, (bi.get(g) ?? 0) + 1)
        }
      }
    }
  }
  // The criteria mirror the ad's bullets, so any single bullet's word-pair
  // already appears twice — require n >= 3 for a bigram (a theme spanning more
  // than one line, or one also echoed in prose) so verb+object noise like
  // "handle escalations" doesn't survive. Real skill phrases come from
  // KNOWN_PHRASES; this just catches recurring domain pairs those miss.
  for (const [g, n] of bi) if (n >= 3) bump(g, n * 2 + (crit.includes(g) ? 2 : 0))
  // Single words: keep the frequently-repeated ones, plus substantive words the
  // criteria call out by name (even once) — a criterion's own nouns are exactly
  // the terms a screen scans for. The length guard keeps out weak short words.
  for (const [w, n] of uni) {
    const inCrit = w.length >= 5 && crit.includes(w)
    if (n >= 3 || inCrit) bump(w, n + (inCrit ? 2 : 0))
  }

  // Rank by score, then alphabetically for a stable order.
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  // Collapse overlaps so only the most specific phrase survives: skip a
  // candidate already inside a kept keyword, and evict any kept keyword that the
  // candidate contains (so "cost control" beats bare "cost", and "labour costs"
  // replaces "labour cost").
  const kept: string[] = []
  for (const [kw] of ranked) {
    const low = kw.toLowerCase()
    if (kept.some((k) => k.toLowerCase() !== low && k.toLowerCase().includes(low))) continue
    for (let i = kept.length - 1; i >= 0; i--) {
      const kl = kept[i].toLowerCase()
      if (kl !== low && low.includes(kl)) kept.splice(i, 1)
    }
    kept.push(kw)
    if (kept.length >= 12) break
  }
  return kept
}

/** The keyword list in play for an application: the curated list if the user has
 * one, otherwise a fresh derivation from the ad + essential criteria so coverage
 * still works before anyone edits anything. */
export function keywordsForApp(
  app: { keywords: string[]; ad_text: string | null },
  criteria: { text: string; essential: boolean }[],
): string[] {
  if (app.keywords && app.keywords.length) return app.keywords
  const critText = criteria
    .filter((c) => c.essential)
    .map((c) => c.text)
    .join('\n')
  return extractKeywords(app.ad_text, critText)
}

export interface KeywordCoverage {
  covered: number
  total: number
  /** Keywords not found anywhere in the CV text. */
  missing: string[]
}

/** How many of the (curated) job keywords appear in the assembled CV text — the
 * poor-man's ATS match, computed entirely locally. Matching is case-insensitive
 * and substring-based, so "cost control" is covered by "…tight cost control…". */
export function keywordCoverage(cvText: string, keywords: string[]): KeywordCoverage {
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const k of keywords) {
    const t = k.trim()
    const key = t.toLowerCase()
    if (!t || seen.has(key)) continue
    seen.add(key)
    uniq.push(t)
  }
  if (uniq.length === 0) return { covered: 0, total: 0, missing: [] }
  const hay = cvText.toLowerCase()
  const missing = uniq.filter((k) => !hay.includes(k.toLowerCase()))
  return { covered: uniq.length - missing.length, total: uniq.length, missing: missing.slice(0, 14) }
}
