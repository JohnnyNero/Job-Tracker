import { useEffect, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { Stage } from '../types'
import { STAGE_LABELS, STAGE_TONE } from '../lib/constants'

/** Reactively track a media query — lets a component swap layout (e.g. table vs
 * cards) at a breakpoint without relying on CSS alone. SSR-safe default. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Modal focus management: move focus into the dialog on open, keep Tab inside
 * it, and restore focus to the triggering element on close. */
export function useModalFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = el?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? el)?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !el) return
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const firstN = nodes[0]
      const lastN = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === firstN) {
        e.preventDefault()
        lastN.focus()
      } else if (!e.shiftKey && document.activeElement === lastN) {
        e.preventDefault()
        firstN.focus()
      }
    }
    el?.addEventListener('keydown', onKey)
    return () => {
      el?.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [ref])
}

/** A coloured stage pill. */
export function StagePill({ stage }: { stage: Stage }) {
  return <span className={`pill ${STAGE_TONE[stage]}`}>{STAGE_LABELS[stage]}</span>
}

/** A small circular progress ring with a centred label. */
export function Ring({
  value,
  max,
  size = 46,
  label,
  done,
}: {
  value: number
  max: number
  size?: number
  label?: string
  done?: boolean
}) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const complete = done ?? value >= max
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={complete ? 'var(--pill-green-fg)' : 'var(--accent)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" className="ring-label" dominantBaseline="central" textAnchor="middle">
        {label ?? `${value}/${max}`}
      </text>
    </svg>
  )
}

/** A real empty state: says what to do next, never "No items found". */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Close on Escape — used by dialogs. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** True when focus is in a text field, so global shortcuts should stand down. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
