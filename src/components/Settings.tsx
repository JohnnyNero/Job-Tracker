import { useEffect, useRef, useState } from 'react'
import { useStore, emptyDataset } from '../store/store'
import { normaliseDataset } from '../store/localStore'
import { sampleDataset } from '../store/sample'
import { routes } from '../router'
import { SyncPanel } from './SyncPanel'

// The clip bookmarklet: runs on any job page and hands the URL + title +
// selection to the #/new capture route. Built against wherever the app is
// actually served so it works on Pages or a custom domain.
const APP_URL = window.location.origin + import.meta.env.BASE_URL
const BOOKMARKLET =
  "javascript:(function(){var b='" +
  APP_URL +
  "';var u=encodeURIComponent(location.href),t=encodeURIComponent(document.title)," +
  "s=encodeURIComponent((''+(window.getSelection?window.getSelection():'')).slice(0,600));" +
  "location.href=b+'#/new?url='+u+'&title='+t+'&text='+s;})();"

export function Settings() {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const bmRef = useRef<HTMLAnchorElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // React strips `javascript:` hrefs, so set the bookmarklet's href on the DOM
  // node directly. It's a drag-to-bookmarks link, never navigated in-app.
  useEffect(() => {
    if (bmRef.current) bmRef.current.setAttribute('href', BOOKMARKLET)
  }, [])

  const counts = {
    applications: store.data.applications.length,
    evidence: store.data.evidence.length,
    profiles: store.data.role_profiles.length,
    cvs: store.data.cv_versions.length,
  }

  function flash(m: string) {
    setMsg(m)
    window.setTimeout(() => setMsg(null), 4000)
  }

  function exportJson() {
    store.exportNow()
    flash('Exported a JSON backup.')
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = normaliseDataset(JSON.parse(String(reader.result)))
        const total =
          data.applications.length + data.evidence.length + data.role_profiles.length
        if (
          confirm(
            `Import ${data.applications.length} applications, ${data.evidence.length} evidence items, ` +
              `${data.role_profiles.length} profiles?\n\nThis REPLACES everything currently in the app.`,
          )
        ) {
          store.replaceAll(data)
          flash(`Imported ${total} records.`)
        }
      } catch {
        alert('That file is not valid Job Tracker JSON.')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // allow re-importing the same file
  }

  function loadSample() {
    if (confirm('Load the sample dataset? This REPLACES everything currently in the app.')) {
      store.replaceAll(sampleDataset())
      flash('Sample data loaded.')
    }
  }

  function reset() {
    if (
      confirm('Delete ALL data and start empty? Export a backup first if you might want it back.')
    ) {
      store.replaceAll(emptyDataset())
      flash('All data cleared.')
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>Settings</h1>
        <span className="saved-flash" aria-live="polite">{msg ?? ''}</span>
      </div>

      <div className="panel">
        <h2>Your data</h2>
        <p className="muted">
          {counts.applications} applications · {counts.evidence} evidence · {counts.profiles}{' '}
          profiles · {counts.cvs} CV versions
        </p>
        <p className="section-note">
          {store.sync.status === 'synced' || store.sync.status === 'syncing'
            ? 'Synced to your account and mirrored here for offline use. An occasional export is still a good idea.'
            : 'Everything lives in this browser’s local storage. Export regularly — it’s your only backup until you turn on sync below, and it means you’re never hostage to a single machine.'}
        </p>
      </div>

      <div className="panel">
        <h2>Export &amp; import</h2>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn primary" onClick={exportJson}>
            Export everything to JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import from JSON…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            style={{ display: 'none' }}
          />
        </div>
        <p className="section-note">
          The export file is the exact shape the app stores and the same shape a future Supabase
          import expects &mdash; so this backup is also your migration path.
        </p>
      </div>

      <div className="panel">
        <h2>Sample &amp; reset</h2>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn" onClick={loadSample}>
            Load sample data
          </button>
          <button className="btn danger" onClick={reset}>
            Clear all data
          </button>
        </div>
        <p className="section-note">
          Both replace whatever is currently loaded. Export first if you care about it.
        </p>
      </div>

      <div className="panel">
        <h2>Finding jobs</h2>
        <p className="section-note" style={{ marginTop: 0 }}>
          Two ways to drop a job you&rsquo;re looking at straight into your pipeline — both open the
          new-application form pre-filled. Looking for where to search? Open{' '}
          <a href={routes.find()}>Find jobs</a>.
        </p>
        <div className="bm-row">
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a ref={bmRef} className="btn primary bm-link" onClick={(e) => e.preventDefault()}>
            📎 Clip to Job Tracker
          </a>
          <span className="muted" style={{ fontSize: 13 }}>
            <strong>Drag this to your bookmarks bar.</strong> Then, on any job listing, click it to
            capture the page — title, link, and any text you&rsquo;ve selected.
          </span>
        </div>
        <p className="section-note" style={{ marginTop: 12 }}>
          <strong>On your phone:</strong> install the app (Add to Home Screen), then use a
          listing&rsquo;s <strong>Share</strong> button and pick <strong>Job Tracker</strong> to send
          it in. (Android; iOS uses the bookmarklet.)
        </p>
      </div>

      <div className="panel">
        <h2>Guidance</h2>
        <label className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span>Weekly application target</span>
          <input
            type="number"
            min={1}
            max={99}
            value={store.prefs.weeklyTarget}
            onChange={(e) => store.setPrefs({ weeklyTarget: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
            style={{ width: 80 }}
            aria-label="Weekly application target"
          />
        </label>
        <p className="section-note" style={{ marginBottom: store.prefs.checklistDismissed ? 12 : 0 }}>
          Drives the &ldquo;applied this week&rdquo; ring on the pipeline. Consistency beats bingeing
          &mdash; a steady weekly number is what keeps a search alive.
        </p>
        {store.prefs.checklistDismissed && (
          <button className="btn small" onClick={() => store.setPrefs({ checklistDismissed: false })}>
            Show the getting-started checklist again
          </button>
        )}
      </div>

      <SyncPanel />
    </div>
  )
}
