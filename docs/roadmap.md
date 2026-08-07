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

## ⏳ Phase 2 — evidence bank & profiles (data layer ready)

The `evidence`, `capabilities`, and coverage pieces already exist in the model
and store. Still to build as a first-class screen:

- Evidence bank list: search across title/bullet/full_text, capability filter,
  both length fields side by side, flag half-finished items, show `use_count`
- (Role profiles and coverage view are already present)

## ⏳ Phase 3 — composer

- Three panes: criteria/question · filtered evidence bank · writing pane
- Click-to-insert at cursor, drag to reorder, "Copy all"
- Concatenates only — never rewrites or generates
- Copying records `application_evidence` and bumps `use_count`

## ⏳ Phase 4 — criteria checklist

- Paste ad text, split on newlines/bullets into candidate criteria
- Editable rows (add/delete/reorder), link each to an evidence item
- The value is the editable checklist, not the parse quality

## ⏳ Phase 5 — anything email

Not to be started until Phases 1–4 have been in use for a month.

## Explicitly not building

Kanban, ATS/keyword scores, job-board scraping, CV file generation, per-sector
evidence variants, industry tags, sharing/multi-user, charts and dashboards.
