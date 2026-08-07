# Job Tracker

A private, single-user, desktop-first web app for managing my own job
applications. It keeps the pipeline, the evidence behind each application, and
the CV versions I actually sent — fast to update, so it doesn't go stale.

Built for a wide screen (used with the job ad open in another tab), keyboard-first
where it counts.

## Status

- **Phase 1 (the tracker) is built and runs fully offline** — no backend needed.
  Your data lives in your browser's local storage; export to JSON any time.
- A Supabase (Postgres + auth + storage) backend is written and ready to wire but
  not connected yet. See [`docs/setup-supabase.md`](docs/setup-supabase.md).

See [`docs/roadmap.md`](docs/roadmap.md) for what's built and what's next.

## Quick start

```bash
npm install
npm run dev      # open the printed localhost URL
```

Empty board on first run. Open **Settings → Load sample data** to see it
populated, or press **`n`** to add your first application.

```bash
npm run build    # production build to dist/
npm run preview  # serve that build locally
```

## Using it

- **Pipeline** (home): every application in a sortable table. Change stage inline
  from the row. The "Days" column flags applications that have gone silent (amber
  at 10 days, red at 21) and drafts whose ad closes soon.
- **Application detail**: fields on the left, the pasted job ad on the right to
  read while you work. Everything saves as you go. Closing asks for the outcome —
  including "no response". *Told them* is the field that saves you when someone
  rings six weeks later.
- **Role profiles**: how you frame yourself per kind of role, plus a coverage
  view showing where your evidence is thin.
- **CV locker**: the files you sent, and which applications used each.
- **Settings**: export/import JSON (your backup and your migration path), sample
  data, reset.

Press **`?`** on the pipeline for keyboard shortcuts, or see
[`docs/keyboard-shortcuts.md`](docs/keyboard-shortcuts.md).

## Docs

- [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) ·
  [Decisions](docs/decisions.md) · [Roadmap](docs/roadmap.md) ·
  [Keyboard shortcuts](docs/keyboard-shortcuts.md)
- [Going online with Supabase](docs/setup-supabase.md)
- [`CLAUDE.md`](CLAUDE.md) — working notes for Claude Code / contributors

## Tech

React 18 + Vite + TypeScript, minimal dependencies. Hash-routed SPA deployed to
GitHub Pages via Actions. Offline via `localStorage`; Supabase-ready behind a
single store seam.

## Data & privacy

Single user. Offline, your data never leaves your browser. If you connect
Supabase, every table is protected by Row Level Security scoped to your account,
and only the public URL + anon key ship in the build — never the service-role
key. Export regularly from Settings; it's your backup.
