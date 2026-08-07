import type { Stage, Outcome } from '../types'

/** Human labels for stages. */
export const STAGE_LABELS: Record<Stage, string> = {
  drafting: 'Drafting',
  applied: 'Applied',
  acknowledged: 'Acknowledged',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  final_stage: 'Final stage',
  offer: 'Offer',
  closed: 'Closed',
}

/** Stages considered "live" (still in play). Closed is the only dead one. */
export const LIVE_STAGES: Stage[] = [
  'drafting',
  'applied',
  'acknowledged',
  'shortlisted',
  'interview',
  'final_stage',
  'offer',
]

/** Stages where I'm waiting on them to reply. Drives the "awaiting reply"
 * tally and the "silent" days counter. */
export const AWAITING_STAGES: Stage[] = ['applied', 'acknowledged']

export const OUTCOME_LABELS: Record<Outcome, string> = {
  rejected: 'Rejected',
  withdrew: 'Withdrew',
  no_response: 'No response',
  accepted: 'Accepted',
}

/** Colour key for each stage pill. Values map to CSS classes / tokens, kept
 * here so the palette lives in one place. */
export const STAGE_TONE: Record<Stage, string> = {
  drafting: 'slate',
  applied: 'blue',
  acknowledged: 'blue',
  shortlisted: 'violet',
  interview: 'amber',
  final_stage: 'amber',
  offer: 'green',
  closed: 'grey',
}

/** Common sources — offered as datalist suggestions, not enforced. */
export const SOURCE_SUGGESTIONS = ['Indeed', 'LinkedIn', 'Direct', 'Referral', 'Agency']
