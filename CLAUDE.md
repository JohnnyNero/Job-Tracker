# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

A **private, single-user, desktop-first job application tracker**. Not a product,
not multi-tenant. One user. Optimised for *still being used in six weeks* — the
failure mode is the board going stale because updating it is a chore, so every
frequent action is fast and keyboard-driven.

**Two backends, one seam.** The app runs on `localStorage` offline, or on
**Supabase (Postgres + magic-link auth)** online. The backend is chosen at
runtime: if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set at build time,
the app renders `SupabaseStore` behind a `LoginGate`; otherwise the offline
`StoreProvider`. Both expose the identical `useStore()` shape, so screens never
change. **Don't add Supabase calls to screens — go through the store.**

Stack: **React 18 + Vite + TypeScript**, `@supabase/supabase-js` for online mode,
**Vitest** for unit tests. Hash router, hand-written CSS with light/dark tokens.

## Commands

```bash
npm install         # first time
npm run dev         # dev server (Vite)
npm run build       # tsc -b type-check, then vite build → dist/
npm run preview     # serve the production build
npm run typecheck   # types only
npm test            # Vitest (pure units: diffSync, backend, inviteCode, router)
```

Tests cover the pure logic (dataset diff, backend selection, invite-code gen,
router parsing). For UI changes, build and, when it matters, drive the preview
build with a headless browser (Chromium is preinstalled at `/opt/pw-browsers`;
use `playwright-core` with an explicit `executablePath`).

## Architecture in one screen

```
                          ┌ offline: StoreProvider (store.tsx) → localStore.ts
components/* → useStore() ┤
                          └ online:  SupabaseStore (SupabaseStore.tsx)
                                       │ optimistic in-memory Dataset
                                       │ computeDiff (diffSync.ts) → row writes
                                       └ reconciles events/applications after push
both paths share mutations.ts (pure (Dataset)→Dataset). Backend picked by
backend.ts / main.tsx from isOnline (supabaseClient.ts).
```

- **All reads/writes go through `useStore()`.** Screens never touch
  localStorage or any network client directly. This one seam is what makes the
  offline/online switch safe. Preserve it.
- **Online store:** `SupabaseStore.tsx` reuses `mutations.ts` for instant
  optimistic state, then `diffSync.ts#computeDiff` turns each prev→next change
  into row inserts/updates/deletes. `supabaseClient.ts` holds the client, auth,
  reads, and `applyOp`. `LoginGate.tsx` is the magic-link gate.
- **Accountability groups** (online only): `supabase/migrations/0002_*.sql` adds
  `profiles`/`groups`/`group_members` + `SECURITY DEFINER` functions
  (`group_summary`, `create_group`, `join_group`, `is_group_member`);
  `src/store/groupsClient.ts` wraps them; `src/components/Group.tsx` is the page.
  Raw-row RLS is untouched — only aggregate counts + display names cross users.
- `src/types.ts` mirrors `supabase/migrations/0001_init.sql` field-for-field.
  **Change one, change the other.**
- `src/store/mutations.ts` holds the business rules (stage events, close
  bookkeeping, `updated_at`, cascades). Add rule changes here.
- `src/store/localStore.ts` persists the entire `Dataset` as one JSON blob under
  `job-tracker:v1`, in the same shape as the Settings JSON export.
- `src/lib/` — `constants` (stages, tones, labels), `dates` (the days-silent
  signal), `id`.
- `src/router.ts` — tiny hash router (`#/`, `#/app/:id`, `#/compose/:id`,
  `#/evidence`, `#/profiles`, `#/cv`, `#/settings`, `#/guide`, `#/group`). The
  `#/group` tab is shown only online.

Full detail: `docs/architecture.md`. Data model: `docs/data-model.md`.
Rationale: `docs/decisions.md`. Roadmap/phases: `docs/roadmap.md`.

## Conventions

- **Save on blur, no Save buttons.** Editable fields use the components in
  `src/components/fields.tsx` (keep a local draft, commit on blur / Cmd-Ctrl-Enter
  when changed). Follow that pattern for new fields.
- **Empty states are real.** Every list says what to do next, never "No items
  found". Sample data is opt-in (Settings), never auto-loaded, so empty states
  stay visible.
- **Desktop-first, but fits any screen.** Built for ~1440px; multi-column
  layouts, dense tables, keyboard shortcuts. It now also collapses cleanly to a
  phone: layouts stack to one column, the pipeline hides low-priority columns
  (keeping role/stage/days), the three-pane composer and master-detail screens
  stack, and the page never scrolls sideways. Responsive rules live at the
  bottom of `src/styles/app.css`. Keep column layouts in CSS classes (e.g.
  `.master-detail`), not inline styles, so the media-query collapse still wins.
- **Accessibility:** visible focus is never removed; `prefers-reduced-motion` is
  respected; dialogs close on `Esc`.
- Match the surrounding style: TypeScript strict, no non-null-assertion soup,
  comments explain *why* not *what*, tokens/colours live in
  `src/styles/tokens.css`.

## Gotchas — read before changing behaviour

1. **Two sources of truth for business rules.** Stage events, `closed_from_stage`,
   and `updated_at` are enforced offline in `mutations.ts` AND online by triggers
   in `0001_init.sql`. If you change one, change the other, or they'll disagree.
2. **Online must NOT double-log stage events.** The DB trigger writes `stage`
   events online, so `computeDiff` never pushes them. It DOES sync user-authored
   events (note/contact/told/draft) as insert/delete only. `SupabaseStore`
   refetches `events`+`applications` after each push to pick up trigger output.
3. **`application_evidence` has a composite PK** (`application_id, evidence_id`),
   no `id` column — `computeDiff` keys it on the pair and deletes via a `match`
   object, not `id`. Don't route it through the id-keyed path.
4. **RLS is load-bearing.** The anon key is public; every table has an
   `own rows` policy, and groups share only aggregates via `SECURITY DEFINER`
   functions. Never weaken it. Verify with `supabase/verify_rls.sql` and the
   group checks in `docs/setup-supabase.md` before shipping online code.
5. **Never commit secrets.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   ever ship (both public). The `service_role` key goes nowhere near this repo.
6. **Base path is case-sensitive.** GitHub Pages serves this repo at
   `/Job-Tracker/` — the path segment matches the repo name's case exactly. Vite
   `base` and `public/404.html` must both use `/Job-Tracker/`, or the page loads
   but its assets 404 and you get a blank screen. Keep them in sync if the repo
   is renamed (override via `VITE_BASE`).
7. **`overflow-x: auto` makes a scroll container on both axes.** The pipeline's
   sticky header sticks to the top of `.table-wrap` (which is a scroll box) — see
   the comment in `src/styles/app.css`. Don't reintroduce a page-relative sticky
   offset there.

## Adding a later phase

The model and store already include `evidence`, `capabilities`,
`application_evidence`, and `criteria`, so Phases 2–4 are mostly new screens over
existing data. Add a route in `src/router.ts`, a component in `src/components/`,
a nav entry in `src/App.tsx`, and any new actions in `store.tsx` +
`mutations.ts`. See `docs/roadmap.md`.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds on push to `main` and
publishes `dist/` to Pages, injecting the Supabase secrets if present (empty is
fine while offline). Enable Pages with **Source: GitHub Actions** in repo
settings.
