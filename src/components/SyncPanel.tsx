import { useState } from 'react'
import { useStore } from '../store/store'
import { fmtDateTime } from '../lib/dates'

// The cloud-sync control in Settings. Three shapes:
//   off        — this build has no Supabase keys; show how to wire it up.
//   signed-out — email field → magic link.
//   signed-in  — status, "Sync now", "Sign out".
// Everything degrades gracefully: with sync off the app is exactly as before.
export function SyncPanel() {
  const store = useStore()
  const { sync } = store
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function send() {
    const addr = email.trim()
    if (!addr) return
    setBusy(true)
    setLocalErr(null)
    try {
      await store.signIn(addr)
      setSent(addr)
    } catch (e) {
      setLocalErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!sync.configured) {
    return (
      <div className="panel">
        <h2>Sync across devices</h2>
        <p className="muted" style={{ marginBottom: 8 }}>
          Cloud sync isn&rsquo;t switched on for this build yet. Once it is, you&rsquo;ll sign in with
          an email magic link and your board follows you between phone and laptop &mdash; automatically
          and in the background.
        </p>
        <p className="section-note" style={{ marginTop: 0 }}>
          To turn it on: create a free Supabase project, run the SQL in{' '}
          <code>supabase/migrations/</code>, add the app&rsquo;s URL to the Auth redirect allowlist,
          then add the two public repo secrets (<code>VITE_SUPABASE_URL</code>,{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>). Full walkthrough in{' '}
          <code>docs/setup-supabase.md</code>. Until then everything stays on this device &mdash;
          export regularly.
        </p>
      </div>
    )
  }

  const signedIn = sync.status !== 'signed-out' && sync.status !== 'off' && !!sync.email

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Sync across devices</h2>
        <span className="spacer" style={{ flex: 1 }} />
        <SyncBadge status={sync.status} />
      </div>

      {!signedIn ? (
        <>
          <p className="section-note" style={{ marginTop: 0 }}>
            Sign in with a magic link &mdash; no password. Use the <strong>same email</strong> on every
            device and they&rsquo;ll share one board.
          </p>
          {sent ? (
            <p className="muted" aria-live="polite">
              ✓ Link sent to <strong>{sent}</strong>. Open it on this device to finish signing in.{' '}
              <button className="btn ghost small" onClick={() => setSent(null)}>
                Use a different email
              </button>
            </p>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input
                type="email"
                className="grow"
                aria-label="Email for sign-in link"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                style={{ minWidth: 220 }}
              />
              <button className="btn primary" onClick={send} disabled={busy || !email.trim()}>
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </div>
          )}
          {localErr && (
            <p className="section-note" style={{ color: 'var(--danger)' }}>
              {localErr}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="section-note" style={{ marginTop: 0 }}>
            Signed in as <strong>{sync.email}</strong>. Changes sync automatically in the background.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {sync.status === 'syncing'
                ? 'Syncing…'
                : sync.status === 'error'
                  ? 'Sync error — will retry on the next change.'
                  : sync.lastSyncedAt
                    ? `Last synced ${fmtDateTime(sync.lastSyncedAt)}`
                    : 'Up to date.'}
            </span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn" onClick={store.syncNow} disabled={sync.status === 'syncing'}>
              Sync now
            </button>
            <button className="btn ghost" onClick={() => void store.signOutCloud()}>
              Sign out
            </button>
          </div>
          {sync.error && (
            <p className="section-note" style={{ color: 'var(--danger)' }}>
              {sync.error}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function SyncBadge({ status }: { status: ReturnType<typeof useStore>['sync']['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    off: { label: 'off', cls: '' },
    'signed-out': { label: 'not signed in', cls: '' },
    syncing: { label: 'syncing…', cls: 'count-1' },
    synced: { label: 'synced', cls: 'on' },
    error: { label: 'error', cls: 'count-0' },
  }
  const s = map[status] ?? map.off
  return <span className={`chip ${s.cls}`}>{s.label}</span>
}
