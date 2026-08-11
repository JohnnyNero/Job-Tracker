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
  `job-tracker:v1`, in the same shape as the Settings JSON export. It also owns
  the **data-safety** layer: `loadDatasetSafe` preserves an unreadable blob under
  `…:corrupt` instead of starting empty (so the first write can't overwrite it),
  `saveDataset` returns `false` on quota/blocked writes (never a silent alert),
  `normaliseDataset` backfills every row field and drops rows with no id / dangling
  foreign keys, and a `…:undo` snapshot makes destructive replaces reversible.
  The store surfaces all of this as `useStore().health`, rendered by
  `DataBanners` (corrupt / unsaved / undo / backup-nudge). Dates written for
  storage go through `todayIsoDate`/`addDaysIso` in `src/lib/dates.ts`, which
  build a **local** `YYYY-MM-DD` — never `toISOString()`, which shifts the day
  for non-UTC users.
- **Guidance layer (getting-going + staying on track).** `src/lib/coach.ts`
  derives the weekly-applied ring, pipeline-health, and the "Move things forward"
  suggestions (interviews to prep, uncovered essential criteria, thin pipeline)
  from the existing `Dataset` — no new entities. `GettingStarted.tsx` is the
  data-driven onboarding checklist; `CvImportDialog.tsx` + `src/lib/parseCv.ts`
  seed the evidence bank from a pasted CV. Onboarding/target state lives in
  **`prefs`** (`useStore().prefs` / `setPrefs`), persisted under
  `job-tracker:v1:prefs` — deliberately OUTSIDE the `Dataset` and its SQL mirror,
  since it's per-device UI config, not domain data.
- `src/lib/` — `constants` (stages, tones, labels), `dates` (the days-silent
  signal), `id`.
- `src/router.ts` — tiny hash router (`#/`, `#/new`, `#/find`, `#/app/:id`,
  `#/compose/:id`, `#/prep/:id`, `#/evidence`, `#/profiles`, `#/cv`,
  `#/settings`, `#/guide`).
- **Job finding / capture.** `#/find` (`FindJobs.tsx` + `src/lib/boards.ts`)
  builds job-board deep links from keywords/location — it opens searches, never
  scrapes. `#/new?url=&title=&text=` opens the New Application dialog pre-filled
  (`titleToRoleCompany`/`sourceFromUrl` in `parseAd.ts`); it's fed by the **clip
  bookmarklet** (built in `Settings.tsx` against the served origin) and the PWA
  **share_target** (manifest `action: "."` → GET params, folded into `#/new` by
  a bootstrap in `main.tsx` before React reads the hash). Saved searches live in
  `prefs`.

- **CV builder.** `#/cv/:id` (`CvBuilder.tsx` + `CvPreview.tsx`) assembles a CV
  version from a single **`person`** record, global **`cv_experience`** /
  **`cv_education`** rows, and per-version **`cv_versions.layout`** (which
  experiences/education show, and the bullets under each — either live-linked to
  an evidence item or manual). `src/lib/cv.ts` turns that into a rendered doc +
  Markdown + **JSON Resume** (MIT schema, portable). Export is **browser
  print-to-PDF** via the `@media print` block (single-column selectable text =
  ATS-safe) — no PDF library. `src/lib/cvChecks.ts` is the no-AI writing help
  (weak-verb / missing-number / length flags). Keyword extraction + coverage live
  in **`src/lib/keywords.ts`** (`extractKeywords` seeds an application's editable
  **`keywords`** list from the ad; `keywordsForApp` prefers that curated list,
  falling back to a criteria-derived one; `keywordCoverage` matches it against the
  assembled CV). `KeywordsPanel.tsx` is the per-job editor. The `.cv-sheet` is
  always light (a document), independent of theme.
  CV↔profile allocation lives in **Role profiles** (`ProfileCvPanel` →
  `setProfileCurrentCv`), NOT on the CV pages. A CV allocated to a role profile
  (`profile_id` + `is_current`) is pulled into any application on that profile
  via `CvForApplication.tsx` (coverage vs the ad + "tailor a copy":
  `duplicateCvVersion` → `#/cv/:id?app=` opens the builder with that application
  pre-selected in the tailor panel). An evidence-linked CV bullet can be
  **reworded per-CV**: a non-empty `CvBullet.text` overrides the evidence's own
  bullet in `assembleCv` (Reset clears it; Detach drops `evidence_id`) — the
  saved evidence is never touched. Only the builder's preview gets the
  `.cv-print` hook (`CvPreview printable`), so an inline preview never hijacks
  printing. Six ATS-safe **templates** (`src/lib/cvTemplates.ts` → `.tpl-<id>`
  classes on `.cv-sheet`) are CSS-only looks over the same DOM (system fonts,
  single column, colour only on text/rules — no columns/graphics/background
  fills); the choice is stored per-version in `CvLayout.template`.

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
  layouts, dense tables, keyboard shortcuts. It also collapses cleanly to a
  phone (≤640px): the top nav becomes a **fixed bottom tab bar** with icons
  (`NavIcons.tsx`; each screen carries its own `<h1>`), the pipeline table
  becomes a **card list** (`PipelineCard` + a sort `<select>`, gated by
  `useMediaQuery`), dialogs become **full-screen sheets** with a sticky action
  footer, the three-pane composer / prep / master-detail screens stack, and the
  page never scrolls sideways. Responsive rules live at the bottom of
  `src/styles/app.css`; `env(safe-area-inset-*)` keeps the bottom bar clear of
  the home indicator. Keep column layouts in CSS classes, not inline styles.
- **Installable PWA.** `public/manifest.webmanifest` + `public/sw.js` (registered
  in `main.tsx`, production only) make it installable and fully offline — the SW
  caches the app shell (navigations network-first → cached shell; assets
  stale-while-revalidate). Icons in `public/icons/` are pre-rendered PNGs of the
  briefcase mark (standard + maskable); re-raster from the SVG if the mark
  changes. Bump `CACHE` in `sw.js` to evict old caches. PWA paths are
  **relative**, so a `VITE_BASE` override (custom domain) still resolves.
- **Accessibility:** visible focus is never removed; `prefers-reduced-motion` is
  respected; dialogs close on `Esc`.
- Match the surrounding style: TypeScript strict, no non-null-assertion soup,
  comments explain *why* not *what*, tokens/colours live in
  `src/styles/tokens.css`.

## Gotchas — read before changing behaviour

1. **Two sources of truth for business rules.** Stage events, `closed_from_stage`,
   `updated_at`, and the stage-event **body text** are enforced offline in
   `mutations.ts` AND online by triggers in `0001_init.sql`. The trigger's event
   text uses the `stage_label`/`outcome_label` SQL functions so it reads
   identically to `STAGE_LABELS`/`OUTCOME_LABELS` — keep all three in sync. A
   re-close that only changes the outcome logs no new event (both sides use
   `is distinct from`). If you change one, change the other, or they'll disagree.
2. **Online must NOT double-log stage events.** The DB trigger writes the stage
   event online, so the (future) Supabase store must skip the manual event insert
   that the offline store does. This is the single behavioural difference between
   backends. It's documented in `docs/supabase-store-template.ts`.
3. **RLS is load-bearing.** The anon key is public; every table has an
   `own rows` policy. Never weaken it. Verify with `supabase/verify_rls.sql`
   before shipping any online code.
4. **Never commit secrets.** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   ever ship (both public). The `service_role` key goes nowhere near this repo.
5. **Base path is case-sensitive.** GitHub Pages serves this repo at
   `/Job-Tracker/` — the path segment matches the repo name's case exactly. Vite
   `base` and `public/404.html` must both use `/Job-Tracker/`, or the page loads
   but its assets 404 and you get a blank screen. Keep them in sync if the repo
   is renamed (override via `VITE_BASE`).
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
