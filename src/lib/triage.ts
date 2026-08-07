import type { Application } from '../types'
import { AWAITING_STAGES } from './constants'
import { daysSince, daysUntil } from './dates'

// The "Needs you" triage: turns the passive days-silent signal into an active
// to-do. An application needs attention when its follow-up nudge is due, when
// it's gone silent long enough to chase (or is probably ghosted), or when a
// draft's ad is about to close. A snooze (next_action_at in the future)
// suppresses everything until that date.

export type TriageReason = 'due' | 'ghosted' | 'stale' | 'closing'

export interface TriageItem {
  reason: TriageReason
  /** Days relevant to the reason (silent-for, overdue-by, or until-close). */
  days: number
  label: string
  tone: 'amber' | 'red'
  /** Which action buttons make sense. */
  canFollowUp: boolean
  canGhost: boolean
}

export function triageOf(app: Application, today = new Date()): TriageItem | null {
  if (app.stage === 'closed') return null

  // An explicit next_action_at overrides the heuristics: due today/past = act;
  // future = snoozed, so nothing is needed yet.
  if (app.next_action_at) {
    const until = daysUntil(app.next_action_at, today)
    if (until === null) return null
    if (until > 0) return null // snoozed to the future
    const overdue = -until
    return {
      reason: 'due',
      days: overdue,
      label: overdue === 0 ? 'Follow-up due today' : `Follow-up ${overdue}d overdue`,
      tone: overdue >= 7 ? 'red' : 'amber',
      canFollowUp: true,
      canGhost: AWAITING_STAGES.includes(app.stage),
    }
  }

  // Drafting: only nags when its ad is about to close.
  if (app.stage === 'drafting') {
    if (!app.closes_on) return null
    const until = daysUntil(app.closes_on, today)
    if (until === null || until > 3) return null
    return {
      reason: 'closing',
      days: until,
      label: until < 0 ? `Ad closed ${-until}d ago` : until === 0 ? 'Ad closes today' : `Ad closes in ${until}d`,
      tone: until <= 1 ? 'red' : 'amber',
      canFollowUp: false,
      canGhost: false,
    }
  }

  // Awaiting a reply: chase after ~2 weeks, treat as ghosted after ~a month.
  if (AWAITING_STAGES.includes(app.stage)) {
    const ds = daysSince(app.applied_on, today)
    if (ds === null) return null
    if (ds >= 30)
      return { reason: 'ghosted', days: ds, label: `Silent ${ds}d — likely ghosted`, tone: 'red', canFollowUp: true, canGhost: true }
    if (ds >= 14)
      return { reason: 'stale', days: ds, label: `Silent ${ds}d — time to follow up`, tone: 'amber', canFollowUp: true, canGhost: true }
  }

  return null
}

/** Priority for ordering the queue: most urgent first. */
const ORDER: Record<TriageReason, number> = { ghosted: 0, due: 1, closing: 2, stale: 3 }

export interface TriagedApp {
  app: Application
  item: TriageItem
}

export function buildTriage(apps: Application[], today = new Date()): TriagedApp[] {
  const out: TriagedApp[] = []
  for (const app of apps) {
    const item = triageOf(app, today)
    if (item) out.push({ app, item })
  }
  out.sort((a, b) => {
    const o = ORDER[a.item.reason] - ORDER[b.item.reason]
    if (o !== 0) return o
    return b.item.days - a.item.days // more days = more urgent within a reason
  })
  return out
}
