import { useEffect } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { Stage } from '../types'
import { STAGE_LABELS, STAGE_TONE } from '../lib/constants'

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
