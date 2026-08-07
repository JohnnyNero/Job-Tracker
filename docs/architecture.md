# Architecture

A single-user, desktop-first job application tracker. React + Vite + TypeScript,
**offline-first**, designed so a Supabase (Postgres) backend drops in later
without touching any screen.

## The shape of it

```
UI (components/*)  →  useStore()  →  StoreProvider  →  mutations (pure)  →  Dataset
                                          │
                                          └─ persistence (localStorage today,
                                             Supabase later)
```

Every read and every write goes through one store. Screens never touch
localStorage or a network client directly. That single seam is what makes the
offline→online switch a contained change.

### Layers

- **`src/types.ts`** — the domain types. They mirror
  `supabase/migrations/0001_init.sql` field-for-field, so offline and online
  data are the same shape. Change one, change the other.
- **`src/store/mutations.ts`** — pure functions `(Dataset, args) => Dataset`.
  All the business rules live here: stage changes append a timeline event,
  closing records `closed_from_stage`, `updated_at` is bumped, deletes cascade.
  No I/O, so they're trivial to reason about (and to unit-test).
- **`src/store/localStore.ts`** — load/save the whole `Dataset` as one JSON blob
  in `localStorage` under `job-tracker:v1`. Same shape as the JSON export.
- **`src/store/store.tsx`** — the React context. Holds the dataset in state,
  mirrors every write to storage, exposes bound actions via `useStore()`.
- **`src/store/sample.ts`** — the on-demand sample dataset (Settings → Load
  sample). Never auto-loaded, so empty states stay honest.
- **`src/components/*`** — the screens (see below).
- **`src/lib/*`** — `constants` (stages, tones, labels), `dates` (the
  days-silent signal), `id` (uuid + now).
- **`src/router.ts`** — a tiny hash router (no dependency).

## Why these choices

See [decisions.md](decisions.md) for the reasoning. In short: offline-first so
the tool is usable immediately and never blocked on Supabase; one store seam so
going online is low-risk; hash routing so GitHub Pages (no SPA fallback) just
works; localStorage as a single JSON blob so export = backup = migration file.

## Screens (Phase 1)

| Route          | Component              | Purpose |
|----------------|------------------------|---------|
| `#/`           | `Pipeline`             | Sortable table, filters, inline stage edit, days-silent signal, keyboard nav |
| `#/app/:id`    | `ApplicationDetail`    | Two-column: fields + timeline left, archived ad right. Save-on-blur. Close→outcome. |
| `#/profiles`   | `Profiles`             | Role profiles, capability vocabulary, coverage view |
| `#/cv`         | `CvLocker`             | CV versions, which applications used each |
| `#/settings`   | `Settings`             | JSON export/import, sample data, reset, Supabase notes |

## Data flow example: changing a stage

1. User picks a stage in the pipeline cell (or detail).
2. `useStore().changeStage(id, stage)` runs `mutations.changeStage`.
3. That returns a new `Dataset` with the application updated **and** a new
   `events` row of kind `stage` appended.
4. The provider sets state and writes the blob to localStorage.
5. React re-renders the table and the timeline.

Online, the same `changeStage` becomes an `UPDATE`, and the **database trigger**
writes the stage event — so the online store skips step 3's event insert to
avoid double-logging. That is the only behavioural difference between the two
backends.

## Going online

The whole migration path is in [setup-supabase.md](setup-supabase.md), with a
ready store template in [supabase-store-template.ts](supabase-store-template.ts).

## Build & deploy

- `npm run dev` — local dev server.
- `npm run build` — typecheck (`tsc -b`) then Vite build to `dist/`.
- `npm run preview` — serve the production build locally.
- GitHub Actions (`.github/workflows/deploy.yml`) builds on push to `main` and
  publishes `dist/` to Pages. Vite `base` is `/job-tracker/`; `public/404.html`
  is the Pages fallback. Supabase env vars come from repo secrets (empty until
  you add them).
