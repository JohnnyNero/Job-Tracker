import type { Application } from '../types'
import { AWAITING_STAGES } from './constants'

/** Whole calendar days between two local-midnight dates (b - a). Uses round,
 * not floor, so a DST transition (a 23h or 25h "day") still counts as one day
 * instead of zero or two. */
function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/** A Date as a LOCAL YYYY-MM-DD. Must not go via toISOString(), which converts
 * to UTC and shifts the calendar day for anyone not on UTC — the stored date
 * would then be read back (as local midnight) a day off. */
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a YYYY-MM-DD (or ISO) string to a Date at local midnight, or null. */
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s)
  return isNaN(d.getTime()) ? null : d
}

/** Midnight of the given day, so day-difference math is exact calendar days
 * regardless of the current time (stored dates are date-only / midnight). */
function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
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
  const t = startOfDay(today)
  if (AWAITING_STAGES.includes(app.stage)) {
    const applied = parseDate(app.applied_on)
    if (!applied) return null
    const days = daysBetween(applied, t)
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
    const days = daysBetween(t, closes)
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

/** Today as a LOCAL YYYY-MM-DD, for date input defaults and stored dates. */
export function todayIsoDate(): string {
  return toLocalIsoDate(new Date())
}

/** A date N calendar days from `from`, as a LOCAL YYYY-MM-DD. */
export function addDaysIso(days: number, from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return toLocalIsoDate(d)
}

/** A date N business days (skipping Sat/Sun) from `from`, as a LOCAL YYYY-MM-DD.
 * Used for the follow-up nudge default. */
export function addBusinessDaysIso(n: number, from = new Date()): string {
  const d = new Date(from)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return toLocalIsoDate(d)
}

/** Whole days elapsed since a date (today - date), or null. */
export function daysSince(s: string | null, today = new Date()): number | null {
  const d = parseDate(s)
  if (!d) return null
  return daysBetween(d, startOfDay(today))
}

/** Whole days until a date (date - today), negative if past, or null. */
export function daysUntil(s: string | null, today = new Date()): number | null {
  const d = parseDate(s)
  if (!d) return null
  return daysBetween(startOfDay(today), d)
}
