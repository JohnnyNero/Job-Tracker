import type { Application } from '../types'
import { AWAITING_STAGES } from './constants'

/** Whole days between two dates (b - a), floored. */
function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/** Parse a YYYY-MM-DD (or ISO) string to a Date at local midnight, or null. */
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s)
  return isNaN(d.getTime()) ? null : d
}

export type DaysTone = 'neutral' | 'amber' | 'red'

export interface DaysSignal {
  /** Number to show. */
  value: number
  /** Short label: "silent" or "closes". */
  label: string
  tone: DaysTone
  /** Full text for a tooltip / screen readers. */
  title: string
}

/**
 * The days column carries the pipeline's signal. Rules from the spec:
 *  - applied/acknowledged  -> days since applied_on, "silent".
 *                             neutral <10, amber 10-20, red 21+.
 *  - drafting w/ closes_on -> days until it closes, amber inside 3 days.
 *  - otherwise             -> null (blank cell).
 */
export function daysSignal(app: Application, today = new Date()): DaysSignal | null {
  if (AWAITING_STAGES.includes(app.stage)) {
    const applied = parseDate(app.applied_on)
    if (!applied) return null
    const days = daysBetween(applied, today)
    const tone: DaysTone = days >= 21 ? 'red' : days >= 10 ? 'amber' : 'neutral'
    return {
      value: days,
      label: 'silent',
      tone,
      title: `${days} day${days === 1 ? '' : 's'} since applied with no reply`,
    }
  }

  if (app.stage === 'drafting' && app.closes_on) {
    const closes = parseDate(app.closes_on)
    if (!closes) return null
    const days = daysBetween(today, closes)
    // Past the deadline reads as urgent too.
    const tone: DaysTone = days <= 3 ? 'amber' : 'neutral'
    return {
      value: days,
      label: 'closes',
      tone,
      title:
        days < 0
          ? `Closed ${-days} day${days === -1 ? '' : 's'} ago`
          : `${days} day${days === 1 ? '' : 's'} until the ad closes`,
    }
  }

  return null
}

/** Format an ISO timestamp as a short, readable date. */
export function fmtDate(s: string | null): string {
  const d = parseDate(s)
  if (!d) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format an ISO timestamp as date + time (for the timeline). */
export function fmtDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Today as YYYY-MM-DD, for date input defaults. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
