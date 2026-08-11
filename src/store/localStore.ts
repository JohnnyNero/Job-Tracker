import type {
  Application,
  ApplicationEvidence,
  Capability,
  Criterion,
  CvBullet,
  CvEducation,
  CvExperience,
  CvLayout,
  CvVersion,
  Dataset,
  AppEvent,
  Evidence,
  InterviewQuestion,
  Person,
  RoleProfile,
} from '../types'
import { STAGES, OUTCOMES, emptyPerson } from '../types'
import { nowIso } from '../lib/id'

// Offline persistence. The entire dataset lives under one localStorage key as
// a single JSON blob. This is deliberately the same shape as the JSON export,
// so a backup file and the live store are byte-for-byte compatible, and so a
// future Supabase store can be populated from the same structure.

export const STORAGE_KEY = 'job-tracker:v1'
// Sidecar keys, kept OUT of the dataset blob so they never bloat exports or get
// imported: a preserved copy of an unreadable blob, an undo snapshot taken
// before a destructive replace, and the last-export timestamp for the nudge.
const CORRUPT_KEY = STORAGE_KEY + ':corrupt'
const UNDO_KEY = STORAGE_KEY + ':undo'
const EXPORT_KEY = STORAGE_KEY + ':last-export'

export function emptyDataset(): Dataset {
  return {
    person: emptyPerson(),
    capabilities: [],
    role_profiles: [],
    evidence: [],
    cv_versions: [],
    cv_experience: [],
    cv_education: [],
    applications: [],
    events: [],
    application_evidence: [],
    criteria: [],
    interview_questions: [],
  }
}

// --- coercion helpers: never trust an imported/old blob's row shapes ---------
type Row = Record<string, unknown>
const asRows = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === 'object') : []
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const idOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d)
const num = (v: unknown, d = 0): number => (typeof v === 'number' && isFinite(v) ? v : d)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

function normPerson(v: unknown): Person {
  if (!v || typeof v !== 'object') return emptyPerson()
  const o = v as Row
  return {
    full_name: str(o.full_name),
    headline: strOrNull(o.headline),
    email: strOrNull(o.email),
    phone: strOrNull(o.phone),
    location: strOrNull(o.location),
    links: strArr(o.links),
    summary: strOrNull(o.summary),
    skills: strArr(o.skills),
  }
}

/** Coerce a CV version's layout blob into shape (FK cleanup happens later). */
function normLayout(v: unknown): CvLayout | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Row
  const rawBullets = o.bullets && typeof o.bullets === 'object' ? (o.bullets as Record<string, unknown>) : {}
  const bullets: Record<string, CvBullet[]> = {}
  for (const k of Object.keys(rawBullets)) {
    bullets[k] = asRows(rawBullets[k])
      .filter((b) => idOrNull(b.id))
      .map((b) => ({ id: str(b.id), evidence_id: idOrNull(b.evidence_id), text: strOrNull(b.text) }))
  }
  return {
    summary: strOrNull(o.summary),
    hidden_experience_ids: strArr(o.hidden_experience_ids),
    hidden_education_ids: strArr(o.hidden_education_ids),
    bullets,
    skills: Array.isArray(o.skills) ? strArr(o.skills) : null,
    template: typeof o.template === 'string' ? o.template : undefined,
  }
}

/**
 * Coerce an unknown parsed blob into a Dataset. Missing top-level keys, missing
 * row fields, wrong types, rows without an id, and dangling foreign keys are all
 * tolerated — old or partial exports load without crashing a screen that
 * assumes a field exists (e.g. `use_count + 1`, `capabilities.map(...)`).
 */
export function normaliseDataset(raw: unknown): Dataset {
  if (!raw || typeof raw !== 'object') return emptyDataset()
  const r = raw as Partial<Record<keyof Dataset, unknown>>
  const now = nowIso()

  const capabilities: Capability[] = asRows(r.capabilities)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({ id: str(x.id), name: str(x.name), note: strOrNull(x.note) }))

  const role_profiles: RoleProfile[] = asRows(r.role_profiles)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({
      id: str(x.id),
      name: str(x.name),
      positioning: strOrNull(x.positioning),
      priority_capabilities: strArr(x.priority_capabilities),
      vocabulary: strOrNull(x.vocabulary),
      created_at: str(x.created_at, now),
    }))

  const evidence: Evidence[] = asRows(r.evidence)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({
      id: str(x.id),
      title: str(x.title),
      bullet: strOrNull(x.bullet),
      full_text: strOrNull(x.full_text),
      capabilities: strArr(x.capabilities),
      when_happened: strOrNull(x.when_happened),
      use_count: num(x.use_count),
      last_used_at: strOrNull(x.last_used_at),
      created_at: str(x.created_at, now),
    }))

  const cv_versions: CvVersion[] = asRows(r.cv_versions)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({
      id: str(x.id),
      label: str(x.label),
      profile_id: idOrNull(x.profile_id),
      angle: strOrNull(x.angle),
      file_path: strOrNull(x.file_path),
      is_current: bool(x.is_current),
      layout: normLayout(x.layout),
      created_at: str(x.created_at, now),
    }))

  const cv_experience: CvExperience[] = asRows(r.cv_experience)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({
      id: str(x.id),
      company: str(x.company),
      title: str(x.title),
      location: strOrNull(x.location),
      start: strOrNull(x.start),
      end: strOrNull(x.end),
      position: num(x.position),
    }))

  const cv_education: CvEducation[] = asRows(r.cv_education)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({
      id: str(x.id),
      institution: str(x.institution),
      qualification: strOrNull(x.qualification),
      field: strOrNull(x.field),
      start: strOrNull(x.start),
      end: strOrNull(x.end),
      note: strOrNull(x.note),
      position: num(x.position),
    }))

  const applications: Application[] = asRows(r.applications)
    .filter((x) => idOrNull(x.id))
    .map((x) => ({
      id: str(x.id),
      role: str(x.role),
      company: strOrNull(x.company),
      profile_id: idOrNull(x.profile_id),
      stage: STAGES.includes(x.stage as never) ? (x.stage as Application['stage']) : 'drafting',
      outcome: OUTCOMES.includes(x.outcome as never) ? (x.outcome as Application['outcome']) : null,
      closed_from_stage: strOrNull(x.closed_from_stage),
      source: strOrNull(x.source),
      link: strOrNull(x.link),
      ad_text: strOrNull(x.ad_text),
      keywords: strArr(x.keywords),
      location: strOrNull(x.location),
      salary_stated: strOrNull(x.salary_stated),
      applied_on: strOrNull(x.applied_on),
      closes_on: strOrNull(x.closes_on),
      next_action_at: strOrNull(x.next_action_at),
      cv_version_id: idOrNull(x.cv_version_id),
      told_them: strOrNull(x.told_them),
      notes: strOrNull(x.notes),
      created_at: str(x.created_at, now),
      updated_at: str(x.updated_at, now),
    }))

  const KINDS = ['stage', 'note', 'contact', 'told', 'draft']
  const events: AppEvent[] = asRows(r.events)
    .filter((x) => idOrNull(x.id) && idOrNull(x.application_id))
    .map((x) => ({
      id: str(x.id),
      application_id: str(x.application_id),
      kind: (KINDS.includes(x.kind as string) ? x.kind : 'note') as AppEvent['kind'],
      body: str(x.body),
      occurred_at: str(x.occurred_at, now),
    }))

  const application_evidence: ApplicationEvidence[] = asRows(r.application_evidence)
    .filter((x) => idOrNull(x.application_id) && idOrNull(x.evidence_id))
    .map((x) => ({ application_id: str(x.application_id), evidence_id: str(x.evidence_id) }))

  const criteria: Criterion[] = asRows(r.criteria)
    .filter((x) => idOrNull(x.id) && idOrNull(x.application_id))
    .map((x) => ({
      id: str(x.id),
      application_id: str(x.application_id),
      text: str(x.text),
      essential: bool(x.essential, true),
      covered_by: idOrNull(x.covered_by),
      position: num(x.position),
    }))

  const interview_questions: InterviewQuestion[] = asRows(r.interview_questions)
    .filter((x) => idOrNull(x.id) && idOrNull(x.application_id))
    .map((x) => ({
      id: str(x.id),
      application_id: str(x.application_id),
      text: str(x.text),
      covered_by: idOrNull(x.covered_by),
      notes: strOrNull(x.notes),
      asked: bool(x.asked),
      position: num(x.position),
    }))

  // Drop dangling foreign keys / null out orphaned references, mirroring the DB
  // ON DELETE CASCADE (children) and ON DELETE SET NULL (covered_by / *_id).
  const appIds = new Set(applications.map((a) => a.id))
  const evIds = new Set(evidence.map((e) => e.id))
  const profIds = new Set(role_profiles.map((p) => p.id))
  const cvIds = new Set(cv_versions.map((c) => c.id))
  const expIds = new Set(cv_experience.map((e) => e.id))
  const eduIds = new Set(cv_education.map((e) => e.id))
  const nullMissing = (v: string | null, set: Set<string>) => (v && set.has(v) ? v : null)

  // A CV layout can reference deleted experiences/evidence — drop those so the
  // builder never renders a dangling bullet.
  const cleanLayout = (l: CvLayout): CvLayout => {
    const bullets: Record<string, CvBullet[]> = {}
    for (const k of Object.keys(l.bullets)) {
      if (!expIds.has(k)) continue
      bullets[k] = l.bullets[k].filter((b) =>
        b.evidence_id ? evIds.has(b.evidence_id) : !!(b.text && b.text.trim()),
      )
    }
    return {
      ...l,
      bullets,
      hidden_experience_ids: l.hidden_experience_ids.filter((id) => expIds.has(id)),
      hidden_education_ids: l.hidden_education_ids.filter((id) => eduIds.has(id)),
    }
  }

  return {
    person: normPerson(r.person),
    capabilities,
    role_profiles,
    evidence,
    cv_experience,
    cv_education,
    cv_versions: cv_versions.map((c) => ({
      ...c,
      profile_id: nullMissing(c.profile_id, profIds),
      layout: c.layout ? cleanLayout(c.layout) : null,
    })),
    applications: applications.map((a) => ({
      ...a,
      profile_id: nullMissing(a.profile_id, profIds),
      cv_version_id: nullMissing(a.cv_version_id, cvIds),
    })),
    events: events.filter((e) => appIds.has(e.application_id)),
    application_evidence: application_evidence.filter(
      (ae) => appIds.has(ae.application_id) && evIds.has(ae.evidence_id),
    ),
    criteria: criteria
      .filter((c) => appIds.has(c.application_id))
      .map((c) => ({ ...c, covered_by: nullMissing(c.covered_by, evIds) })),
    interview_questions: interview_questions
      .filter((q) => appIds.has(q.application_id))
      .map((q) => ({ ...q, covered_by: nullMissing(q.covered_by, evIds) })),
  }
}

export interface LoadResult {
  data: Dataset
  /** True when the stored blob couldn't be parsed and a raw copy was preserved
   * under CORRUPT_KEY — the UI should offer to download it rather than silently
   * starting empty. */
  recovered: boolean
}

/** Load the dataset, preserving an unreadable blob instead of discarding it. */
export function loadDatasetSafe(): LoadResult {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { data: emptyDataset(), recovered: false }
  }
  if (!raw) return { data: emptyDataset(), recovered: false }
  try {
    return { data: normaliseDataset(JSON.parse(raw)), recovered: false }
  } catch (err) {
    // Corrupt storage must NOT lead to a silent empty board whose first write
    // then overwrites the only copy. Stash the raw bytes under a sidecar key
    // (keep the earliest copy; don't clobber it on repeated loads) and flag it.
    console.error('Failed to parse saved data; kept a raw backup:', err)
    try {
      if (!localStorage.getItem(CORRUPT_KEY)) localStorage.setItem(CORRUPT_KEY, raw)
    } catch {
      /* nothing more we can do */
    }
    return { data: emptyDataset(), recovered: true }
  }
}

/** Back-compat convenience for callers that only want the data. */
export function loadDataset(): Dataset {
  return loadDatasetSafe().data
}

/** Persist the dataset. Returns false (without throwing or alerting) when the
 * write fails — quota exceeded, private mode — so the caller can surface a
 * persistent "unsaved" state instead of losing edits silently. */
export function saveDataset(data: Dataset): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.error('Failed to save data:', err)
    return false
  }
}

/** Pretty-printed JSON for the export file. */
export function serialiseDataset(data: Dataset): string {
  return JSON.stringify(data, null, 2)
}

// --- corrupt-blob backup ----------------------------------------------------
export function getCorruptBackup(): string | null {
  try {
    return localStorage.getItem(CORRUPT_KEY)
  } catch {
    return null
  }
}
export function clearCorruptBackup(): void {
  try {
    localStorage.removeItem(CORRUPT_KEY)
  } catch {
    /* ignore */
  }
}

// --- last-export timestamp (for the backup nudge) ---------------------------
export function markExported(): void {
  try {
    localStorage.setItem(EXPORT_KEY, nowIso())
  } catch {
    /* ignore */
  }
}
export function lastExportAt(): string | null {
  try {
    return localStorage.getItem(EXPORT_KEY)
  } catch {
    return null
  }
}

// --- undo snapshot for destructive replaces (import / sample / reset) --------
/** Copy the current stored blob to the undo slot before a destructive replace,
 * so it can be restored. No-op if there's nothing stored yet. */
export function snapshotForUndo(): void {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current != null) localStorage.setItem(UNDO_KEY, current)
  } catch {
    /* ignore */
  }
}
export function hasUndo(): boolean {
  try {
    return localStorage.getItem(UNDO_KEY) != null
  } catch {
    return false
  }
}
/** Parse and return the undo snapshot (then clear it), or null if none/invalid. */
export function takeUndo(): Dataset | null {
  try {
    const raw = localStorage.getItem(UNDO_KEY)
    localStorage.removeItem(UNDO_KEY)
    if (!raw) return null
    return normaliseDataset(JSON.parse(raw))
  } catch {
    return null
  }
}
export function clearUndo(): void {
  try {
    localStorage.removeItem(UNDO_KEY)
  } catch {
    /* ignore */
  }
}

// --- preferences (onboarding + targets) -------------------------------------
// Local UI/config, deliberately OUTSIDE the Dataset (and its SQL mirror): it's
// per-device, not domain data, so it never bloats an export or a future sync.
const PREFS_KEY = STORAGE_KEY + ':prefs'

/** A saved job search: keywords + where, run against the board deep-links. */
export interface SavedSearch {
  id: string
  keywords: string
  location: string
  remote: boolean
}

export interface Prefs {
  /** The getting-started checklist has been dismissed. */
  checklistDismissed: boolean
  /** Weekly tailored-application target for the progress ring. */
  weeklyTarget: number
  /** Saved job searches for the "Find jobs" launcher. */
  savedSearches: SavedSearch[]
}

export function defaultPrefs(): Prefs {
  return { checklistDismissed: false, weeklyTarget: 5, savedSearches: [] }
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs()
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      checklistDismissed: typeof p.checklistDismissed === 'boolean' ? p.checklistDismissed : false,
      weeklyTarget:
        typeof p.weeklyTarget === 'number' && p.weeklyTarget > 0 ? Math.round(p.weeklyTarget) : 5,
      savedSearches: Array.isArray(p.savedSearches)
        ? p.savedSearches
            .filter(
              (s): s is SavedSearch =>
                !!s && typeof s === 'object' && typeof (s as SavedSearch).id === 'string',
            )
            .map((s) => ({
              id: String(s.id),
              keywords: typeof s.keywords === 'string' ? s.keywords : '',
              location: typeof s.location === 'string' ? s.location : '',
              remote: typeof s.remote === 'boolean' ? s.remote : false,
            }))
        : [],
    }
  } catch {
    return defaultPrefs()
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
