import type {
  AppEvent,
  Application,
  Capability,
  Criterion,
  CvVersion,
  Dataset,
  Evidence,
  InterviewQuestion,
  Outcome,
  RoleProfile,
  Stage,
} from '../types'
import { STAGE_LABELS, OUTCOME_LABELS, AWAITING_STAGES } from '../lib/constants'
import { newId, nowIso } from '../lib/id'
import { addBusinessDaysIso, todayIsoDate } from '../lib/dates'

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
    next_action_at: input.next_action_at ?? null,
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
  // Follow-up nudge: entering 'applied' with no reminder set defaults to +7
  // business days, so the application surfaces in the triage queue on its own.
  const nextAction =
    stage === 'applied' && !existing.next_action_at
      ? addBusinessDaysIso(7)
      : existing.next_action_at
  // Start the days-silent clock: advancing to a waiting stage with no applied
  // date stamps today, so the signal (and stale/ghosted triage) work without a
  // manual date entry — this is the most common path via the stage dropdown.
  const appliedOn =
    AWAITING_STAGES.includes(stage) && !existing.applied_on ? todayIsoDate() : existing.applied_on
  const updated: Application = {
    ...existing,
    stage,
    outcome: wasClosed ? null : existing.outcome,
    closed_from_stage: wasClosed ? null : existing.closed_from_stage,
    next_action_at: nextAction,
    applied_on: appliedOn,
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

/** Log a follow-up: append a contact event and push the next-action nudge out
 * +7 business days, so it leaves the triage queue until then. */
export function logFollowUp(data: Dataset, id: string): Dataset {
  const existing = data.applications.find((a) => a.id === id)
  if (!existing) return data
  const updated: Application = {
    ...existing,
    next_action_at: addBusinessDaysIso(7),
    updated_at: nowIso(),
  }
  return {
    ...data,
    applications: replace(data.applications, updated),
    events: [...data.events, makeEvent(id, 'contact', 'Followed up')],
  }
}

/** Snooze the triage nudge by N calendar days. */
export function snoozeApplication(data: Dataset, id: string, days: number): Dataset {
  const existing = data.applications.find((a) => a.id === id)
  if (!existing) return data
  const from = new Date()
  from.setDate(from.getDate() + days)
  const updated: Application = {
    ...existing,
    next_action_at: from.toISOString().slice(0, 10),
    updated_at: nowIso(),
  }
  return { ...data, applications: replace(data.applications, updated) }
}

export function deleteApplication(data: Dataset, id: string): Dataset {
  return {
    ...data,
    applications: data.applications.filter((a) => a.id !== id),
    // Cascade, matching the ON DELETE CASCADE foreign keys.
    events: data.events.filter((e) => e.application_id !== id),
    application_evidence: data.application_evidence.filter((ae) => ae.application_id !== id),
    criteria: data.criteria.filter((c) => c.application_id !== id),
    interview_questions: data.interview_questions.filter((q) => q.application_id !== id),
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
    interview_questions: data.interview_questions.map((q) =>
      q.covered_by === id ? { ...q, covered_by: null } : q,
    ),
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
// criteria (Phase 4)
// ---------------------------------------------------------------------------

function criteriaFor(data: Dataset, applicationId: string): Criterion[] {
  return data.criteria
    .filter((c) => c.application_id === applicationId)
    .sort((a, b) => a.position - b.position)
}

export function addCriterion(
  data: Dataset,
  applicationId: string,
  text: string,
  essential = true,
): [Dataset, Criterion] {
  const siblings = criteriaFor(data, applicationId)
  const position = siblings.length ? Math.max(...siblings.map((c) => c.position)) + 1 : 0
  const row: Criterion = {
    id: newId(),
    application_id: applicationId,
    text,
    essential,
    covered_by: null,
    position,
  }
  return [{ ...data, criteria: [...data.criteria, row] }, row]
}

/** Append many criteria at once (from the ad splitter), after any existing. */
export function addCriteriaBulk(
  data: Dataset,
  applicationId: string,
  texts: string[],
): Dataset {
  const existing = criteriaFor(data, applicationId)
  const existingText = new Set(existing.map((c) => c.text.toLowerCase()))
  let position = existing.length ? Math.max(...existing.map((c) => c.position)) + 1 : 0
  const rows: Criterion[] = []
  for (const text of texts) {
    const key = text.toLowerCase()
    if (existingText.has(key)) continue
    existingText.add(key) // also dedupe within this batch
    rows.push({
      id: newId(),
      application_id: applicationId,
      text,
      essential: true,
      covered_by: null,
      position: position++,
    })
  }
  return { ...data, criteria: [...data.criteria, ...rows] }
}

export function updateCriterion(
  data: Dataset,
  id: string,
  patch: Partial<Omit<Criterion, 'id' | 'application_id'>>,
): Dataset {
  const existing = data.criteria.find((c) => c.id === id)
  if (!existing) return data
  return { ...data, criteria: replace(data.criteria, { ...existing, ...patch }) }
}

export function deleteCriterion(data: Dataset, id: string): Dataset {
  return { ...data, criteria: data.criteria.filter((c) => c.id !== id) }
}

/** Move a criterion up/down within its application by swapping positions. */
export function moveCriterion(data: Dataset, id: string, dir: -1 | 1): Dataset {
  const target = data.criteria.find((c) => c.id === id)
  if (!target) return data
  const siblings = criteriaFor(data, target.application_id)
  const idx = siblings.findIndex((c) => c.id === id)
  const swapWith = siblings[idx + dir]
  if (!swapWith) return data
  const a = { ...target, position: swapWith.position }
  const b = { ...swapWith, position: target.position }
  return { ...data, criteria: replace(replace(data.criteria, a), b) }
}

// ---------------------------------------------------------------------------
// interview questions (Interview Prep)
// ---------------------------------------------------------------------------

function questionsFor(data: Dataset, applicationId: string): InterviewQuestion[] {
  return data.interview_questions
    .filter((q) => q.application_id === applicationId)
    .sort((a, b) => a.position - b.position)
}

export function addInterviewQuestion(
  data: Dataset,
  applicationId: string,
  text: string,
  coveredBy: string | null = null,
): [Dataset, InterviewQuestion] {
  const siblings = questionsFor(data, applicationId)
  const position = siblings.length ? Math.max(...siblings.map((q) => q.position)) + 1 : 0
  const q: InterviewQuestion = {
    id: newId(),
    application_id: applicationId,
    text,
    covered_by: coveredBy,
    notes: null,
    asked: false,
    position,
  }
  return [{ ...data, interview_questions: [...data.interview_questions, q] }, q]
}

/** Seed prep questions from the application's criteria (each becomes a
 * behavioural-question stub, carrying over the criterion's linked evidence). */
export function addQuestionsFromCriteria(data: Dataset, applicationId: string): Dataset {
  const criteria = data.criteria
    .filter((c) => c.application_id === applicationId)
    .sort((a, b) => a.position - b.position)
  const existing = questionsFor(data, applicationId)
  const existingText = new Set(existing.map((q) => q.text.toLowerCase()))
  let position = existing.length ? Math.max(...existing.map((q) => q.position)) + 1 : 0
  const rows: InterviewQuestion[] = []
  for (const c of criteria) {
    const text = `Tell me about a time you demonstrated: “${c.text}”`
    if (existingText.has(text.toLowerCase())) continue
    existingText.add(text.toLowerCase())
    rows.push({
      id: newId(),
      application_id: applicationId,
      text,
      covered_by: c.covered_by,
      notes: null,
      asked: false,
      position: position++,
    })
  }
  return { ...data, interview_questions: [...data.interview_questions, ...rows] }
}

export function updateInterviewQuestion(
  data: Dataset,
  id: string,
  patch: Partial<Omit<InterviewQuestion, 'id' | 'application_id'>>,
): Dataset {
  const existing = data.interview_questions.find((q) => q.id === id)
  if (!existing) return data
  return { ...data, interview_questions: replace(data.interview_questions, { ...existing, ...patch }) }
}

export function deleteInterviewQuestion(data: Dataset, id: string): Dataset {
  return { ...data, interview_questions: data.interview_questions.filter((q) => q.id !== id) }
}

export function moveInterviewQuestion(data: Dataset, id: string, dir: -1 | 1): Dataset {
  const target = data.interview_questions.find((q) => q.id === id)
  if (!target) return data
  const siblings = questionsFor(data, target.application_id)
  const idx = siblings.findIndex((q) => q.id === id)
  const swapWith = siblings[idx + dir]
  if (!swapWith) return data
  const a = { ...target, position: swapWith.position }
  const b = { ...swapWith, position: target.position }
  return { ...data, interview_questions: replace(replace(data.interview_questions, a), b) }
}
