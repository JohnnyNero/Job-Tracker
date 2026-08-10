import { useStore } from '../store/store'
import { navigate, routes } from '../router'
import { Ring } from './common'

// A getting-started checklist that routes a new user to first value fast. Each
// step is computed from real data (so it ticks itself as you go) and each action
// is a real button, not a label. Dismissible; auto-hidden once complete + closed.
export function GettingStarted({ onNewApplication }: { onNewApplication: () => void }) {
  const store = useStore()
  const d = store.data
  if (store.prefs.checklistDismissed) return null

  const firstApp = d.applications[0]
  const firstAppWithCriteria = d.applications.find((a) =>
    d.criteria.some((c) => c.application_id === a.id),
  )
  const applied = d.applications.some((a) => a.stage !== 'drafting' || a.applied_on)
  const linked =
    d.application_evidence.length > 0 || d.criteria.some((c) => c.covered_by)

  const steps: { done: boolean; label: string; action: () => void; cta: string }[] = [
    {
      done: d.applications.length > 0,
      label: 'Add your first job',
      cta: 'Add job',
      action: onNewApplication,
    },
    {
      done: d.criteria.length > 0,
      label: 'Break a job into its criteria',
      cta: 'Open job',
      action: () => (firstApp ? navigate(routes.application(firstApp.id)) : onNewApplication()),
    },
    {
      done: d.evidence.length > 0,
      label: 'Build your evidence bank (paste your CV)',
      cta: 'Add evidence',
      action: () => navigate(routes.evidence()),
    },
    {
      done: linked,
      label: 'Link a story to a criterion',
      cta: 'Open job',
      action: () =>
        navigate(
          (firstAppWithCriteria ?? firstApp)
            ? routes.application((firstAppWithCriteria ?? firstApp)!.id)
            : routes.evidence(),
        ),
    },
    {
      done: applied,
      label: 'Mark one as applied',
      cta: 'Open job',
      action: () => (firstApp ? navigate(routes.application(firstApp.id)) : onNewApplication()),
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length

  return (
    <div className="getting-started panel">
      <div className="gs-head">
        <Ring value={doneCount} max={steps.length} done={allDone} />
        <div className="gs-title">
          <h2>{allDone ? 'You’re all set' : 'Get started'}</h2>
          <p className="muted">
            {allDone
              ? 'You’ve got the full loop going — capture, tailor, prep. Nice.'
              : 'Five steps to the full workflow — capture a job, tailor from your evidence, prep.'}
          </p>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <button
          className="btn ghost small"
          onClick={() => store.setPrefs({ checklistDismissed: true })}
        >
          {allDone ? 'Dismiss' : 'Hide'}
        </button>
      </div>

      {!allDone && (
        <ol className="gs-steps">
          {steps.map((s, i) => (
            <li key={i} className={s.done ? 'done' : ''}>
              <span className="gs-check" aria-hidden>
                {s.done ? '✓' : i + 1}
              </span>
              <span className="gs-step-label">{s.label}</span>
              {!s.done && (
                <button className="btn small" onClick={s.action}>
                  {s.cta}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
