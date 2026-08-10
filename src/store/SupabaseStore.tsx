import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Dataset } from '../types'
import { StoreContext, type StoreValue } from './store'
import { emptyDataset, normaliseDataset } from './localStore'
import * as m from './mutations'
import { computeDiff } from './diffSync'
import { applyOp, fetchDataset, fetchTables } from './supabaseClient'

// Tables whose contents the DB mutates via triggers; refetch them after any
// write so trigger-created events and trigger-set fields become authoritative.
const RECONCILE: (keyof Dataset)[] = ['events', 'applications']

export function SupabaseStore({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(emptyDataset)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef(data)
  useEffect(() => {
    ref.current = data
  }, [data])

  useEffect(() => {
    fetchDataset()
      .then((d) => {
        ref.current = d
        setData(d)
      })
      .catch((err) => console.error('Initial load failed:', err))
      .finally(() => setLoaded(true))
  }, [])

  // Push the diff between prev and next, then reconcile trigger-owned tables.
  const push = useCallback(async (prev: Dataset, next: Dataset) => {
    const ops = computeDiff(prev, next)
    if (ops.length === 0) return
    try {
      for (const op of ops) await applyOp(op)
      const fresh = await fetchTables(RECONCILE)
      const merged = { ...ref.current, ...fresh }
      ref.current = merged
      setData(merged)
    } catch (err) {
      console.error('Sync failed; optimistic state kept:', err)
    }
  }, [])

  const commit = useCallback(
    (next: Dataset) => {
      const prev = ref.current
      ref.current = next
      setData(next)
      void push(prev, next)
    },
    [push],
  )

  const run = useCallback(
    (fn: (d: Dataset) => Dataset) => commit(fn(ref.current)),
    [commit],
  )
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
    replaceAll: (incoming) => commit(normaliseDataset(incoming)),
  }

  if (!loaded) return <div className="app-loading">Loading your data…</div>
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
