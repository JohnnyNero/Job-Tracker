// Domain types. These mirror the Postgres schema in
// supabase/migrations/0001_init.sql exactly, so the offline localStorage
// store and a future Supabase store are interchangeable. When you change one,
// change both.

/** Pipeline stages, in order. The order matters: it drives sorting and the
 * "where did it die" analytic. */
export const STAGES = [
  'drafting',
  'applied',
  'acknowledged',
  'shortlisted',
  'interview',
  'final_stage',
  'offer',
  'closed',
] as const
export type Stage = (typeof STAGES)[number]

/** Outcomes — only meaningful once stage === 'closed'. "no_response" is a
 * first-class outcome, not an afterthought. */
export const OUTCOMES = ['rejected', 'withdrew', 'no_response', 'accepted'] as const
export type Outcome = (typeof OUTCOMES)[number]

// stage/note/contact are the timeline kinds; 'told' is an append-only
// commitment log (what you told them); 'draft' snapshots a composed draft.
export type EventKind = 'stage' | 'note' | 'contact' | 'told' | 'draft'

export interface Capability {
  id: string
  name: string
  /** What I mean by it, for my own consistency. */
  note: string | null
}

export interface RoleProfile {
  id: string
  name: string
  /** The two-line pitch for this kind of role. */
  positioning: string | null
  /** Capability names (not ids) that matter for this profile. */
  priority_capabilities: string[]
  /** Terms this sector uses; free-text notes. */
  vocabulary: string | null
  created_at: string
}

export interface Evidence {
  id: string
  title: string
  /** One line, CV length. */
  bullet: string | null
  /** Situation / action / result, answer length. */
  full_text: string | null
  /** Capability names. */
  capabilities: string[]
  /** Free text: "2024", "first year at the cinema". */
  when_happened: string | null
  use_count: number
  last_used_at: string | null
  created_at: string
}

export interface CvVersion {
  id: string
  /** "ops-v3" */
  label: string
  profile_id: string | null
  /** What this version leans into. */
  angle: string | null
  /** Offline: the file name or a link. Online: a Supabase Storage path. */
  file_path: string | null
  is_current: boolean
  created_at: string
}

export interface Application {
  id: string
  role: string
  company: string | null
  profile_id: string | null
  stage: Stage
  /** Set only when stage === 'closed'. */
  outcome: Outcome | null
  /** Which stage it died at; set automatically on close. */
  closed_from_stage: string | null
  /** Indeed, LinkedIn, direct, referral. */
  source: string | null
  link: string | null
  /** Archived at capture; the listing will 404. */
  ad_text: string | null
  location: string | null
  /** Free text; ranges and "competitive" both happen. */
  salary_stated: string | null
  /** ISO date (YYYY-MM-DD) or null. */
  applied_on: string | null
  /** ISO date (YYYY-MM-DD) or null. */
  closes_on: string | null
  /** When this application next needs attention (follow-up nudge / snooze).
   * ISO date (YYYY-MM-DD) or null. Drives the "Needs you" triage queue. */
  next_action_at: string | null
  cv_version_id: string | null
  /** Salary quoted, notice period, anything committed to. */
  told_them: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AppEvent {
  id: string
  application_id: string
  kind: EventKind
  body: string
  occurred_at: string
}

/** Join row: which evidence went into which application. */
export interface ApplicationEvidence {
  application_id: string
  evidence_id: string
}

/** Criteria pulled from the ad (Phase 4). */
export interface Criterion {
  id: string
  application_id: string
  text: string
  essential: boolean
  covered_by: string | null
  position: number
}

/** A likely/actual interview question and the story you'd answer it with. */
export interface InterviewQuestion {
  id: string
  application_id: string
  text: string
  /** Evidence id — the story you'd tell for this question. */
  covered_by: string | null
  /** Your angle / reminders for the answer. */
  notes: string | null
  /** Did it actually come up in the interview? (feedback loop) */
  asked: boolean
  position: number
}

/** The entire dataset — this is exactly what export/import writes and reads. */
export interface Dataset {
  capabilities: Capability[]
  role_profiles: RoleProfile[]
  evidence: Evidence[]
  cv_versions: CvVersion[]
  applications: Application[]
  events: AppEvent[]
  application_evidence: ApplicationEvidence[]
  criteria: Criterion[]
  interview_questions: InterviewQuestion[]
}
