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
  /** The assembled CV document for this version (null until built here). */
  layout: CvLayout | null
  created_at: string
}

// --- CV builder ------------------------------------------------------------

/** "About you" — the stable backbone of every CV. One record for the single
 * user; skills and links are simple lists. */
export interface Person {
  full_name: string
  headline: string | null
  email: string | null
  phone: string | null
  location: string | null
  links: string[]
  /** Default professional summary; a CV version can override it. */
  summary: string | null
  skills: string[]
}

/** A role in your work history (shared across CV versions). Bullets live in each
 * version's layout, so different CVs can emphasise different achievements. */
export interface CvExperience {
  id: string
  company: string
  title: string
  location: string | null
  /** Free-ish "YYYY-MM" or "2021"; rendered as given. */
  start: string | null
  /** null / '' renders as "Present". */
  end: string | null
  position: number
}

export interface CvEducation {
  id: string
  institution: string
  qualification: string | null
  field: string | null
  start: string | null
  end: string | null
  note: string | null
  position: number
}

/** A CV bullet: either a live link to an evidence item (uses its short bullet,
 * so editing the evidence updates every CV) or manual free text. */
export interface CvBullet {
  id: string
  evidence_id: string | null
  text: string | null
}

/** Per-version assembly: which experiences/education to show, the bullets under
 * each experience, an optional summary/skills override. Section order is fixed
 * and ATS-safe (Summary → Experience → Skills → Education). */
export interface CvLayout {
  summary: string | null
  hidden_experience_ids: string[]
  hidden_education_ids: string[]
  /** experience id → ordered bullets. */
  bullets: Record<string, CvBullet[]>
  /** null = use Person.skills. */
  skills: string[] | null
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
  /** Single "about you" record for the CV builder. */
  person: Person
  capabilities: Capability[]
  role_profiles: RoleProfile[]
  evidence: Evidence[]
  cv_versions: CvVersion[]
  cv_experience: CvExperience[]
  cv_education: CvEducation[]
  applications: Application[]
  events: AppEvent[]
  application_evidence: ApplicationEvidence[]
  criteria: Criterion[]
  interview_questions: InterviewQuestion[]
}

/** A fresh, empty "about you" record. */
export function emptyPerson(): Person {
  return {
    full_name: '',
    headline: null,
    email: null,
    phone: null,
    location: null,
    links: [],
    summary: null,
    skills: [],
  }
}
