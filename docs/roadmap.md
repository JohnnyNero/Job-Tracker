# Roadmap

Build order from the spec. **Phase 1 must survive real daily use before Phase 2
starts** — if it doesn't hold up for two weeks, everything after it is wasted
effort.

## ✅ Phase 1 — the tracker (built, offline)

- Applications CRUD
- Pipeline table: sort every column, filters (Live/All/per-stage + profile),
  header tally, inline stage editing, days-silent signal, keyboard nav
- Application detail: two-column with the archived ad, save-on-blur, timeline,
  stage/outcome split, close→outcome prompt
- CV locker: versions + which applications used each
- Role profiles (the light version Phase 1 needs for the profile column/filter)
  plus the capability vocabulary and coverage view
- Settings: JSON export/import, sample data, reset

> Backend note: Phase 1 runs on localStorage. Connecting Supabase (auth, RLS,
> Postgres, Storage) is a separate, optional step — see
> [setup-supabase.md](setup-supabase.md). The schema, RLS, and triggers are
> already written in `supabase/migrations/`.

## ✅ Phase 2 — evidence bank & profiles (built, offline)

- Evidence bank screen: master-detail with search across title/bullet/full_text,
  capability filter, a half-finished-only filter, both length fields side by
  side, half-finished flags, and `use_count`
- Role profiles, capability vocabulary, and the coverage view (built in Phase 1)

`use_count` / `last_used_at` are bumped by the composer (Phase 3); until then
they reflect sample data and stay at zero for hand-entered items.

## ✅ Phase 3 — composer (built, offline)

- Three panes: the question/positioning · the evidence bank filtered to the
  application profile's priority capabilities · the draft
- Click-to-insert (bullet or full text) as reorderable blocks; drag or the
  up/down buttons to arrange; "Copy all" concatenates to the clipboard
- Concatenates only — never rewrites, blends, or generates
- Edits in a block stay local unless you "Save changes to this item"
- "Copy all" records `application_evidence` links and bumps `use_count` /
  `last_used_at` for each distinct item used
- Launched from the application detail screen (`#/compose/:id`)

## ✅ Phase 4 — criteria checklist (built, offline)

- "Extract from ad" splits the pasted ad text on newlines/bullets into candidate
  rows (`src/lib/criteria.ts`) — deliberately rough, as intended
- Editable checklist on the application detail screen: per-row essential /
  nice-to-have toggle, edit text, link to an evidence item, reorder, delete,
  add rows by hand
- Coverage badge (essential criteria with evidence linked)
- The composer's left pane lists these criteria with a covered/uncovered dot and
  quick-insert buttons for the linked evidence

## ⏳ Phase 5 — anything email

Not to be started until Phases 1–4 have been in use for a month.

## Explicitly not building

Kanban, ATS/keyword scores, job-board scraping, CV file generation, per-sector
evidence variants, industry tags, sharing/multi-user, charts and dashboards.
