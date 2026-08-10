# Supabase online mode — design

**Date:** 2026-08-10
**Status:** Approved (design), pending implementation

## Goal

Give the Job-Tracker an optional online backend (Supabase/Postgres) so data
syncs across machines, while the existing offline localStorage mode keeps
working untouched. The choice is made at runtime from build-time env vars.

This design executes the plan already sketched in
[`docs/setup-supabase.md`](../../setup-supabase.md) and the drop-in
[`docs/supabase-store-template.ts`](../../supabase-store-template.ts).

## Constraints (from the existing codebase)

- Every UI read/write already routes through `useStore()` in
  [`src/store/store.tsx`](../../../src/store/store.tsx). The online store must
  expose the **identical `StoreValue` shape** so no screen changes.
- Mutations in [`src/store/mutations.ts`](../../../src/store/mutations.ts)
  compute a **whole new `Dataset`** per action (with ids + timestamps) and the
  provider mirrors it to localStorage.
- The database triggers (from
  [`supabase/migrations/0001_init.sql`](../../../supabase/migrations/0001_init.sql))
  own `updated_at`, automatic **stage events**, and `closed_from_stage`. The
  online store must therefore **not** write to the `events` table itself, or it
  would double-log. This is the one behavioural difference from offline.
- The anon key is public; **Row Level Security is the only protection**. RLS
  must be verified from a signed-out client before the app reads real data.

## Architecture — runtime backend switch

A new `src/store/index.tsx` selects the backend when the module loads:

- If the Supabase client is available (both `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are set at build time) → render `SupabaseStore`
  wrapped in `LoginGate`.
- Otherwise → render the existing localStorage `StoreProvider`.

Both export the same `useStore()` hook. Offline development (no env vars) is
completely unchanged.

## Components

### 1. `src/store/supabaseClient.ts`
Adapted from `docs/supabase-store-template.ts`:
- `supabase` — `createClient(url, anon)` or `null` when env is absent.
- Auth: `signIn(email)` (magic link via `signInWithOtp`), `signOut()`,
  `getSession()`, `onAuthStateChange(cb)`.
- Reads: `fetchDataset()` — one `select('*')` per table, RLS scopes to the
  signed-in user. Also `fetchTables(names)` for targeted reconcile refetches.
- Row ops: `insertRow`, `updateRow`, `deleteRow`.
- Storage (available, not yet wired into UI): `uploadCv`, `cvDownloadUrl`.

### 2. `src/store/diffSync.ts`
One generic function `syncDiff(prev: Dataset, next: Dataset)`:
- For each table **except `events`**: compare by `id`.
  - ids in `next` not in `prev` → `insertRow`.
  - ids in both whose row content changed → `updateRow` (send the row; DB
    triggers overwrite `updated_at`/`closed_from_stage` authoritatively).
  - ids in `prev` not in `next` → `deleteRow`.
- Returns which tables were touched so the caller knows whether to reconcile.
- `events` is never pushed — the DB owns it.

### 3. `src/store/SupabaseStore.tsx`
Provider with the same `StoreValue` shape as `store.tsx`:
- On mount (after auth), `fetchDataset()` into state; show a lightweight loading
  state until the first load resolves.
- Each action reuses the **same `mutations.ts` functions** to compute the next
  dataset and commits it to memory immediately (optimistic, snappy UI).
- After commit, `syncDiff(prev, next)` pushes row writes asynchronously.
- When a push touched `applications` (stage/outcome/close) or any action that
  the DB would react to, **refetch `events` + `applications`** and merge them
  back so trigger-created events and trigger-set fields become authoritative in
  memory.
- `replaceAll` (import) diffs the full incoming dataset against current and
  pushes — this is how offline JSON export is migrated in.

### 4. `src/store/LoginGate.tsx`
Active only online:
- No session → magic-link email form (calls `signIn`); on submit show
  "check your email" confirmation.
- Session present → render children.
- Subscribes to `onAuthStateChange` so the magic-link redirect lands logged in.
- A sign-out control lives in Settings (online only).

## Data flow (one action, online)

1. UI calls a `useStore()` action.
2. `mutations.ts` computes the new `Dataset`.
3. Commit to in-memory state → React re-renders (optimistic).
4. `syncDiff(prev, next)` issues row inserts/updates/deletes (skipping events).
5. If applications changed, refetch `events` + `applications`; merge into memory.

## Error handling

- A failed row write surfaces a non-blocking error (toast/console) and leaves
  the optimistic memory state in place — matching the offline feel. The next
  reconcile refetch corrects any drift.
- Auth failures render inline in `LoginGate`.
- Missing/incomplete env at build time simply falls back to offline mode (no
  error) — the client is `null`.

## Testing

- **`diffSync` unit tests** (Vitest): insert-only, update-only, delete-only,
  mixed; assert `events` is never emitted; assert unchanged rows produce no op.
- **Backend-switch test:** with env unset the offline `StoreProvider` renders;
  with env set (client mocked) `SupabaseStore` renders behind `LoginGate`.
- **RLS verification (manual, pre-launch):** run
  [`supabase/verify_rls.sql`](../../../supabase/verify_rls.sql) in the dashboard
  and a signed-out `createClient().from('applications').select('*')` scratch
  check — expect zero rows. Documented in `setup-supabase.md`.

## Out of scope (YAGNI)

- Wiring CV **file upload** into the CV locker UI. `uploadCv`/`cvDownloadUrl`
  ship available but unused; the locker keeps its name/link behaviour until we
  choose to wire it.
- Realtime subscriptions / multi-device live updates. Reload fetches fresh data.
- Multi-user. RLS scopes everything to a single `auth.uid()`.

## Operator steps (dashboard — done by the user, in parallel)

1. Create a Supabase project; note Project URL + anon public key.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Verify RLS (`verify_rls.sql` + signed-out client check).
4. Authentication → Providers: keep Email/magic-link on; optionally disable new
   sign-ups after first login.
5. (Optional, for CV upload later) create a private `cvs` storage bucket.
6. Provide URL + anon key → wired into `.env`; add the same two as GitHub
   Actions secrets for deploy.
