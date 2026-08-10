import type { Dataset, Application } from '../types'
import { LIVE_STAGES } from './constants'

// Proactive guidance for the pipeline home: a weekly-activity gauge and a short
// list of "move things forward" suggestions. All derived from data already in
// the store — no new entities, no network.

/** Monday (local) of the week containing `today`. */
export function startOfWeek(today = new Date()): Date {
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dow)
  return d
}

/** Applications whose applied_on falls in the current week — "applied this week". */
export function appliedThisWeek(apps: Application[], today = new Date()): number {
  const from = startOfWeek(today).getTime()
  let n = 0
  for (const a of apps) {
    if (!a.applied_on) continue
    const t = new Date(a.applied_on + 'T00:00:00').getTime()
    if (!isNaN(t) && t >= from) n++
  }
  return n
}

export const THIN_PIPELINE = 5

export interface WeekProgress {
  applied: number
  target: number
  live: number
  thin: boolean
}

export function weekProgress(data: Dataset, target: number, today = new Date()): WeekProgress {
  const live = data.applications.filter((a) => LIVE_STAGES.includes(a.stage)).length
  return {
    applied: appliedThisWeek(data.applications, today),
    target: Math.max(1, target),
    live,
    thin: live < THIN_PIPELINE,
  }
}

export type GuidanceKind = 'prep' | 'criteria' | 'thin'

export interface GuidanceItem {
  kind: GuidanceKind
  appId?: string
  role?: string
  company?: string | null
  count?: number
}

const PREP_STAGES = ['interview', 'final_stage']

/** Forward-motion suggestions: interviews to prep for, applications with
 * uncovered essential criteria, and a thin-pipeline nudge. Capped so it guides
 * rather than overwhelms. */
export function buildGuidance(data: Dataset, today = new Date()): GuidanceItem[] {
  const out: GuidanceItem[] = []

  // Interviews to prepare for (most time-sensitive).
  const prep = data.applications.filter((a) => PREP_STAGES.includes(a.stage))
  for (const a of prep.slice(0, 3)) {
    out.push({ kind: 'prep', appId: a.id, role: a.role, company: a.company })
  }

  // Live applications with essential criteria that have no evidence linked.
  const byApp = new Map<string, number>()
  for (const c of data.criteria) {
    if (c.essential && !c.covered_by) byApp.set(c.application_id, (byApp.get(c.application_id) ?? 0) + 1)
  }
  const withGaps = data.applications
    .filter((a) => LIVE_STAGES.includes(a.stage) && (byApp.get(a.id) ?? 0) > 0)
    .slice(0, 3)
  for (const a of withGaps) {
    out.push({ kind: 'criteria', appId: a.id, role: a.role, company: a.company, count: byApp.get(a.id) })
  }

  // Thin pipeline — keep enough in flight that no single rejection stings.
  const { thin, live } = weekProgress(data, 1, today)
  if (thin) out.push({ kind: 'thin', count: live })

  return out
}
