import { useEffect, useRef, useState } from 'react'

// Save-on-blur inputs. Each keeps a local draft, syncs when the underlying
// value changes externally, and commits only on blur (or Cmd/Ctrl+Enter) when
// the value actually changed. This is the whole editing model for the detail
// screen — no Save button.

function useDraft(value: string) {
  const [draft, setDraft] = useState(value)
  // Keep the draft in sync if the source changes while not focused.
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])
  return { draft, setDraft, focused }
}

/** A brief "just saved" pulse so save-on-blur commits are visible. */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const flash = () => {
    setOn(false)
    requestAnimationFrame(() => setOn(true))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOn(false), 850)
  }
  return [on, flash]
}

interface BaseProps {
  label?: string
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  className?: string
}

export function TextField({ label, value, onCommit, placeholder, className }: BaseProps) {
  const { draft, setDraft, focused } = useDraft(value)
  const [saved, flash] = useFlash()
  const commit = () => {
    focused.current = false
    if (draft !== value) {
      onCommit(draft)
      flash()
    }
  }
  const input = (
    <input
      type="text"
      className={saved ? 'field-saved' : undefined}
      value={draft}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
  return wrap(label, className, input)
}

export function UrlField({ label, value, onCommit, placeholder, className }: BaseProps) {
  const { draft, setDraft, focused } = useDraft(value)
  const [saved, flash] = useFlash()
  const commit = () => {
    focused.current = false
    if (draft !== value) {
      onCommit(draft)
      flash()
    }
  }
  return wrap(
    label,
    className,
    <input
      type="url"
      className={saved ? 'field-saved' : undefined}
      value={draft}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />,
  )
}

export function DateField({ label, value, onCommit, className }: Omit<BaseProps, 'placeholder'>) {
  const { draft, setDraft, focused } = useDraft(value)
  const [saved, flash] = useFlash()
  const commit = () => {
    focused.current = false
    if (draft !== value) {
      onCommit(draft)
      flash()
    }
  }
  return wrap(
    label,
    className,
    <input
      type="date"
      className={saved ? 'field-saved' : undefined}
      value={draft}
      onFocus={() => (focused.current = true)}
      onChange={(e) => {
        setDraft(e.target.value)
      }}
      onBlur={commit}
    />,
  )
}

interface AreaProps extends BaseProps {
  rows?: number
}

export function TextArea({ label, value, onCommit, placeholder, rows = 4, className }: AreaProps) {
  const { draft, setDraft, focused } = useDraft(value)
  const [saved, flash] = useFlash()
  const commit = () => {
    focused.current = false
    if (draft !== value) {
      onCommit(draft)
      flash()
    }
  }
  return wrap(
    label,
    className,
    <textarea
      className={saved ? 'field-saved' : undefined}
      value={draft}
      rows={rows}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur()
      }}
    />,
  )
}

interface SelectProps {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
  allowEmpty?: string // label for the empty option
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
  allowEmpty,
}: SelectProps) {
  return wrap(
    label,
    className,
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>,
  )
}

function wrap(label: string | undefined, className: string | undefined, control: React.ReactNode) {
  if (!label) return <div className={className}>{control}</div>
  return (
    <label className={`field ${className ?? ''}`}>
      <span className="lbl">{label}</span>
      {control}
    </label>
  )
}
