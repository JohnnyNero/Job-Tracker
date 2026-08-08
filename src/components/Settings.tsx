import { useRef, useState } from 'react'
import { useStore, emptyDataset } from '../store/store'
import { serialiseDataset, normaliseDataset } from '../store/localStore'
import { sampleDataset } from '../store/sample'

export function Settings() {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
    const blob = new Blob([serialiseDataset(store.data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
          Everything lives in this browser&rsquo;s local storage right now. Export regularly &mdash;
          it&rsquo;s your only backup until Supabase is connected, and it means you&rsquo;re never
          hostage to a single machine.
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
        <h2>Going online with Supabase</h2>
        <p className="muted" style={{ marginBottom: 8 }}>
          The app runs fully offline today. When you&rsquo;re ready to sync across devices and back
          up to Postgres, follow <code>docs/setup-supabase.md</code>: create a project, run the SQL
          in <code>supabase/migrations/</code>, verify RLS with a signed-out client, then add the
          two repo secrets. Your exported JSON seeds the new database.
        </p>
        <p className="section-note">
          Only the public URL and anon key ever ship in the build. The service-role key never goes
          in this repo or in CI.
        </p>
      </div>
    </div>
  )
}
