import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { Application } from '../types'
import { extractKeywords } from '../lib/keywords'

// The editable keyword list for one application. Seeded from the ad at capture,
// but the point is that it's yours to fix: the CV coverage check (in the builder
// and on this page) runs on exactly this list, so pruning noise and adding the
// terms you know matter directly sharpens the match. Chips remove on ×; the
// input adds on Enter; "Suggested from ad" offers what the extractor found and
// you haven't kept yet.
export function KeywordsPanel({ app }: { app: Application }) {
  const store = useStore()
  const [draft, setDraft] = useState('')
  const keywords = app.keywords

  const criteria = useMemo(
    () => store.data.criteria.filter((c) => c.application_id === app.id),
    [store.data.criteria, app.id],
  )

  // Fresh extraction (ad + essential criteria) minus what's already kept.
  const suggestions = useMemo(() => {
    const critText = criteria
      .filter((c) => c.essential)
      .map((c) => c.text)
      .join('\n')
    const have = new Set(keywords.map((k) => k.toLowerCase()))
    return extractKeywords(app.ad_text, critText).filter((k) => !have.has(k.toLowerCase()))
  }, [app.ad_text, criteria, keywords])

  // Commit a new list, de-duping case-insensitively and keeping order.
  function commit(next: string[]) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const k of next) {
      const t = k.trim()
      const key = t.toLowerCase()
      if (!t || seen.has(key)) continue
      seen.add(key)
      out.push(t)
    }
    store.updateApplication(app.id, { keywords: out })
  }

  const add = (k: string) => k.trim() && commit([...keywords, k])
  const remove = (k: string) => commit(keywords.filter((x) => x !== k))
  const addDraft = () => {
    if (draft.trim()) {
      add(draft)
      setDraft('')
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Keywords</h2>
        <span className="spacer" style={{ flex: 1 }} />
        {suggestions.length > 0 && (
          <button
            className="btn small"
            onClick={() => commit([...keywords, ...suggestions])}
            title="Add every keyword the ad suggests"
          >
            Suggest from ad
          </button>
        )}
      </div>
      <p className="section-note" style={{ marginTop: 0, marginBottom: 12 }}>
        The terms a CV screen scans for. Seeded from the ad &mdash; prune the noise and add the ones
        you know matter. CV coverage checks against exactly this list.
      </p>

      {keywords.length === 0 ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          No keywords yet. <strong>Suggest from ad</strong> to seed them, or add your own below.
        </p>
      ) : (
        <div className="kw-chips">
          {keywords.map((k) => (
            <span key={k} className="chip kw-chip">
              {k}
              <button
                className="kw-x"
                onClick={() => remove(k)}
                aria-label={`Remove ${k}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="inline-add">
        <input
          type="text"
          aria-label="New keyword"
          placeholder="Add a keyword…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDraft()}
        />
        <button className="btn" onClick={addDraft}>
          Add
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="kw-suggest">
          <span className="muted">Suggested from ad:</span>
          {suggestions.slice(0, 12).map((s) => (
            <button
              key={s}
              className="chip selectable"
              onClick={() => add(s)}
              title="Add this keyword"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
