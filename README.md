# Job Tracker

A private, single-user, desktop-first web app for managing my own job
applications. It keeps the pipeline, the evidence behind each application, and
the CV versions I actually sent — fast to update, so it doesn't go stale.

Built for a wide screen (used with the job ad open in another tab), keyboard-first
where it counts.

## Status

- **The tracker runs fully offline** — no backend needed. Your data lives in your
  browser's local storage; export to JSON any time.
- **Online mode (Supabase) is live.** When the two public env vars are set at
  build time, the app boots into online mode: magic-link sign-in, data synced to
  Postgres, Row Level Security scoped to your account. Otherwise it stays on
  localStorage. The backend is chosen at runtime — offline dev is unchanged.
  See [`docs/setup-supabase.md`](docs/setup-supabase.md).
- **Accountability groups (online only).** Create or join a group by invite code
  and see each member's progress card (applied this week, active, overdue
  follow-ups, interviews, offers). Only aggregate counts + display names cross
  between members — raw data stays private, enforced in the database.

Deployed at **https://johnnynero.github.io/Job-Tracker/**.
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
  data, reset. Online, it also shows your account and a sign-out control.
- **Group** (online only): set a display name, create/join a group by invite
  code, and see everyone's accountability card.

Press **`?`** on the pipeline for keyboard shortcuts, or see
[`docs/keyboard-shortcuts.md`](docs/keyboard-shortcuts.md).

## Docs

- [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) ·
  [Decisions](docs/decisions.md) · [Roadmap](docs/roadmap.md) ·
  [Keyboard shortcuts](docs/keyboard-shortcuts.md)
- [Going online with Supabase](docs/setup-supabase.md)
- [`CLAUDE.md`](CLAUDE.md) — working notes for Claude Code / contributors

## Tech

React 18 + Vite + TypeScript, `@supabase/supabase-js` for online mode, Vitest for
unit tests. Hash-routed SPA deployed to GitHub Pages via Actions. Two
interchangeable store backends (localStorage / Supabase) chosen at runtime behind
a single `useStore()` seam.

## Data & privacy

Offline, your data never leaves your browser. Online, every table is protected by
Row Level Security scoped to your account, and only the public URL + anon key ship
in the build — never the service-role key. Accountability groups share **only
aggregate counts + display names** via `SECURITY DEFINER` functions; no member can
read another's raw applications, notes, or evidence. Export regularly from
Settings; it's your backup and your migration path.
