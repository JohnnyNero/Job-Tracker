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

> Backend note: the tracker runs on localStorage offline. **Online mode
> (Supabase) is now built and deployed** — see the Online mode section below and
> [setup-supabase.md](setup-supabase.md).

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

## ✅ Online mode — Supabase (built, deployed)

- Runtime backend switch: online when the two public env vars are set, else
  localStorage. Same `useStore()` shape, so no screen changes.
- Magic-link auth (`LoginGate`); per-account RLS; diff-based optimistic sync
  (`diffSync.ts`) reusing the offline mutations; `stage` events owned by DB
  triggers, user-authored events synced.
- Design/plan: `docs/superpowers/specs|plans/2026-08-10-supabase-online-mode*`.

## ✅ Accountability groups (built, deployed, online only)

- Create/join a group by invite code; each member's card shows applied-this-week,
  active, overdue follow-ups, interviews, offers.
- Aggregate-only sharing: raw rows never cross users; only counts + display names,
  via `SECURITY DEFINER` functions (`0002_accountability_groups.sql`).
- Design/plan: `docs/superpowers/specs|plans/2026-08-10-accountability-groups*`.

## ⏳ Phase 5 — anything email

Not to be started until Phases 1–4 have been in use for a month.

## Explicitly not building

Kanban, ATS/keyword scores, job-board scraping, CV file generation, per-sector
evidence variants, industry tags, charts and dashboards. (Note: limited
aggregate-only *accountability* sharing shipped — see above — but full
collaborative multi-tenant sharing of raw data remains out of scope.)
