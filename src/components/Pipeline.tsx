import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { Application, Stage } from '../types'
import { STAGES } from '../types'
import { STAGE_LABELS, STAGE_TONE, LIVE_STAGES, AWAITING_STAGES } from '../lib/constants'
import { daysSignal, fmtDate } from '../lib/dates'
import { buildTriage } from '../lib/triage'
import type { TriagedApp } from '../lib/triage'
import { navigate, routes } from '../router'
import { EmptyState, isTypingTarget, Ring, useEscape, useMediaQuery, useModalFocus } from './common'
import { NewApplicationDialog } from './NewApplicationDialog'
import { CloseDialog } from './CloseDialog'
import { GettingStarted } from './GettingStarted'
import { buildGuidance, weekProgress } from '../lib/coach'
import type { GuidanceItem } from '../lib/coach'

type Filter = 'live' | 'all' | Stage
type SortKey =
  | 'role'
  | 'company'
  | 'profile'
  | 'stage'
  | 'applied_on'
  | 'closes_on'
  | 'cv'
  | 'source'
  | 'days'

const COLUMNS: { key: SortKey; label: string; tip?: string }[] = [
  { key: 'role', label: 'Role' },
  { key: 'company', label: 'Company' },
  { key: 'profile', label: 'Role profile' },
  { key: 'stage', label: 'Stage' },
  { key: 'applied_on', label: 'Applied' },
  { key: 'closes_on', label: 'Closes' },
  { key: 'cv', label: 'CV sent' },
  { key: 'source', label: 'Source' },
  {
    key: 'days',
    label: 'Days',
    tip: 'Applied/Acknowledged: days silent (amber 10–20, red 21+). Drafting: days until the ad closes.',
  },
]

/** Rough urgency for the days column sort: silent longer = higher, closing
 * sooner = higher, no signal = null (sorts last). */
function urgency(app: Application): number | null {
  const sig = daysSignal(app)
  if (!sig) return null
  return sig.label === 'silent' ? sig.value : 1000 - sig.value
}

export function Pipeline() {
  const store = useStore()
  const apps = store.data.applications

  const [filter, setFilter] = useState<Filter>('live')
  const [profileFilter, setProfileFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('days')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState(0)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [showNew, setShowNew] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTableSectionElement>(null)

  const profileName = useMemo(() => {
    const map = new Map(store.data.role_profiles.map((p) => [p.id, p.name]))
    return (id: string | null) => (id ? map.get(id) ?? '' : '')
  }, [store.data.role_profiles])

  const cvLabel = useMemo(() => {
    const map = new Map(store.data.cv_versions.map((c) => [c.id, c.label]))
    return (id: string | null) => (id ? map.get(id) ?? '' : '')
  }, [store.data.cv_versions])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const dir = sortDir === 'asc' ? 1 : -1

    const filtered = apps.filter((a) => {
      if (filter === 'live' && a.stage === 'closed') return false
      if (filter !== 'live' && filter !== 'all' && a.stage !== filter) return false
      if (profileFilter && a.profile_id !== profileFilter) return false
      if (q) {
        const hay = `${a.role} ${a.company ?? ''} ${a.location ?? ''} ${a.notes ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const cmpNum = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0
      if (a === null) return 1 // empties last, regardless of direction
      if (b === null) return -1
      return (a - b) * dir
    }
    const cmpStr = (a: string, b: string) => {
      if (!a && !b) return 0
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b) * dir
    }
    const ts = (d: string | null) => (d ? new Date(d).getTime() : null)

    const compare = (a: Application, b: Application): number => {
      switch (sortKey) {
        case 'role':
          return cmpStr(a.role.toLowerCase(), b.role.toLowerCase())
        case 'company':
          return cmpStr((a.company ?? '').toLowerCase(), (b.company ?? '').toLowerCase())
        case 'profile':
          return cmpStr(profileName(a.profile_id).toLowerCase(), profileName(b.profile_id).toLowerCase())
        case 'stage':
          return (STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)) * dir
        case 'applied_on':
          return cmpNum(ts(a.applied_on), ts(b.applied_on))
        case 'closes_on':
          return cmpNum(ts(a.closes_on), ts(b.closes_on))
        case 'cv':
          return cmpStr(cvLabel(a.cv_version_id).toLowerCase(), cvLabel(b.cv_version_id).toLowerCase())
        case 'source':
          return cmpStr((a.source ?? '').toLowerCase(), (b.source ?? '').toLowerCase())
        case 'days':
          return cmpNum(urgency(a), urgency(b))
      }
    }

    return [...filtered].sort((a, b) => {
      // Closed always sinks to the bottom, whatever the sort.
      const ac = a.stage === 'closed' ? 1 : 0
      const bc = b.stage === 'closed' ? 1 : 0
      if (ac !== bc) return ac - bc
      return compare(a, b)
    })
  }, [apps, filter, profileFilter, search, sortKey, sortDir, profileName, cvLabel])

  // keep selection in range as the list changes
  useEffect(() => {
    setSelected((s) => Math.max(0, Math.min(s, rows.length - 1)))
  }, [rows.length])

  // scroll the selected row into view — but not on first mount, so opening the
  // pipeline never yanks the page around.
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    const el = bodyRef.current?.querySelector<HTMLElement>(`tr[data-i="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const dialogOpen = showNew || showHelp || closingId !== null

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen) return
      if (isTypingTarget(e.target)) {
        // Only "/" while typing is ignored; let everything else through.
        return
      }
      switch (e.key) {
        case '/':
          e.preventDefault()
          searchRef.current?.focus()
          break
        case 'n':
          e.preventDefault()
          setShowNew(true)
          break
        case '?':
          e.preventDefault()
          setShowHelp(true)
          break
        case 'j':
          e.preventDefault()
          setSelected((s) => Math.min(rows.length - 1, s + 1))
          break
        case 'k':
          e.preventDefault()
          setSelected((s) => Math.max(0, s - 1))
          break
        case 'Enter': {
          const app = rows[selected]
          if (app) navigate(routes.application(app.id))
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selected, dialogOpen])

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'role' || key === 'company' ? 'asc' : 'desc')
    }
  }

  function onStageChange(app: Application, next: Stage) {
    if (next === 'closed') {
      setClosingId(app.id)
    } else {
      store.changeStage(app.id, next)
    }
  }

  // header tally
  const liveCount = apps.filter((a) => LIVE_STAGES.includes(a.stage)).length
  const awaitingCount = apps.filter((a) => AWAITING_STAGES.includes(a.stage)).length
  const evidenceCount = store.data.evidence.length
  const triage = useMemo(() => buildTriage(apps), [apps])
  const guidance = useMemo(() => buildGuidance(store.data), [store.data])
  const week = weekProgress(store.data, store.prefs.weeklyTarget)

  const isEmpty = apps.length === 0
  // The checklist supersedes the classic empty state while onboarding.
  const showChecklist = !store.prefs.checklistDismissed

  return (
    <div className="page">
      <div className="page-head">
        <h1>Pipeline</h1>
        <span className="sub">Your applications, most urgent first.</span>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => setShowNew(true)}>
          + New application <span className="muted" style={{ opacity: 0.8 }}>n</span>
        </button>
      </div>

      {showChecklist && <GettingStarted onNewApplication={() => setShowNew(true)} />}

      {!isEmpty && (
        <div className="tally">
          <div className="stat stat-ring" data-tip="Applications you marked applied this week, against your weekly target (change it in Settings).">
            <Ring value={week.applied} max={week.target} label={`${week.applied}/${week.target}`} />
            <span className="l">applied this week</span>
          </div>
          <div className="stat" data-tip="Applications that need action today: follow-ups due, gone silent, or a draft closing soon.">
            <span className="n" style={triage.length ? { color: 'var(--tone-red-fg)' } : undefined}>
              {triage.length}
            </span>
            <span className="l">need you</span>
          </div>
          <div className="stat" data-tip="Applications still in play. Keeping ~8–12 in flight means no single rejection stings.">
            <span className="n" style={week.thin ? { color: 'var(--tone-amber-fg)' } : undefined}>
              {liveCount}
            </span>
            <span className="l">live{week.thin ? ' · thin' : ''}</span>
          </div>
          <div className="stat" data-tip="Applied or Acknowledged and waiting on them to reply.">
            <span className="n">{awaitingCount}</span>
            <span className="l">awaiting reply</span>
          </div>
          <div className="stat" data-tip="Reusable stories in your evidence bank.">
            <span className="n">{evidenceCount}</span>
            <span className="l">evidence in bank</span>
          </div>
        </div>
      )}

      {!isEmpty && <TriagePanel items={triage} />}
      {!isEmpty && guidance.length > 0 && (
        <GuidancePanel items={guidance} onNew={() => setShowNew(true)} />
      )}

      {isEmpty ? (
        showChecklist ? null : (
          <EmptyState
            title="No applications yet"
            action={
              <button className="btn primary" onClick={() => setShowNew(true)}>
                Add your first application
              </button>
            }
          >
            Track a job the moment you spot it &mdash; paste the ad text before the link dies.
            Press <kbd>n</kbd> any time to add one. To try the app with example data first,
            open <a href={routes.settings()}>Settings</a> and load the sample. New here? Read the{' '}
            <a href={routes.guide()}>Guide</a>.
          </EmptyState>
        )
      ) : (
        <>
          <div className="filters">
            <div className="seg">
              <button className={filter === 'live' ? 'on' : ''} onClick={() => setFilter('live')}>
                Live
              </button>
              <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                All
              </button>
              {STAGES.map((s) => (
                <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>

            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              style={{ width: 'auto' }}
              aria-label="Filter by role profile"
            >
              <option value="">All profiles</option>
              {store.data.role_profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <span className="spacer" style={{ flex: 1 }} />

            <div className="search-box">
              <input
                ref={searchRef}
                type="search"
                placeholder="Search role, company, notes…  ( / )"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('')
                    e.currentTarget.blur()
                  }
                }}
              />
            </div>

            {/* Mobile has no sortable column headers, so surface sort here. */}
            <label className="mobile-sort">
              <span className="lbl">Sort</span>
              <select
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(':') as [SortKey, 'asc' | 'desc']
                  setSortKey(k)
                  setSortDir(d)
                }}
                aria-label="Sort applications"
              >
                <option value="days:desc">Most urgent</option>
                <option value="applied_on:desc">Recently applied</option>
                <option value="closes_on:asc">Closing soonest</option>
                <option value="role:asc">Role A–Z</option>
                <option value="company:asc">Company A–Z</option>
                <option value="stage:desc">Stage</option>
              </select>
            </label>
          </div>

          {isMobile ? (
            <div className="pl-cards">
              {rows.length === 0 ? (
                <div className="empty" style={{ padding: '28px 20px' }}>
                  Nothing matches this filter.{' '}
                  <button
                    className="btn small"
                    onClick={() => {
                      setFilter('all')
                      setProfileFilter('')
                      setSearch('')
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                rows.map((app) => (
                  <PipelineCard
                    key={app.id}
                    app={app}
                    profileName={profileName(app.profile_id)}
                    onOpen={() => navigate(routes.application(app.id))}
                    onStageChange={(s) => onStageChange(app, s)}
                  />
                ))
              )}
            </div>
          ) : (
          <div className="table-wrap">
            <table className="pipeline">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="th-sort" onClick={() => onHeaderClick(c.key)} title={c.tip}>
                        {c.label}
                        {sortKey === c.key && <span className="arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                      Nothing matches this filter. Try <button className="btn small" onClick={() => { setFilter('all'); setProfileFilter(''); setSearch('') }}>clear filters</button>.
                    </td>
                  </tr>
                ) : (
                  rows.map((app, i) => (
                    <PipelineRow
                      key={app.id}
                      app={app}
                      index={i}
                      selected={i === selected}
                      profileName={profileName(app.profile_id)}
                      cvLabel={cvLabel(app.cv_version_id)}
                      onOpen={() => navigate(routes.application(app.id))}
                      onSelect={() => setSelected(i)}
                      onStageChange={(s) => onStageChange(app, s)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {showNew && <NewApplicationDialog onClose={() => setShowNew(false)} />}
      {closingId && (
        <CloseDialog
          app={apps.find((a) => a.id === closingId)!}
          onClose={() => setClosingId(null)}
        />
      )}
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function TriagePanel({ items }: { items: TriagedApp[] }) {
  const store = useStore()
  if (items.length === 0) {
    return <div className="triage caught-up">✓ All caught up — nothing to chase today.</div>
  }
  return (
    <div className="triage">
      <div className="triage-head">
        <h2>Needs you</h2>
        <span className="count">{items.length}</span>
        <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
          — chase, snooze, or close. Follow-up nudges fire ~1 week after you apply.
        </span>
      </div>
      <ul>
        {items.map(({ app, item }) => (
          <li key={app.id} className="triage-row">
            <span className={`t-flag ${item.tone}`}>{item.label}</span>
            <button className="t-open" onClick={() => navigate(routes.application(app.id))}>
              <b>{app.role}</b>
              {app.company ? ` · ${app.company}` : ''}
            </button>
            <span className="t-actions">
              {item.canFollowUp && (
                <button className="btn small" onClick={() => store.logFollowUp(app.id)} title="Logs a contact and snoozes ~1 week">
                  Log follow-up
                </button>
              )}
              <button className="btn small" onClick={() => store.snoozeApplication(app.id, 7)}>
                Snooze 1wk
              </button>
              {item.canGhost && (
                <button className="btn small danger" onClick={() => store.closeApplication(app.id, 'no_response')}>
                  Mark ghosted
                </button>
              )}
              {item.reason === 'closing' && (
                <button className="btn small primary" onClick={() => navigate(routes.application(app.id))}>
                  Finish
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Proactive "raise your odds" suggestions, distinct from the chase-oriented
 * triage queue: interviews to prep, applications with uncovered criteria, and a
 * thin-pipeline nudge. */
function GuidancePanel({ items, onNew }: { items: GuidanceItem[]; onNew: () => void }) {
  return (
    <div className="triage guidance">
      <div className="triage-head">
        <h2>Move things forward</h2>
        <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
          — proactive steps that raise your odds, not just chase what&rsquo;s stale.
        </span>
      </div>
      <ul>
        {items.map((it, i) => (
          <GuidanceRow key={i} it={it} onNew={onNew} />
        ))}
      </ul>
    </div>
  )
}

function GuidanceRow({ it, onNew }: { it: GuidanceItem; onNew: () => void }) {
  const who = `${it.role ?? ''}${it.company ? ` · ${it.company}` : ''}`
  if (it.kind === 'prep') {
    return (
      <li className="triage-row">
        <span className="t-flag info">Interview</span>
        <button className="t-open" onClick={() => navigate(routes.prep(it.appId!))}>
          <b>Prep your stories</b> · {who}
        </button>
        <span className="t-actions">
          <button className="btn small primary" onClick={() => navigate(routes.prep(it.appId!))}>
            Prep…
          </button>
        </span>
      </li>
    )
  }
  if (it.kind === 'criteria') {
    return (
      <li className="triage-row">
        <span className="t-flag info">Coverage</span>
        <button className="t-open" onClick={() => navigate(routes.application(it.appId!))}>
          <b>
            {it.count} essential criteri{it.count === 1 ? 'on' : 'a'} with no story
          </b>{' '}
          · {who}
        </button>
        <span className="t-actions">
          <button className="btn small" onClick={() => navigate(routes.application(it.appId!))}>
            Open
          </button>
        </span>
      </li>
    )
  }
  return (
    <li className="triage-row">
      <span className="t-flag info">Pipeline</span>
      <span className="t-open" style={{ cursor: 'default' }}>
        <b>
          Only {it.count} live application{it.count === 1 ? '' : 's'}
        </b>{' '}
        · keep a few more in flight so momentum holds.
      </span>
      <span className="t-actions">
        <button className="btn small primary" onClick={onNew}>
          + New
        </button>
      </span>
    </li>
  )
}

function PipelineRow({
  app,
  index,
  selected,
  profileName,
  cvLabel,
  onOpen,
  onSelect,
  onStageChange,
}: {
  app: Application
  index: number
  selected: boolean
  profileName: string
  cvLabel: string
  onOpen: () => void
  onSelect: () => void
  onStageChange: (s: Stage) => void
}) {
  const sig = daysSignal(app)
  const tone = STAGE_TONE[app.stage]
  return (
    <tr
      data-i={index}
      className={`${selected ? 'selected' : ''} ${app.stage === 'closed' ? 'closed' : ''}`}
      onClick={() => {
        onSelect()
        onOpen()
      }}
    >
      <td className="role-cell">{app.role}</td>
      <td className="company-cell">{app.company || <span className="muted">—</span>}</td>
      <td>{profileName || <span className="muted">—</span>}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <select
          className="stage-select"
          style={{ color: `var(--pill-${tone}-fg)` }}
          value={app.stage}
          onChange={(e) => onStageChange(e.target.value as Stage)}
          title="Change stage"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td>{app.applied_on ? fmtDate(app.applied_on) : <span className="muted">—</span>}</td>
      <td>{app.closes_on ? fmtDate(app.closes_on) : <span className="muted">—</span>}</td>
      <td>{cvLabel || <span className="muted">—</span>}</td>
      <td>{app.source || <span className="muted">—</span>}</td>
      <td>
        {sig ? (
          <span className={`days ${sig.tone}`} title={sig.title} aria-label={sig.title}>
            {sig.value}
            <span className="lbl">{sig.label}</span>
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  )
}

/** Phone-friendly card for one application: role/company, a stage picker, the
 * days signal, and profile — tap anywhere else to open. Replaces the cramped
 * table row on narrow screens. */
function PipelineCard({
  app,
  profileName,
  onOpen,
  onStageChange,
}: {
  app: Application
  profileName: string
  onOpen: () => void
  onStageChange: (s: Stage) => void
}) {
  const sig = daysSignal(app)
  const tone = STAGE_TONE[app.stage]
  return (
    <div
      className={`pl-card ${app.stage === 'closed' ? 'closed' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="pl-card-top">
        <div className="pl-card-title">
          <span className="pl-card-role">{app.role}</span>
          {app.company && <span className="pl-card-company">{app.company}</span>}
        </div>
        {sig ? (
          <span className={`days ${sig.tone}`} title={sig.title} aria-label={sig.title}>
            {sig.value}
            <span className="lbl">{sig.label}</span>
          </span>
        ) : (
          <span className="muted" aria-hidden>
            —
          </span>
        )}
      </div>
      <div className="pl-card-bottom" onClick={(e) => e.stopPropagation()}>
        <select
          className="stage-select"
          style={{ color: `var(--pill-${tone}-fg)` }}
          value={app.stage}
          onChange={(e) => onStageChange(e.target.value as Stage)}
          aria-label={`Stage for ${app.role}`}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        {profileName && <span className="pl-card-profile">{profileName}</span>}
      </div>
    </div>
  )
}

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEscape(onClose)
  useModalFocus(ref)
  const rows: [string, string][] = [
    ['/', 'Focus search'],
    ['n', 'New application'],
    ['j / k', 'Move row selection down / up'],
    ['Enter', 'Open the selected application'],
    ['Esc', 'Close any panel or dialog'],
    ['Cmd/Ctrl + Enter', 'Save current field and close (in detail)'],
    ['?', 'Show this help'],
  ]
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" ref={ref} tabIndex={-1}>
        <h2>Keyboard shortcuts</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <tbody>
            {rows.map(([k, d]) => (
              <tr key={k}>
                <td style={{ padding: '6px 0', width: 160 }}>
                  <kbd>{k}</kbd>
                </td>
                <td style={{ padding: '6px 0', color: 'var(--text-2)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
