import type {
  AppEvent,
  Application,
  Capability,
  Criterion,
  CvVersion,
  Dataset,
  Evidence,
  Outcome,
  RoleProfile,
  Stage,
} from '../types'
import { STAGE_LABELS, OUTCOME_LABELS } from '../lib/constants'
import { newId, nowIso } from '../lib/id'

// Pure mutations: (dataset, args) -> new dataset. No I/O. These encode the
// business rules the Postgres triggers will enforce online, so behaviour is
// identical whether the data lives in localStorage or Supabase:
//   - applications.updated_at is bumped on every write
//   - a stage change appends an events row of kind 'stage'
//   - closing records the previous stage into closed_from_stage
// Keeping them pure makes them trivial to reason about and to unit-test later.

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function replace<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => (x.id === item.id ? item : x))
}

function makeEvent(applicationId: string, kind: AppEvent['kind'], body: string): AppEvent {
  return {
    id: newId(),
    application_id: applicationId,
    kind,
    body,
    occurred_at: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// applications
// ---------------------------------------------------------------------------

export type NewApplication = Partial<Omit<Application, 'id' | 'created_at' | 'updated_at'>> & {
  role: string
}

export function addApplication(data: Dataset, input: NewApplication): [Dataset, Application] {
  const now = nowIso()
  const app: Application = {
    id: newId(),
    role: input.role,
    company: input.company ?? null,
    profile_id: input.profile_id ?? null,
    stage: input.stage ?? 'drafting',
    outcome: input.outcome ?? null,
    closed_from_stage: input.closed_from_stage ?? null,
    source: input.source ?? null,
    link: input.link ?? null,
    ad_text: input.ad_text ?? null,
    location: input.location ?? null,
    salary_stated: input.salary_stated ?? null,
    applied_on: input.applied_on ?? null,
    closes_on: input.closes_on ?? null,
    cv_version_id: input.cv_version_id ?? null,
    told_them: input.told_them ?? null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  }
  return [{ ...data, applications: [...data.applications, app] }, app]
}

/** Patch simple fields on an application (save-on-blur). Does NOT handle stage
 * transitions — use changeStage / closeApplication for those so the event log
 * and closed_from_stage stay correct. */
export function updateApplication(
  data: Dataset,
  id: string,
  patch: Partial<Omit<Application, 'id' | 'created_at' | 'updated_at' | 'stage' | 'outcome' | 'closed_from_stage'>>,
): Dataset {
  const existing = data.applications.find((a) => a.id === id)
  if (!existing) return data
  const updated: Application = { ...existing, ...patch, updated_at: nowIso() }
  return { ...data, applications: replace(data.applications, updated) }
}

/**
 * Move an application to a non-closed stage. Appends a 'stage' event.
 * To close, use closeApplication (it needs an outcome). Moving OUT of closed
 * clears the outcome and closed_from_stage.
 */
export function changeStage(data: Dataset, id: string, stage: Stage): Dataset {
  const existing = data.applications.find((a) => a.id === id)
  if (!existing || existing.stage === stage) return data
  if (stage === 'closed') {
    // Caller should use closeApplication; default to no_response defensively.
    return closeApplication(data, id, 'no_response')
  }
  const wasClosed = existing.stage === 'closed'
  const updated: Application = {
    ...existing,
    stage,
    outcome: wasClosed ? null : existing.outcome,
    closed_from_stage: wasClosed ? null : existing.closed_from_stage,
    updated_at: nowIso(),
  }
  const body = wasClosed
    ? `Reopened → ${STAGE_LABELS[stage]}`
    : `${STAGE_LABELS[existing.stage]} → ${STAGE_LABELS[stage]}`
  return {
    ...data,
    applications: replace(data.applications, updated),
    events: [...data.events, makeEvent(id, 'stage', body)],
  }
}

/** Close an application with an outcome. Records the stage it died at and logs
 * a stage event. */
export function closeApplication(data: Dataset, id: string, outcome: Outcome): Dataset {
  const existing = data.applications.find((a) => a.id === id)
  if (!existing) return data
  const cameFrom = existing.stage === 'closed' ? existing.closed_from_stage : existing.stage
  const updated: Application = {
    ...existing,
    stage: 'closed',
    outcome,
    closed_from_stage: cameFrom,
    updated_at: nowIso(),
  }
  const label = cameFrom ? STAGE_LABELS[cameFrom as Stage] ?? cameFrom : 'unknown'
  const body = `Closed (${OUTCOME_LABELS[outcome]}) from ${label}`
  return {
    ...data,
    applications: replace(data.applications, updated),
    events: [...data.events, makeEvent(id, 'stage', body)],
  }
}

export function deleteApplication(data: Dataset, id: string): Dataset {
  return {
    ...data,
    applications: data.applications.filter((a) => a.id !== id),
    // Cascade, matching the ON DELETE CASCADE foreign keys.
    events: data.events.filter((e) => e.application_id !== id),
    application_evidence: data.application_evidence.filter((ae) => ae.application_id !== id),
    criteria: data.criteria.filter((c) => c.application_id !== id),
  }
}

// ---------------------------------------------------------------------------
// events (manual notes / contacts)
// ---------------------------------------------------------------------------

export function addEvent(
  data: Dataset,
  applicationId: string,
  kind: AppEvent['kind'],
  body: string,
): Dataset {
  return { ...data, events: [...data.events, makeEvent(applicationId, kind, body)] }
}

export function deleteEvent(data: Dataset, id: string): Dataset {
  return { ...data, events: data.events.filter((e) => e.id !== id) }
}

// ---------------------------------------------------------------------------
// role profiles
// ---------------------------------------------------------------------------

export function addProfile(data: Dataset, name: string): [Dataset, RoleProfile] {
  const profile: RoleProfile = {
    id: newId(),
    name,
    positioning: null,
    priority_capabilities: [],
    vocabulary: null,
    created_at: nowIso(),
  }
  return [{ ...data, role_profiles: [...data.role_profiles, profile] }, profile]
}

export function updateProfile(
  data: Dataset,
  id: string,
  patch: Partial<Omit<RoleProfile, 'id' | 'created_at'>>,
): Dataset {
  const existing = data.role_profiles.find((p) => p.id === id)
  if (!existing) return data
  return { ...data, role_profiles: replace(data.role_profiles, { ...existing, ...patch }) }
}

export function deleteProfile(data: Dataset, id: string): Dataset {
  // Mirror ON DELETE SET NULL: applications and CVs keep existing, lose the ref.
  return {
    ...data,
    role_profiles: data.role_profiles.filter((p) => p.id !== id),
    applications: data.applications.map((a) =>
      a.profile_id === id ? { ...a, profile_id: null } : a,
    ),
    cv_versions: data.cv_versions.map((c) => (c.profile_id === id ? { ...c, profile_id: null } : c)),
  }
}

// ---------------------------------------------------------------------------
// capabilities
// ---------------------------------------------------------------------------

export function addCapability(data: Dataset, name: string, note: string | null = null): Dataset {
  if (data.capabilities.some((c) => c.name.toLowerCase() === name.toLowerCase())) return data
  const cap: Capability = { id: newId(), name, note }
  return { ...data, capabilities: [...data.capabilities, cap] }
}

export function updateCapability(
  data: Dataset,
  id: string,
  patch: Partial<Omit<Capability, 'id'>>,
): Dataset {
  const existing = data.capabilities.find((c) => c.id === id)
  if (!existing) return data
  return { ...data, capabilities: replace(data.capabilities, { ...existing, ...patch }) }
}

export function deleteCapability(data: Dataset, id: string): Dataset {
  return { ...data, capabilities: data.capabilities.filter((c) => c.id !== id) }
}

// ---------------------------------------------------------------------------
// evidence
// ---------------------------------------------------------------------------

export function addEvidence(data: Dataset, title: string): [Dataset, Evidence] {
  const ev: Evidence = {
    id: newId(),
    title,
    bullet: null,
    full_text: null,
    capabilities: [],
    when_happened: null,
    use_count: 0,
    last_used_at: null,
    created_at: nowIso(),
  }
  return [{ ...data, evidence: [...data.evidence, ev] }, ev]
}

export function updateEvidence(
  data: Dataset,
  id: string,
  patch: Partial<Omit<Evidence, 'id' | 'created_at'>>,
): Dataset {
  const existing = data.evidence.find((e) => e.id === id)
  if (!existing) return data
  return { ...data, evidence: replace(data.evidence, { ...existing, ...patch }) }
}

export function deleteEvidence(data: Dataset, id: string): Dataset {
  return {
    ...data,
    evidence: data.evidence.filter((e) => e.id !== id),
    application_evidence: data.application_evidence.filter((ae) => ae.evidence_id !== id),
    criteria: data.criteria.map((c) => (c.covered_by === id ? { ...c, covered_by: null } : c)),
  }
}

// ---------------------------------------------------------------------------
// cv versions
// ---------------------------------------------------------------------------

export function addCvVersion(data: Dataset, label: string): [Dataset, CvVersion] {
  const cv: CvVersion = {
    id: newId(),
    label,
    profile_id: null,
    angle: null,
    file_path: null,
    is_current: false,
    created_at: nowIso(),
  }
  return [{ ...data, cv_versions: [...data.cv_versions, cv] }, cv]
}

export function updateCvVersion(
  data: Dataset,
  id: string,
  patch: Partial<Omit<CvVersion, 'id' | 'created_at'>>,
): Dataset {
  const existing = data.cv_versions.find((c) => c.id === id)
  if (!existing) return data
  return { ...data, cv_versions: replace(data.cv_versions, { ...existing, ...patch }) }
}

export function deleteCvVersion(data: Dataset, id: string): Dataset {
  return {
    ...data,
    cv_versions: data.cv_versions.filter((c) => c.id !== id),
    applications: data.applications.map((a) =>
      a.cv_version_id === id ? { ...a, cv_version_id: null } : a,
    ),
  }
}

// ---------------------------------------------------------------------------
// composer usage (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Record that a set of evidence items was used in an application (on "Copy
 * all"): link each in application_evidence if not already linked, and bump its
 * use_count + last_used_at once. Idempotent per copy for a given id set.
 */
export function recordEvidenceUse(
  data: Dataset,
  applicationId: string,
  evidenceIds: string[],
): Dataset {
  const unique = Array.from(new Set(evidenceIds))
  if (unique.length === 0) return data
  const now = nowIso()

  const links = [...data.application_evidence]
  for (const evidenceId of unique) {
    const exists = links.some(
      (ae) => ae.application_id === applicationId && ae.evidence_id === evidenceId,
    )
    if (!exists) links.push({ application_id: applicationId, evidence_id: evidenceId })
  }

  const evidence = data.evidence.map((e) =>
    unique.includes(e.id) ? { ...e, use_count: e.use_count + 1, last_used_at: now } : e,
  )

  return { ...data, application_evidence: links, evidence }
}

// ---------------------------------------------------------------------------
// criteria (Phase 4 groundwork — kept minimal for now)
// ---------------------------------------------------------------------------

export function setCriteria(data: Dataset, applicationId: string, rows: Criterion[]): Dataset {
  const others = data.criteria.filter((c) => c.application_id !== applicationId)
  return { ...data, criteria: [...others, ...rows] }
}
