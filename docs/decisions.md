# Decisions & rationale

Short log of the choices that shape the codebase, and why — so future changes
don't quietly undo them.

## Offline-first, Supabase-ready

**Decision:** ship a fully working localStorage app first; treat Supabase as a
later, optional backend behind the same store interface.

**Why:** the spec's failure mode is the board going stale because updating it is
a chore. Being usable the instant you open it — no project to create, no keys to
wire — removes every excuse not to. It also lets the whole UI and data model be
validated before committing anything to a database. The store seam
(`src/store/store.tsx`) means going online is a contained change, not a rewrite.

## React + Vite + TypeScript

**Decision:** React over vanilla JS; TypeScript throughout; no state or UI
libraries beyond React itself.

**Why:** the UI is state-heavy (sortable + inline-editable table, save-on-blur
forms, coverage counts). React makes that far less error-prone to build and
maintain over the "still using it in six weeks" horizon. TypeScript makes the
data model self-documenting and catches shape mismatches — the model is the
whole app. Dependency count stays low: React + react-dom, and (later)
supabase-js. That's it.

## Hash routing, no router library

**Decision:** a ~40-line hash router (`src/router.ts`).

**Why:** GitHub Pages has no SPA fallback, so history routing needs a `404.html`
redirect dance and correct base-path handling. Hash routes (`#/app/:id`) sidestep
all of it — every deep link resolves to `index.html`. For a handful of screens a
router dependency earns nothing.

## localStorage as a single JSON blob

**Decision:** persist the entire dataset as one JSON object under one key, in the
exact shape of the JSON export.

**Why:** export = backup = migration file, all for free. It matches the Postgres
shape so moving online is a straight insert. Single-user data is small; the
simplicity is worth more than granular writes.

## Business rules in pure mutations

**Decision:** keep all invariants (stage events, close bookkeeping, cascades) in
pure `(Dataset) => Dataset` functions, mirrored by DB triggers online.

**Why:** pure functions are easy to reason about and test, and keeping the rules
in one file stops them drifting. The online triggers deliberately duplicate the
same rules so the database is correct even if written to directly.

## Sample data is opt-in

**Decision:** never auto-seed; provide "Load sample data" in Settings.

**Why:** the spec insists every list has a real empty state telling you what to
do next. Auto-seeding would hide those states. Opt-in sample data lets you tour
the app without polluting a real board.

## Desktop-first, no phone work

**Decision:** built for ~1440px, degrades to ~1024px, no phone-specific layout.

**Why:** straight from the spec — this is used at a computer with the job ad open
in another tab. The three-pane composer (Phase 3) is the clearest example of
something that only makes sense with width.

## Not built (and deliberately so)

Kanban board, ATS match scores, job-board scraping, CV file generation,
per-sector evidence variants, industry tags, multi-user/sharing, charts and
dashboards. The header tally and the profile coverage view are the only
"analytics", by design.
