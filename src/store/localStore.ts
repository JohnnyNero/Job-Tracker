import type { Dataset } from '../types'

// Offline persistence. The entire dataset lives under one localStorage key as
// a single JSON blob. This is deliberately the same shape as the JSON export,
// so a backup file and the live store are byte-for-byte compatible, and so a
// future Supabase store can be populated from the same structure.

export const STORAGE_KEY = 'job-tracker:v1'

export function emptyDataset(): Dataset {
  return {
    capabilities: [],
    role_profiles: [],
    evidence: [],
    cv_versions: [],
    applications: [],
    events: [],
    application_evidence: [],
    criteria: [],
    interview_questions: [],
  }
}

/** Coerce an unknown parsed blob into a Dataset, tolerating missing keys so
 * old exports and partial data still load. */
export function normaliseDataset(raw: unknown): Dataset {
  const base = emptyDataset()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<Record<keyof Dataset, unknown>>
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    capabilities: arr(r.capabilities),
    role_profiles: arr(r.role_profiles),
    evidence: arr(r.evidence),
    cv_versions: arr(r.cv_versions),
    applications: arr(r.applications),
    events: arr(r.events),
    application_evidence: arr(r.application_evidence),
    criteria: arr(r.criteria),
    interview_questions: arr(r.interview_questions),
  }
}

export function loadDataset(): Dataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDataset()
    return normaliseDataset(JSON.parse(raw))
  } catch (err) {
    // Corrupt storage shouldn't wipe the app; surface an empty board and let
    // the user re-import a backup.
    console.error('Failed to load saved data:', err)
    return emptyDataset()
  }
}

export function saveDataset(data: Dataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save data:', err)
    // localStorage can be full or blocked (private mode). Tell the user rather
    // than silently losing edits.
    alert(
      'Could not save your changes to this browser. Export a backup from ' +
        'Settings and check your browser storage settings.',
    )
  }
}

/** Pretty-printed JSON for the export file. */
export function serialiseDataset(data: Dataset): string {
  return JSON.stringify(data, null, 2)
}
