import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppEvent,
  Application,
  Capability,
  CvVersion,
  Dataset,
  Evidence,
  Outcome,
  RoleProfile,
  Stage,
} from '../types'
import { loadDataset, saveDataset, emptyDataset, normaliseDataset } from './localStore'
import * as m from './mutations'

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
  updateEvidence: (id: string, patch: Partial<Omit<Evidence, 'id' | 'created_at'>>) => void
  deleteEvidence: (id: string) => void

  // cv versions
  addCvVersion: (label: string) => CvVersion
  updateCvVersion: (id: string, patch: Partial<Omit<CvVersion, 'id' | 'created_at'>>) => void
  deleteCvVersion: (id: string) => void

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
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(loadDataset)
  // Ref mirrors the latest dataset so sequential synchronous actions compose
  // correctly and we never build on a stale closure.
  const ref = useRef(data)
  useEffect(() => {
    ref.current = data
  }, [data])

  const commit = useCallback((next: Dataset) => {
    ref.current = next
    setData(next)
    saveDataset(next)
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
    updateEvidence: (id, patch) => run((d) => m.updateEvidence(d, id, patch)),
    deleteEvidence: (id) => run((d) => m.deleteEvidence(d, id)),

    addCvVersion: (label) => runCreate((d) => m.addCvVersion(d, label)),
    updateCvVersion: (id, patch) => run((d) => m.updateCvVersion(d, id, patch)),
    deleteCvVersion: (id) => run((d) => m.deleteCvVersion(d, id)),

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

    replaceAll: (incoming) => commit(normaliseDataset(incoming)),
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
