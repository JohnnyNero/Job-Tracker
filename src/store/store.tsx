import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppEvent,
  Application,
  Capability,
  CvEducation,
  CvExperience,
  CvLayout,
  CvVersion,
  Dataset,
  Evidence,
  Outcome,
  Person,
  RoleProfile,
  Stage,
} from '../types'
import {
  loadDatasetSafe,
  saveDataset,
  serialiseDataset,
  emptyDataset,
  normaliseDataset,
  snapshotForUndo,
  hasUndo,
  takeUndo,
  clearUndo,
  markExported,
  lastExportAt,
  getCorruptBackup,
  clearCorruptBackup,
  loadPrefs,
  savePrefs,
  type Prefs,
} from './localStore'
import { daysSince, todayIsoDate } from '../lib/dates'
import * as m from './mutations'

/** Health of the local store, surfaced so the UI can warn before data is lost. */
export interface DataHealth {
  /** The last save to localStorage failed (quota/blocked) — edits are unsaved. */
  saveError: boolean
  /** The stored blob was unreadable on load; a raw copy was preserved. */
  recovered: boolean
  /** An undo snapshot from the last destructive replace is available. */
  undoAvailable: boolean
  /** Whole days since the last backup (or first activity), or null. */
  daysSinceExport: number | null
  /** Whether to show the "back up your data" nudge right now. */
  nudgeBackup: boolean
}

function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// The store is the single source of truth for the UI. It holds the whole
// dataset in memory, mirrors every write to localStorage, and exposes bound
// actions. Swapping to Supabase later means writing a provider with this same
// value shape (async under the hood) — no screen needs to change.

interface StoreValue {
  data: Dataset

  // applications
  addApplication: (input: m.NewApplication) => Application
  updateApplication: (
    id: string,
    patch: Partial<
      Omit<Application, 'id' | 'created_at' | 'updated_at' | 'stage' | 'outcome' | 'closed_from_stage'>
    >,
  ) => void
  changeStage: (id: string, stage: Stage) => void
  closeApplication: (id: string, outcome: Outcome) => void
  logFollowUp: (id: string) => void
  snoozeApplication: (id: string, days: number) => void
  deleteApplication: (id: string) => void

  // events
  addEvent: (applicationId: string, kind: AppEvent['kind'], body: string) => void
  deleteEvent: (id: string) => void

  // profiles
  addProfile: (name: string) => RoleProfile
  updateProfile: (id: string, patch: Partial<Omit<RoleProfile, 'id' | 'created_at'>>) => void
  deleteProfile: (id: string) => void

  // capabilities
  addCapability: (name: string, note?: string | null) => void
  updateCapability: (id: string, patch: Partial<Omit<Capability, 'id'>>) => void
  deleteCapability: (id: string) => void

  // evidence
  addEvidence: (title: string) => Evidence
  addEvidenceBulk: (items: { title: string; bullet?: string | null }[]) => Evidence[]
  updateEvidence: (id: string, patch: Partial<Omit<Evidence, 'id' | 'created_at'>>) => void
  deleteEvidence: (id: string) => void

  // cv versions
  addCvVersion: (label: string) => CvVersion
  updateCvVersion: (id: string, patch: Partial<Omit<CvVersion, 'id' | 'created_at'>>) => void
  deleteCvVersion: (id: string) => void

  // cv builder
  updatePerson: (patch: Partial<Person>) => void
  updateCvLayout: (versionId: string, patch: Partial<CvLayout>) => void
  addExperience: () => CvExperience
  updateExperience: (id: string, patch: Partial<Omit<CvExperience, 'id'>>) => void
  deleteExperience: (id: string) => void
  moveExperience: (id: string, dir: -1 | 1) => void
  addEducation: () => CvEducation
  updateEducation: (id: string, patch: Partial<Omit<CvEducation, 'id'>>) => void
  deleteEducation: (id: string) => void
  moveEducation: (id: string, dir: -1 | 1) => void

  // composer
  recordEvidenceUse: (applicationId: string, evidenceIds: string[]) => void

  // criteria
  addCriterion: (applicationId: string, text: string, essential?: boolean) => void
  addCriteriaBulk: (applicationId: string, texts: string[]) => void
  updateCriterion: (
    id: string,
    patch: Partial<Omit<import('../types').Criterion, 'id' | 'application_id'>>,
  ) => void
  deleteCriterion: (id: string) => void
  moveCriterion: (id: string, dir: -1 | 1) => void

  // interview prep
  addInterviewQuestion: (applicationId: string, text: string, coveredBy?: string | null) => void
  addQuestionsFromCriteria: (applicationId: string) => void
  updateInterviewQuestion: (
    id: string,
    patch: Partial<Omit<import('../types').InterviewQuestion, 'id' | 'application_id'>>,
  ) => void
  deleteInterviewQuestion: (id: string) => void
  moveInterviewQuestion: (id: string, dir: -1 | 1) => void

  // whole-dataset ops (export / import / sample / reset)
  replaceAll: (data: Dataset) => void

  // data safety
  health: DataHealth
  /** Download a JSON backup and record that a backup was taken. */
  exportNow: () => void
  /** Restore the snapshot taken before the last destructive replace. */
  restoreUndo: () => void
  /** Discard the undo snapshot (keep the current data). */
  keepCurrent: () => void
  /** Acknowledge the corrupt-blob warning (clears the preserved copy). */
  dismissRecovered: () => void
  /** Download the raw, unreadable blob that was preserved on a failed load. */
  downloadCorruptBackup: () => void
  /** Hide the backup nudge for this session. */
  dismissBackupNudge: () => void

  // preferences (onboarding + targets) — local, not part of the Dataset
  prefs: Prefs
  setPrefs: (patch: Partial<Prefs>) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadDatasetSafe)
  const [data, setData] = useState<Dataset>(initial.data)
  // Ref mirrors the latest dataset so sequential synchronous actions compose
  // correctly and we never build on a stale closure.
  const ref = useRef(data)
  useEffect(() => {
    ref.current = data
  }, [data])

  // Data-safety state.
  const [saveError, setSaveError] = useState(false)
  const [recovered, setRecovered] = useState(initial.recovered)
  const [undoAvailable, setUndoAvailable] = useState(hasUndo)
  const [lastExport, setLastExport] = useState<string | null>(lastExportAt)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs)

  const commit = useCallback((next: Dataset) => {
    ref.current = next
    setData(next)
    // A failed write must be visible, not silent — flag it so the UI can prompt
    // an export. A later successful write clears the flag.
    setSaveError(!saveDataset(next))
  }, [])

  // Wrap a mutation that returns just a Dataset.
  const run = useCallback(
    (fn: (d: Dataset) => Dataset) => {
      commit(fn(ref.current))
    },
    [commit],
  )

  // Wrap a mutation that returns [Dataset, created] and hand back `created`.
  const runCreate = useCallback(
    <T,>(fn: (d: Dataset) => [Dataset, T]): T => {
      const [next, created] = fn(ref.current)
      commit(next)
      return created
    },
    [commit],
  )

  // Backup nudge: measure from the last export, or — if never exported — from
  // the earliest thing the user created, so a brand-new board isn't nagged but
  // a week of unbacked-up work is.
  const earliestActivity = [...data.applications, ...data.evidence]
    .map((x) => x.created_at)
    .filter(Boolean)
    .sort()[0]
  const backupRef = lastExport ?? earliestActivity ?? null
  const daysSinceExport = backupRef ? daysSince(backupRef) : null
  const hasData = data.applications.length > 0 || data.evidence.length > 0
  const nudgeBackup = hasData && !nudgeDismissed && (daysSinceExport ?? 0) >= 7

  const value: StoreValue = {
    data,

    addApplication: (input) => runCreate((d) => m.addApplication(d, input)),
    updateApplication: (id, patch) => run((d) => m.updateApplication(d, id, patch)),
    changeStage: (id, stage) => run((d) => m.changeStage(d, id, stage)),
    closeApplication: (id, outcome) => run((d) => m.closeApplication(d, id, outcome)),
    logFollowUp: (id) => run((d) => m.logFollowUp(d, id)),
    snoozeApplication: (id, days) => run((d) => m.snoozeApplication(d, id, days)),
    deleteApplication: (id) => run((d) => m.deleteApplication(d, id)),

    addEvent: (applicationId, kind, body) => run((d) => m.addEvent(d, applicationId, kind, body)),
    deleteEvent: (id) => run((d) => m.deleteEvent(d, id)),

    addProfile: (name) => runCreate((d) => m.addProfile(d, name)),
    updateProfile: (id, patch) => run((d) => m.updateProfile(d, id, patch)),
    deleteProfile: (id) => run((d) => m.deleteProfile(d, id)),

    addCapability: (name, note = null) => run((d) => m.addCapability(d, name, note)),
    updateCapability: (id, patch) => run((d) => m.updateCapability(d, id, patch)),
    deleteCapability: (id) => run((d) => m.deleteCapability(d, id)),

    addEvidence: (title) => runCreate((d) => m.addEvidence(d, title)),
    addEvidenceBulk: (items) => runCreate((d) => m.addEvidenceBulk(d, items)),
    updateEvidence: (id, patch) => run((d) => m.updateEvidence(d, id, patch)),
    deleteEvidence: (id) => run((d) => m.deleteEvidence(d, id)),

    addCvVersion: (label) => runCreate((d) => m.addCvVersion(d, label)),
    updateCvVersion: (id, patch) => run((d) => m.updateCvVersion(d, id, patch)),
    deleteCvVersion: (id) => run((d) => m.deleteCvVersion(d, id)),

    updatePerson: (patch) => run((d) => m.updatePerson(d, patch)),
    updateCvLayout: (versionId, patch) => run((d) => m.updateCvLayout(d, versionId, patch)),
    addExperience: () => runCreate((d) => m.addExperience(d)),
    updateExperience: (id, patch) => run((d) => m.updateExperience(d, id, patch)),
    deleteExperience: (id) => run((d) => m.deleteExperience(d, id)),
    moveExperience: (id, dir) => run((d) => m.moveExperience(d, id, dir)),
    addEducation: () => runCreate((d) => m.addEducation(d)),
    updateEducation: (id, patch) => run((d) => m.updateEducation(d, id, patch)),
    deleteEducation: (id) => run((d) => m.deleteEducation(d, id)),
    moveEducation: (id, dir) => run((d) => m.moveEducation(d, id, dir)),

    recordEvidenceUse: (applicationId, evidenceIds) =>
      run((d) => m.recordEvidenceUse(d, applicationId, evidenceIds)),

    addCriterion: (applicationId, text, essential = true) =>
      runCreate((d) => m.addCriterion(d, applicationId, text, essential)),
    addCriteriaBulk: (applicationId, texts) => run((d) => m.addCriteriaBulk(d, applicationId, texts)),
    updateCriterion: (id, patch) => run((d) => m.updateCriterion(d, id, patch)),
    deleteCriterion: (id) => run((d) => m.deleteCriterion(d, id)),
    moveCriterion: (id, dir) => run((d) => m.moveCriterion(d, id, dir)),

    addInterviewQuestion: (applicationId, text, coveredBy = null) =>
      runCreate((d) => m.addInterviewQuestion(d, applicationId, text, coveredBy)),
    addQuestionsFromCriteria: (applicationId) =>
      run((d) => m.addQuestionsFromCriteria(d, applicationId)),
    updateInterviewQuestion: (id, patch) => run((d) => m.updateInterviewQuestion(d, id, patch)),
    deleteInterviewQuestion: (id) => run((d) => m.deleteInterviewQuestion(d, id)),
    moveInterviewQuestion: (id, dir) => run((d) => m.moveInterviewQuestion(d, id, dir)),

    // Destructive replace (import / sample / reset): snapshot the current data
    // first so it can be undone, then commit the incoming (normalised) data.
    replaceAll: (incoming) => {
      snapshotForUndo()
      setUndoAvailable(true)
      commit(normaliseDataset(incoming))
    },

    health: {
      saveError,
      recovered,
      undoAvailable,
      daysSinceExport,
      nudgeBackup,
    },
    exportNow: () => {
      downloadText(
        `job-tracker-backup-${todayIsoDate()}.json`,
        serialiseDataset(ref.current),
        'application/json',
      )
      markExported()
      setLastExport(lastExportAt())
      setNudgeDismissed(true)
    },
    restoreUndo: () => {
      const prev = takeUndo()
      setUndoAvailable(false)
      if (prev) commit(prev)
    },
    keepCurrent: () => {
      clearUndo()
      setUndoAvailable(false)
    },
    dismissRecovered: () => {
      clearCorruptBackup()
      setRecovered(false)
    },
    downloadCorruptBackup: () => {
      const raw = getCorruptBackup()
      if (raw) downloadText(`job-tracker-unreadable-${todayIsoDate()}.json`, raw, 'application/json')
    },
    dismissBackupNudge: () => setNudgeDismissed(true),

    prefs,
    setPrefs: (patch) => {
      const next = { ...prefs, ...patch }
      setPrefsState(next)
      savePrefs(next)
    },
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}

/** Convenience for a fresh, empty dataset (used by "reset"). */
export { emptyDataset }
