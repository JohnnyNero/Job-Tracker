// Offline CV → evidence-bank seeding. Splits a pasted CV/résumé into candidate
// achievement lines, so a new user's evidence bank isn't a cold empty screen.
// Deliberately rough: it proposes candidates for the user to accept/edit, never
// auto-commits. No parsing cleverness, no network, no AI — just heuristics over
// bullet-shaped lines.

export interface CvCandidate {
  /** A short title derived from the line (the user can rename). */
  title: string
  /** The full line, kept as the CV-length bullet. */
  bullet: string
}

const BULLET_CHARS = /^[\s]*[•‣◦▪·\-–—*]+\s*/
// Lines that are almost certainly headers / contact info, not achievements.
const SECTION_WORDS =
  /^(experience|work experience|employment|education|skills|profile|summary|objective|references|contact|certifications?|interests|hobbies|projects|achievements|awards|languages)\b/i
const CONTACT = /(@|https?:\/\/|www\.|\+?\d[\d\s().-]{7,}\d)/i

function looksLikeHeaderOrContact(line: string): boolean {
  if (SECTION_WORDS.test(line)) return true
  if (CONTACT.test(line)) return true
  // ALL-CAPS short lines are usually headers ("PROFESSIONAL EXPERIENCE").
  const letters = line.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && letters === letters.toUpperCase() && line.length < 40) return true
  return false
}

/** Trim a line into a short title: up to the first sentence break, capped by
 * word count and length. */
function toTitle(line: string): string {
  // stop at the first strong break so the title is the gist, not the metric
  const firstClause = line.split(/[.;:—–]|,\s(?=which|and|by)/)[0].trim()
  const words = firstClause.split(/\s+/)
  let title = words.slice(0, 8).join(' ')
  if (title.length > 60) title = title.slice(0, 57).trimEnd() + '…'
  else if (words.length > 8) title = title + '…'
  // Capitalise the first letter, leave the rest alone.
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/**
 * Split pasted CV text into candidate evidence items. Prefers bullet-marked
 * lines; if the paste has no bullet markers at all, falls back to substantial
 * standalone lines. Drops headers, contact info, and trivially short lines, and
 * de-duplicates.
 */
export function splitCvIntoEvidence(text: string): CvCandidate[] {
  if (!text.trim()) return []
  const rawLines = text
    .replace(/\r/g, '')
    // some CVs put several bullets on one line separated by • — break those up
    .split(/\n|(?=\s[•‣▪])/)
    .map((l) => l.trim())
    .filter(Boolean)

  const bulletLines = rawLines.filter((l) => BULLET_CHARS.test(l))
  const source = bulletLines.length >= 3 ? bulletLines : rawLines

  const seen = new Set<string>()
  const out: CvCandidate[] = []
  for (const raw of source) {
    const line = raw.replace(BULLET_CHARS, '').trim()
    if (line.length < 20) continue // too short to be an achievement
    if (looksLikeHeaderOrContact(line)) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ title: toTitle(line), bullet: line })
    if (out.length >= 40) break // sanity cap
  }
  return out
}
