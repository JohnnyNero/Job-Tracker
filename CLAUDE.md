# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

A **private, single-user, desktop-first job application tracker**. Not a product,
not multi-tenant. One user. Optimised for *still being used in six weeks* — the
failure mode is the board going stale because updating it is a chore, so every
frequent action is fast and keyboard-driven.

**Currently offline-first:** the app runs entirely on `localStorage`. A Supabase
(Postgres) backend is fully specced and ready to wire but intentionally not
connected yet. Don't add Supabase calls to screens — go through the store.

Stack: **React 18 + Vite + TypeScript**, minimal dependencies (React + react-dom
only at runtime). Hash router, hand-written CSS with light/dark tokens.

## Commands

```bash
npm install         # first time
npm run dev         # dev server (Vite)
npm run build       # tsc -b type-check, then vite build → dist/
npm run preview     # serve the production build
npm run typecheck   # types only
```

There is no test runner yet. Verify UI changes by building and, when it matters,
driving the preview build with a headless browser (Chromium is preinstalled at
`/opt/pw-browsers`; use `playwright-core` with an explicit `executablePath`).

## Architecture in one screen

```
components/*  →  useStore()  →  StoreProvider (src/store/store.tsx)
                                   │  holds the whole Dataset in state
                                   │  mirrors every write to localStorage
                                   └→ mutations.ts (pure (Dataset)→Dataset)
```

- **All reads/writes go through `useStore()`.** Screens never touch
  localStorage or any network client directly. This one seam is what makes the
  offline→online switch safe. Preserve it.
- `src/types.ts` mirrors `supabase/migrations/0001_init.sql` field-for-field.
  **Change one, change the other.**
- `src/store/mutations.ts` holds the business rules (stage events, close
  bookkeeping, `updated_at`, cascades). Add rule changes here.
- `src/store/localStore.ts` persists the entire `Dataset` as one JSON blob under
  `job-tracker:v1`, in the same shape as the Settings JSON export.
- `src/lib/` — `constants` (stages, tones, labels), `dates` (the days-silent
  signal), `id`.
- `src/router.ts` — tiny hash router (`#/`, `#/app/:id`, `#/profiles`, `#/cv`,
  `#/settings`).

Full detail: `docs/architecture.md`. Data model: `docs/data-model.md`.
Rationale: `docs/decisions.md`. Roadmap/phases: `docs/roadmap.md`.

## Conventions

- **Save on blur, no Save buttons.** Editable fields use the components in
  `src/components/fields.tsx` (keep a local draft, commit on blur / Cmd-Ctrl-Enter
  when changed). Follow that pattern for new fields.
- **Empty states are real.** Every list says what to do next, never "No items
  found". Sample data is opt-in (Settings), never auto-loaded, so empty states
  stay visible.
- **Desktop-first.** Built for ~1440px, degrades to ~1024px. No phone-specific
  work. Multi-column layouts, dense tables, keyboard shortcuts.
- **Accessibility:** visible focus is never removed; `prefers-reduced-motion` is
  respected; dialogs close on `Esc`.
- Match the surrounding style: TypeScript strict, no non-null-assertion soup,
  comments explain *why* not *what*, tokens/colours live in
  `src/styles/tokens.css`.

## Gotchas — read before changing behaviour

1. **Two sources of truth for business rules.** Stage events, `closed_from_stage`,
   and `updated_at` are enforced offline in `mutations.ts` AND online by triggers
   in `0001_init.sql`. If you change one, change the other, or they'll disagree.
2. **Online must NOT double-log stage events.** The DB trigger writes the stage
   event online, so the (future) Supabase store must skip the manual event insert
   that the offline store does. This is the single behavioural difference between
   backends. It's documented in `docs/supabase-store-template.ts`.
3. **RLS is load-bearing.** The anon key is public; every table has an
   `own rows` policy. Never weaken it. Verify with `supabase/verify_rls.sql`
   before shipping any online code.
4. **Never commit secrets.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   ever ship (both public). The `service_role` key goes nowhere near this repo.
5. **Base path.** GitHub Pages serves at `/job-tracker/`; Vite `base` is set
   accordingly and `public/404.html` is the Pages fallback. Keep them in sync if
   the repo is renamed (override via `VITE_BASE`).
6. **`overflow-x: auto` makes a scroll container on both axes.** The pipeline's
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
