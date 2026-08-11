import type { Dataset, Application, Evidence } from '../types'

// Merge two datasets into one, deterministically, so a phone and a laptop that
// each synced independently converge on the same board. The guiding rule is
// "never drop a row that exists on only one side" — a union by id — because the
// failure the user actually hits is *an add on one device missing on the other*.
//
// When the SAME id exists on both sides (a genuine edit conflict), we keep the
// newer row where the table carries an edit timestamp (applications.updated_at),
// and otherwise fall back to the remote copy so the result is deterministic (the
// same regardless of which device runs the merge). That can lose a same-row edit
// made offline on two devices at once — rare for one person — and the store
// still snapshots for undo before adopting a merge, so it's reversible.

function mergeById<T extends { id: string }>(local: T[], remote: T[], tsOf: (r: T) => string): T[] {
  const byId = new Map<string, T>()
  for (const r of remote) byId.set(r.id, r) // remote first (deterministic base)
  for (const l of local) {
    const r = byId.get(l.id)
    if (!r) {
      byId.set(l.id, l) // local-only row — always kept
    } else if (tsOf(l) > tsOf(r)) {
      byId.set(l.id, l) // local edit is strictly newer
    }
    // else keep remote (newer, or tie with no timestamp)
  }
  return [...byId.values()]
}

const appTs = (a: Application) => a.updated_at ?? ''
const evTs = (e: Evidence) => e.last_used_at ?? e.created_at ?? ''
const createdTs = (r: { created_at?: string }) => r.created_at ?? ''
const occurredTs = (r: { occurred_at?: string }) => r.occurred_at ?? ''
const none = () => ''

export function mergeDatasets(local: Dataset, remote: Dataset): Dataset {
  // person is a singleton with no timestamp: prefer whichever side is filled in,
  // remote winning when both are, so the merge is deterministic.
  const person =
    remote.person && remote.person.full_name.trim()
      ? remote.person
      : local.person && local.person.full_name.trim()
        ? local.person
        : remote.person ?? local.person

  // application_evidence is a composite-key join with no id — union by the pair.
  const linkKey = (x: { application_id: string; evidence_id: string }) =>
    x.application_id + '|' + x.evidence_id
  const links = new Map<string, Dataset['application_evidence'][number]>()
  for (const r of remote.application_evidence) links.set(linkKey(r), r)
  for (const l of local.application_evidence) if (!links.has(linkKey(l))) links.set(linkKey(l), l)

  return {
    person,
    capabilities: mergeById(local.capabilities, remote.capabilities, none),
    role_profiles: mergeById(local.role_profiles, remote.role_profiles, createdTs),
    evidence: mergeById(local.evidence, remote.evidence, evTs),
    cv_versions: mergeById(local.cv_versions, remote.cv_versions, createdTs),
    cv_experience: mergeById(local.cv_experience, remote.cv_experience, none),
    cv_education: mergeById(local.cv_education, remote.cv_education, none),
    applications: mergeById(local.applications, remote.applications, appTs),
    events: mergeById(local.events, remote.events, occurredTs),
    application_evidence: [...links.values()],
    criteria: mergeById(local.criteria, remote.criteria, none),
    interview_questions: mergeById(local.interview_questions, remote.interview_questions, none),
  }
}
