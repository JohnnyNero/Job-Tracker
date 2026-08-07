import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Stage } from '../types'
import { STAGE_LABELS, STAGE_TONE } from '../lib/constants'

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
