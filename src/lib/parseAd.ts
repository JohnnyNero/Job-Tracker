// Heuristic, offline parser for a pasted job ad. Like the criteria splitter,
// it is deliberately rough — it pre-fills what it can and the user corrects the
// rest. No network, no LLM: just labels, first-line patterns, and a money regex.

export interface ParsedAd {
  role?: string
  company?: string
  location?: string
  salary?: string
}

/** Guess role (and sometimes company) from a captured page <title>. Titles come
 * in a few shapes: "Company hiring Role in Location | LinkedIn", "Role at
 * Company", "Role - Company - Location | Indeed.com". Rough on purpose — the
 * user fixes it in the dialog. */
export function titleToRoleCompany(title: string): { role: string; company: string } {
  let t = title
    // drop a trailing " | Site" / " - Site" suffix for the common boards
    .replace(
      /\s*[|\-–—]\s*(indeed(\.com)?|linkedin|glassdoor|reed(\.co\.uk)?|totaljobs|monster|ziprecruiter|welcome to the jungle|otta)\b.*$/i,
      '',
    )
    .trim()
  let m = t.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i) // LinkedIn
  if (m) return { role: m[2].trim(), company: m[1].trim() }
  m = t.match(/^(.+?)\s+at\s+(.+)$/i)
  if (m) return { role: m[1].trim(), company: m[2].trim() }
  const parts = t.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) return { role: parts[0].trim(), company: parts[1].trim() }
  return { role: t, company: '' }
}

/** Infer a source label from a captured URL's host (Indeed / LinkedIn / …). */
export function sourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    const map: [RegExp, string][] = [
      [/indeed\./, 'Indeed'],
      [/linkedin\./, 'LinkedIn'],
      [/glassdoor\./, 'Glassdoor'],
      [/reed\.co/, 'Reed'],
      [/totaljobs\./, 'Totaljobs'],
      [/monster\./, 'Monster'],
      [/ziprecruiter\./, 'ZipRecruiter'],
    ]
    for (const [re, label] of map) if (re.test(host)) return label
    return host
  } catch {
    return ''
  }
}

function firstLabel(lines: string[], re: RegExp): string | undefined {
  for (const l of lines) {
    const m = l.match(re)
    if (m && m[1] && m[1].trim()) return m[1].trim()
  }
  return undefined
}

function findSalary(text: string): string | undefined {
  // A currency amount or range: £32,000–£36,000 · $90k-$110k/yr · €50.000 p.a.
  const cur =
    /(?:£|\$|€|USD|GBP|EUR)\s?\d[\d,]*(?:\.\d+)?\s?k?(?:\s?(?:-|–|—|to)\s?(?:£|\$|€)?\s?\d[\d,]*(?:\.\d+)?\s?k?)?(?:\s?(?:per annum|p\.?a\.?|\/\s?year|\/\s?yr|per year|per hour|\/\s?hour|\/\s?hr|ph|pa))?/i
  const m = text.match(cur)
  if (m) return m[0].replace(/\s+/g, ' ').trim()
  // Bare "50k - 60k" without a currency symbol.
  const k = text.match(/\b\d{2,3}\s?k\s?(?:-|–|—|to)\s?\d{2,3}\s?k\b/i)
  if (k) return k[0].replace(/\s+/g, ' ').trim()
  if (/\bcompetitive\b/i.test(text)) return 'Competitive'
  if (/\b(doe|depending on experience)\b/i.test(text)) return 'DOE'
  return undefined
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function parseAd(text: string): ParsedAd {
  if (!text || !text.trim()) return {}
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const nonEmpty = lines.filter(Boolean)
  const out: ParsedAd = {}

  // 1) Explicit labels win.
  out.role = firstLabel(nonEmpty, /^(?:job\s*title|title|role|position|vacancy)\s*[:\-–—]\s*(.+)$/i)
  out.company = firstLabel(
    nonEmpty,
    /^(?:company|employer|organisation|organization|business)\s*[:\-–—]\s*(.+)$/i,
  )
  out.location = firstLabel(nonEmpty, /^(?:location|based(?:\s+in)?|where|site)\s*[:\-–—]\s*(.+)$/i)
  const salaryLabeled = firstLabel(
    nonEmpty,
    /^(?:salary|pay|compensation|package|rate)\s*[:\-–—]\s*(.+)$/i,
  )

  // 2) First line often reads "Title — Company" / "Title at Company" / "Title | Company".
  if ((!out.role || !out.company) && nonEmpty.length) {
    const first = nonEmpty[0]
    const sep = first.match(/^(.{2,80}?)\s+(?:—|–|-|\||·|@|\bat\b)\s+(.{2,80})$/i)
    if (sep) {
      if (!out.role) out.role = sep[1].trim()
      if (!out.company) out.company = sep[2].trim()
    } else if (!out.role && first.length <= 80) {
      out.role = first
    }
  }

  // 3) Salary: labelled value, else scan the whole ad.
  out.salary = salaryLabeled ?? findSalary(text)

  // 4) Location fallback: remote/hybrid/on-site keywords.
  if (!out.location) {
    const m = text.match(/\b(fully remote|remote(?:-first)?|hybrid|on-?site)\b/i)
    if (m) out.location = cap(m[1].toLowerCase())
  }

  // Sanity: drop absurdly long captures (probably a sentence, not a field).
  if (out.role && out.role.length > 90) delete out.role
  if (out.company && out.company.length > 90) delete out.company
  if (out.location && out.location.length > 60) delete out.location

  return out
}
