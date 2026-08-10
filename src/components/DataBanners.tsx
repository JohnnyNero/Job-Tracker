import { useStore } from '../store/store'
import { routes } from '../router'

// App-wide data-safety banners. This is a localStorage-only app, so silent data
// loss is the worst failure — these make the three ways it can happen loud and
// recoverable: an unreadable blob on load, a failed save, and a destructive
// replace. Plus a gentle nudge to keep an off-machine backup.
export function DataBanners() {
  const store = useStore()
  const { saveError, recovered, undoAvailable, daysSinceExport, nudgeBackup } = store.health

  if (!saveError && !recovered && !undoAvailable && !nudgeBackup) return null

  return (
    <div className="data-banners" role="region" aria-label="Data status">
      {recovered && (
        <div className="databanner danger" role="alert">
          <span className="databanner-text">
            <strong>Couldn&rsquo;t read your saved data.</strong> A raw copy was kept so nothing is
            lost — download it, then re-import from a good backup.
          </span>
          <span className="databanner-actions">
            <button className="btn small" onClick={store.downloadCorruptBackup}>
              Download raw copy
            </button>
            <button className="btn small ghost" onClick={store.dismissRecovered}>
              Dismiss
            </button>
          </span>
        </div>
      )}

      {saveError && (
        <div className="databanner danger" role="alert">
          <span className="databanner-text">
            <strong>Your changes aren&rsquo;t being saved.</strong> This browser&rsquo;s storage is
            full or blocked. Export a backup now so you don&rsquo;t lose recent edits.
          </span>
          <span className="databanner-actions">
            <button className="btn small" onClick={store.exportNow}>
              Export backup
            </button>
          </span>
        </div>
      )}

      {undoAvailable && (
        <div className="databanner" role="status">
          <span className="databanner-text">Your data was just replaced.</span>
          <span className="databanner-actions">
            <button className="btn small" onClick={store.restoreUndo}>
              Undo
            </button>
            <button className="btn small ghost" onClick={store.keepCurrent}>
              Keep
            </button>
          </span>
        </div>
      )}

      {nudgeBackup && (
        <div className="databanner" role="status">
          <span className="databanner-text">
            {daysSinceExport == null
              ? 'You haven’t backed up yet.'
              : `No backup in ${daysSinceExport} day${daysSinceExport === 1 ? '' : 's'}.`}{' '}
            Everything lives only in this browser.
          </span>
          <span className="databanner-actions">
            <button className="btn small" onClick={store.exportNow}>
              Export backup
            </button>
            <a className="btn small ghost" href={routes.settings()} onClick={store.dismissBackupNudge}>
              Settings
            </a>
            <button className="btn small ghost" onClick={store.dismissBackupNudge}>
              Later
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
