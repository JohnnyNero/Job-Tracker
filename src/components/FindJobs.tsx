import { useState } from 'react'
import { useStore } from '../store/store'
import { routes } from '../router'
import { newId } from '../lib/id'
import { BOARDS, boardsFor, searchLabel } from '../lib/boards'
import type { SearchInput } from '../lib/boards'
import type { SavedSearch } from '../store/localStore'

// "Where to look." Build a search from your keywords + location and open it on
// the big boards in one click — no scraping, just smart deep links. Save the
// searches you run often. Everything you find comes back in via the clip
// bookmarklet or the phone share sheet (see Settings).
export function FindJobs() {
  const store = useStore()
  const profiles = store.data.role_profiles
  const capabilities = store.data.capabilities
  const saved = store.prefs.savedSearches

  const [q, setQ] = useState<SearchInput>({ keywords: '', location: '', remote: false })

  const boards = boardsFor(q)
  const canSearch = q.keywords.trim().length > 0

  function appendKeyword(term: string) {
    setQ((cur) => {
      const has = cur.keywords.toLowerCase().split(/\s+/).includes(term.toLowerCase())
      if (has) return cur
      return { ...cur, keywords: (cur.keywords ? cur.keywords + ' ' : '') + term }
    })
  }

  function openAll() {
    for (const b of boards) window.open(b.build(q), '_blank', 'noopener')
  }

  function saveSearch() {
    if (!canSearch) return
    const s: SavedSearch = {
      id: newId(),
      keywords: q.keywords.trim(),
      location: q.location.trim(),
      remote: q.remote,
    }
    store.setPrefs({ savedSearches: [s, ...saved] })
  }

  function removeSaved(id: string) {
    store.setPrefs({ savedSearches: saved.filter((s) => s.id !== id) })
  }

  const quickTerms = Array.from(
    new Set([...profiles.map((p) => p.name), ...capabilities.map((c) => c.name)].filter(Boolean)),
  ).slice(0, 12)

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>Find jobs</h1>
        <span className="sub">Build a search, open it on the big boards, and clip what you like.</span>
      </div>

      <div className="banner">
        This opens searches on job boards in new tabs — it never scrapes them. Found one? Use the{' '}
        <a href={routes.settings()}>clip bookmarklet or phone share</a> to drop it straight into your
        pipeline.
      </div>

      <div className="panel">
        <div className="field-grid">
          <label className="field full">
            <span className="lbl">Keywords</span>
            <input
              type="text"
              value={q.keywords}
              placeholder="Operations manager, duty manager…"
              onChange={(e) => setQ({ ...q, keywords: e.target.value })}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="lbl">Location</span>
            <input
              type="text"
              value={q.location}
              placeholder="Leeds, London, UK…"
              onChange={(e) => setQ({ ...q, location: e.target.value })}
            />
          </label>
          <label className="field row" style={{ gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={q.remote}
              onChange={(e) => setQ({ ...q, remote: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span>Remote</span>
          </label>
        </div>

        {quickTerms.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              From your profiles:
            </span>
            {quickTerms.map((t) => (
              <button key={t} className="chip selectable" onClick={() => appendKeyword(t)}>
                + {t}
              </button>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
          <span className="lbl" style={{ fontSize: 12 }}>
            Open on
          </span>
          {boards.map((b) => (
            <a
              key={b.id}
              className={`btn small ${canSearch ? '' : 'disabled'}`}
              href={canSearch ? b.build(q) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!canSearch}
              onClick={(e) => !canSearch && e.preventDefault()}
            >
              {b.name} ↗
            </a>
          ))}
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn small" onClick={openAll} disabled={!canSearch}>
            Open all
          </button>
          <button className="btn small primary" onClick={saveSearch} disabled={!canSearch}>
            Save search
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Saved searches</h2>
        {saved.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            No saved searches yet. Build one above and <strong>Save search</strong> so you can re-run
            it each week — a steady cadence is what keeps a search alive.
          </p>
        ) : (
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.id} className="saved-row">
                <button className="saved-load" onClick={() => setQ({ keywords: s.keywords, location: s.location, remote: s.remote })} title="Load into the builder">
                  {searchLabel(s)}
                </button>
                <span className="saved-actions">
                  {boardsFor(s).map((b) => (
                    <a key={b.id} className="btn ghost small" href={b.build(s)} target="_blank" rel="noopener noreferrer">
                      {b.name} ↗
                    </a>
                  ))}
                  <button
                    className="btn ghost small"
                    onClick={() => boardsFor(s).forEach((b) => window.open(b.build(s), '_blank', 'noopener'))}
                    title="Open every board for this search"
                  >
                    Open all
                  </button>
                  <button className="btn ghost small" onClick={() => removeSaved(s.id)} aria-label="Delete saved search" title="Delete">
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="section-note">
        Boards covered: {BOARDS.map((b) => b.name).join(', ')}. Missing one you use? It&rsquo;s a
        deep-link template — easy to add.
      </p>
    </div>
  )
}
