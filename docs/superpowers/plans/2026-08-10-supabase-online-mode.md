# Supabase Online Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Supabase/Postgres backend selected at runtime from env vars, leaving the offline localStorage mode unchanged.

**Architecture:** A runtime switch renders `SupabaseStore` (behind a magic-link `LoginGate`) when the Supabase env vars are present, else the existing localStorage `StoreProvider`. Both expose the identical `useStore()` shape. The online store reuses `mutations.ts` for optimistic in-memory state, then a generic `diffSync` pushes row-level writes; the `events` table is owned by DB triggers and never pushed.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, `@supabase/supabase-js` v2, Vitest (new) for pure-unit tests.

## Global Constraints

- Node/type env: `"type": "module"`, TypeScript strict build via `tsc -b`. Keep `npm run typecheck` clean.
- The online store MUST NOT push `stage` events — the DB trigger owns those (and `closed_from_stage`, `updated_at`). It MUST sync user-authored events (`note`/`contact`/`told`/`draft`) as insert/delete only (events are immutable). See Task 2.
- The anon key is public; never add the `service_role` key to any file. RLS is the only protection.
- `Dataset` keys map 1:1 to table names: `capabilities`, `role_profiles`, `evidence`, `cv_versions`, `applications`, `events`, `application_evidence`, `criteria`.
- Offline mode (env unset) must remain byte-for-byte unchanged in behavior.
- Match existing code style: no semicolons, single quotes, 2-space indent, named exports.

---

### Task 1: Dependencies + Vitest harness

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `vitest.config.ts`
- Create: `src/store/__tests__/smoke.test.ts` (temporary, deleted in Step 5)

**Interfaces:**
- Produces: `npm test` runs Vitest; `@supabase/supabase-js` importable.

- [ ] **Step 1: Install runtime + test deps**

Run:
```bash
npm install @supabase/supabase-js@^2
npm install -D vitest@^2
```

- [ ] **Step 2: Add test script**

In `package.json` `scripts`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Add a smoke test and run it**

`src/store/__tests__/smoke.test.ts`:
```ts
import { expect, test } from 'vitest'

test('vitest runs', () => {
  expect(1 + 1).toBe(2)
})
```
Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Delete the smoke test, commit**

```bash
rm src/store/__tests__/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add supabase-js and vitest harness"
```

---

### Task 2: `diffSync` — generic dataset differ (pure, TDD)

**Files:**
- Create: `src/store/diffSync.ts`
- Test: `src/store/diffSync.test.ts`

**Interfaces:**
- Consumes: `Dataset` from `../types`.
- Produces:
  - `type RowOp = { op: 'insert' | 'update' | 'delete'; table: TableName; row?: Record<string, unknown>; id?: string }`
  - `type TableName = Exclude<keyof Dataset, 'events'>`
  - `computeDiff(prev: Dataset, next: Dataset): RowOp[]` — pure; never emits ops for the `events` table; `insert` carries the full row, `update` carries the full row, `delete` carries `id`.

- [ ] **Step 1: Write failing tests**

`src/store/diffSync.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { computeDiff } from './diffSync'
import { emptyDataset } from './localStore'
import type { Dataset } from '../types'

const withApp = (apps: Array<{ id: string; role: string }>): Dataset => ({
  ...emptyDataset(),
  applications: apps as unknown as Dataset['applications'],
})

describe('computeDiff', () => {
  test('insert: id present in next, absent in prev', () => {
    const ops = computeDiff(emptyDataset(), withApp([{ id: 'a1', role: 'Dev' }]))
    expect(ops).toEqual([
      { op: 'insert', table: 'applications', row: { id: 'a1', role: 'Dev' } },
    ])
  })

  test('update: same id, changed content', () => {
    const ops = computeDiff(withApp([{ id: 'a1', role: 'Dev' }]), withApp([{ id: 'a1', role: 'Lead' }]))
    expect(ops).toEqual([
      { op: 'update', table: 'applications', id: 'a1', row: { id: 'a1', role: 'Lead' } },
    ])
  })

  test('delete: id present in prev, absent in next', () => {
    const ops = computeDiff(withApp([{ id: 'a1', role: 'Dev' }]), emptyDataset())
    expect(ops).toEqual([{ op: 'delete', table: 'applications', id: 'a1' }])
  })

  test('unchanged rows produce no ops', () => {
    const same = withApp([{ id: 'a1', role: 'Dev' }])
    expect(computeDiff(same, same)).toEqual([])
  })

  test('events table is never emitted', () => {
    const prev = emptyDataset()
    const next: Dataset = { ...emptyDataset(), events: [{ id: 'e1' } as unknown as Dataset['events'][number]] }
    expect(computeDiff(prev, next)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `computeDiff` not exported.

- [ ] **Step 3: Implement `diffSync.ts`**

```ts
import type { Dataset } from '../types'

export type TableName = Exclude<keyof Dataset, 'events'>

export type RowOp =
  | { op: 'insert'; table: TableName; row: Record<string, unknown> }
  | { op: 'update'; table: TableName; id: string; row: Record<string, unknown> }
  | { op: 'delete'; table: TableName; id: string }

const TABLES: TableName[] = [
  'capabilities',
  'role_profiles',
  'evidence',
  'cv_versions',
  'applications',
  'application_evidence',
  'criteria',
]

type Row = { id: string } & Record<string, unknown>

const byId = (rows: unknown[]): Map<string, Row> => {
  const m = new Map<string, Row>()
  for (const r of rows as Row[]) m.set(r.id, r)
  return m
}

/** Pure diff of two datasets into row operations. The `events` table is
 * deliberately excluded — Postgres triggers own it. */
export function computeDiff(prev: Dataset, next: Dataset): RowOp[] {
  const ops: RowOp[] = []
  for (const table of TABLES) {
    const before = byId(prev[table] as unknown[])
    const after = byId(next[table] as unknown[])
    for (const [id, row] of after) {
      const prior = before.get(id)
      if (!prior) ops.push({ op: 'insert', table, row })
      else if (JSON.stringify(prior) !== JSON.stringify(row))
        ops.push({ op: 'update', table, id, row })
    }
    for (const id of before.keys()) {
      if (!after.has(id)) ops.push({ op: 'delete', table, id })
    }
  }
  return ops
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/diffSync.ts src/store/diffSync.test.ts
git commit -m "feat: add pure computeDiff for dataset row sync"
```

---

### Task 3: `supabaseClient.ts` — client, auth, reads, row ops, storage

**Files:**
- Create: `src/store/supabaseClient.ts`

**Interfaces:**
- Consumes: `Dataset` from `../types`; `RowOp` from `./diffSync`.
- Produces:
  - `supabase` — `SupabaseClient | null`
  - `isOnline: boolean` (true when `supabase` is non-null)
  - `signIn(email: string): Promise<void>`, `signOut(): Promise<void>`
  - `getSession(): Promise<Session | null>`
  - `onAuthStateChange(cb: (session: Session | null) => void): () => void` (returns unsubscribe)
  - `fetchDataset(): Promise<Dataset>`
  - `fetchTables(names: (keyof Dataset)[]): Promise<Partial<Dataset>>`
  - `applyOp(op: RowOp): Promise<void>`
  - `uploadCv(file: File, path: string): Promise<string>`, `cvDownloadUrl(path: string): Promise<string>`

- [ ] **Step 1: Implement the client module**

```ts
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Dataset } from '../types'
import type { RowOp } from './diffSync'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Non-null only when both public env vars are set at build time. */
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null
export const isOnline = supabase !== null

const ALL_TABLES: (keyof Dataset)[] = [
  'capabilities',
  'role_profiles',
  'evidence',
  'cv_versions',
  'applications',
  'events',
  'application_evidence',
  'criteria',
]

export async function signIn(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

export async function fetchTables(names: (keyof Dataset)[]): Promise<Partial<Dataset>> {
  if (!supabase) throw new Error('Supabase not configured')
  const results = await Promise.all(names.map((t) => supabase.from(t as string).select('*')))
  const out: Partial<Dataset> = {}
  names.forEach((t, i) => {
    const { data, error } = results[i]
    if (error) throw error
    ;(out as Record<string, unknown[]>)[t as string] = data ?? []
  })
  return out
}

export async function fetchDataset(): Promise<Dataset> {
  return (await fetchTables(ALL_TABLES)) as Dataset
}

export async function applyOp(op: RowOp): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  if (op.op === 'insert') {
    const { error } = await supabase.from(op.table).upsert(op.row)
    if (error) throw error
  } else if (op.op === 'update') {
    const { error } = await supabase.from(op.table).update(op.row).eq('id', op.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(op.table).delete().eq('id', op.id)
    if (error) throw error
  }
}

export async function uploadCv(file: File, path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function cvDownloadUrl(path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/supabaseClient.ts
git commit -m "feat: add supabase client, auth, reads, row ops, storage"
```

---

### Task 4: Backend-selection decision (pure, TDD) + `SupabaseStore`

**Files:**
- Create: `src/store/backend.ts`
- Test: `src/store/backend.test.ts`
- Create: `src/store/SupabaseStore.tsx`

**Interfaces:**
- Consumes: `isOnline` from `./supabaseClient`; `StoreValue` shape + mutations as used by `store.tsx`.
- Produces:
  - `chooseBackend(online: boolean): 'supabase' | 'local'`
  - `SupabaseStore({ children }): JSX.Element` — provides the same `StoreContext` value as `store.tsx`.

- [ ] **Step 1: Write failing test for `chooseBackend`**

`src/store/backend.test.ts`:
```ts
import { expect, test } from 'vitest'
import { chooseBackend } from './backend'

test('online env selects supabase', () => {
  expect(chooseBackend(true)).toBe('supabase')
})

test('no env falls back to local', () => {
  expect(chooseBackend(false)).toBe('local')
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test`
Expected: FAIL — `chooseBackend` not exported.

- [ ] **Step 3: Implement `backend.ts`**

```ts
/** Pure backend decision so it is testable without rendering React. */
export function chooseBackend(online: boolean): 'supabase' | 'local' {
  return online ? 'supabase' : 'local'
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: passed.

- [ ] **Step 5: Export `StoreContext` and `StoreValue` from `store.tsx` for reuse**

In `src/store/store.tsx`, change `const StoreContext = ...` to `export const StoreContext = ...` and add `export type { StoreValue }`. Do not change any behavior.

- [ ] **Step 6: Implement `SupabaseStore.tsx`**

Mirrors `store.tsx`'s value construction but async-syncs. Reuses the same mutations and the same `StoreContext`.

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Dataset } from '../types'
import { StoreContext, type StoreValue } from './store'
import { emptyDataset, normaliseDataset } from './localStore'
import * as m from './mutations'
import { computeDiff } from './diffSync'
import { applyOp, fetchDataset, fetchTables } from './supabaseClient'

// Tables whose contents the DB mutates via triggers; refetch them after any
// write so trigger-created events and trigger-set fields become authoritative.
const RECONCILE: (keyof Dataset)[] = ['events', 'applications']

export function SupabaseStore({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(emptyDataset)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef(data)
  useEffect(() => {
    ref.current = data
  }, [data])

  useEffect(() => {
    fetchDataset()
      .then((d) => {
        ref.current = d
        setData(d)
      })
      .catch((err) => console.error('Initial load failed:', err))
      .finally(() => setLoaded(true))
  }, [])

  // Push the diff between prev and next, then reconcile trigger-owned tables.
  const push = useCallback(async (prev: Dataset, next: Dataset) => {
    const ops = computeDiff(prev, next)
    if (ops.length === 0) return
    try {
      for (const op of ops) await applyOp(op)
      const fresh = await fetchTables(RECONCILE)
      const merged = { ...ref.current, ...fresh }
      ref.current = merged
      setData(merged)
    } catch (err) {
      console.error('Sync failed; optimistic state kept:', err)
    }
  }, [])

  const commit = useCallback(
    (next: Dataset) => {
      const prev = ref.current
      ref.current = next
      setData(next)
      void push(prev, next)
    },
    [push],
  )

  const run = useCallback(
    (fn: (d: Dataset) => Dataset) => commit(fn(ref.current)),
    [commit],
  )
  const runCreate = useCallback(
    <T,>(fn: (d: Dataset) => [Dataset, T]): T => {
      const [next, created] = fn(ref.current)
      commit(next)
      return created
    },
    [commit],
  )

  const value: StoreValue = {
    data,
    addApplication: (input) => runCreate((d) => m.addApplication(d, input)),
    updateApplication: (id, patch) => run((d) => m.updateApplication(d, id, patch)),
    changeStage: (id, stage) => run((d) => m.changeStage(d, id, stage)),
    closeApplication: (id, outcome) => run((d) => m.closeApplication(d, id, outcome)),
    logFollowUp: (id) => run((d) => m.logFollowUp(d, id)),
    snoozeApplication: (id, days) => run((d) => m.snoozeApplication(d, id, days)),
    deleteApplication: (id) => run((d) => m.deleteApplication(d, id)),
    addEvent: (applicationId, kind, body) => run((d) => m.addEvent(d, applicationId, kind, body)),
    deleteEvent: (id) => run((d) => m.deleteEvent(d, id)),
    addProfile: (name) => runCreate((d) => m.addProfile(d, name)),
    updateProfile: (id, patch) => run((d) => m.updateProfile(d, id, patch)),
    deleteProfile: (id) => run((d) => m.deleteProfile(d, id)),
    addCapability: (name, note = null) => run((d) => m.addCapability(d, name, note)),
    updateCapability: (id, patch) => run((d) => m.updateCapability(d, id, patch)),
    deleteCapability: (id) => run((d) => m.deleteCapability(d, id)),
    addEvidence: (title) => runCreate((d) => m.addEvidence(d, title)),
    updateEvidence: (id, patch) => run((d) => m.updateEvidence(d, id, patch)),
    deleteEvidence: (id) => run((d) => m.deleteEvidence(d, id)),
    addCvVersion: (label) => runCreate((d) => m.addCvVersion(d, label)),
    updateCvVersion: (id, patch) => run((d) => m.updateCvVersion(d, id, patch)),
    deleteCvVersion: (id) => run((d) => m.deleteCvVersion(d, id)),
    recordEvidenceUse: (applicationId, evidenceIds) =>
      run((d) => m.recordEvidenceUse(d, applicationId, evidenceIds)),
    addCriterion: (applicationId, text, essential = true) =>
      runCreate((d) => m.addCriterion(d, applicationId, text, essential)),
    addCriteriaBulk: (applicationId, texts) => run((d) => m.addCriteriaBulk(d, applicationId, texts)),
    updateCriterion: (id, patch) => run((d) => m.updateCriterion(d, id, patch)),
    deleteCriterion: (id) => run((d) => m.deleteCriterion(d, id)),
    moveCriterion: (id, dir) => run((d) => m.moveCriterion(d, id, dir)),
    replaceAll: (incoming) => commit(normaliseDataset(incoming)),
  }

  if (!loaded) return <div className="app-loading">Loading your data…</div>
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `StoreValue` field signatures drift, align them to `store.tsx` exactly.)

- [ ] **Step 8: Commit**

```bash
git add src/store/backend.ts src/store/backend.test.ts src/store/SupabaseStore.tsx src/store/store.tsx
git commit -m "feat: add SupabaseStore with diff-based optimistic sync"
```

---

### Task 5: `LoginGate` (magic link)

**Files:**
- Create: `src/store/LoginGate.tsx`

**Interfaces:**
- Consumes: `signIn`, `getSession`, `onAuthStateChange` from `./supabaseClient`.
- Produces: `LoginGate({ children }): JSX.Element` — renders children only when a session exists; otherwise a magic-link form.

- [ ] **Step 1: Implement `LoginGate.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthStateChange, signIn } from './supabaseClient'

export function LoginGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSession()
      .then(setSession)
      .finally(() => setReady(true))
    return onAuthStateChange(setSession)
  }, [])

  if (!ready) return <div className="app-loading">…</div>
  if (session) return <>{children}</>

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await signIn(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  return (
    <div className="login-gate">
      <h1>Job Tracker</h1>
      {sent ? (
        <p>Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Send magic link</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/LoginGate.tsx
git commit -m "feat: add magic-link login gate for online mode"
```

---

### Task 6: Wire the runtime switch into the entry point + Settings sign-out + .env

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/components/Settings.tsx` (add online-only sign-out)
- Create: `.env` (local, gitignored)

**Interfaces:**
- Consumes: `chooseBackend`, `isOnline`, `SupabaseStore`, `LoginGate`, `StoreProvider`, `signOut`.

- [ ] **Step 1: Update `src/main.tsx` to select the backend**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import { StoreProvider } from './store/store'
import { SupabaseStore } from './store/SupabaseStore'
import { LoginGate } from './store/LoginGate'
import { chooseBackend } from './store/backend'
import { isOnline } from './store/supabaseClient'
import { App } from './App'

const tree =
  chooseBackend(isOnline) === 'supabase' ? (
    <LoginGate>
      <SupabaseStore>
        <App />
      </SupabaseStore>
    </LoginGate>
  ) : (
    <StoreProvider>
      <App />
    </StoreProvider>
  )

createRoot(document.getElementById('root')!).render(<StrictMode>{tree}</StrictMode>)
```

- [ ] **Step 2: Add an online-only sign-out control in Settings**

In `src/components/Settings.tsx`, import at top:
```tsx
import { isOnline, signOut } from '../store/supabaseClient'
```
Add near the top of the settings body (inside the returned JSX, before the offline/Supabase note):
```tsx
{isOnline && (
  <section>
    <h3>Account</h3>
    <button type="button" onClick={() => void signOut()}>Sign out</button>
  </section>
)}
```

- [ ] **Step 3: Create local `.env` from the example**

```bash
cp .env.example .env
```
Leave the placeholder values for now (offline mode stays active until real keys are added). `.env` is already gitignored — confirm with `git check-ignore .env`.

- [ ] **Step 4: Full build + typecheck + tests**

Run:
```bash
npm run typecheck
npm test
npm run build
```
Expected: typecheck clean, tests pass, build succeeds. With placeholder env the build stays in offline mode (client is null because the URL is the literal placeholder — see Task 7 guard).

- [ ] **Step 5: Commit (do not commit `.env`)**

```bash
git add src/main.tsx src/components/Settings.tsx
git commit -m "feat: runtime backend switch + online sign-out"
```

---

### Task 7: Placeholder-safe client guard + docs note for deploy secrets

**Files:**
- Modify: `src/store/supabaseClient.ts`
- Modify: `docs/setup-supabase.md` (cross-link the new spec/plan; note secrets step already covered)

**Interfaces:**
- Produces: `isOnline` is false when env values are the shipped placeholders, so a copied-but-unfilled `.env` does not half-activate online mode.

- [ ] **Step 1: Guard against placeholder env values**

In `src/store/supabaseClient.ts`, replace the `supabase` construction with:
```ts
const looksReal =
  !!url &&
  !!anon &&
  !url.includes('YOUR-PROJECT-ref') &&
  anon !== 'your-public-anon-key'

export const supabase: SupabaseClient | null = looksReal ? createClient(url!, anon!) : null
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean; offline mode with placeholder `.env`.

- [ ] **Step 3: Add a short pointer in `docs/setup-supabase.md`**

Under the top intro, add one line:
```markdown
> Implementation: see `docs/superpowers/specs/2026-08-10-supabase-online-mode-design.md`
> and `docs/superpowers/plans/2026-08-10-supabase-online-mode.md`.
```

- [ ] **Step 4: Commit**

```bash
git add src/store/supabaseClient.ts docs/setup-supabase.md
git commit -m "feat: ignore placeholder env; link online-mode docs"
```

---

## Manual verification (after user provides real keys — not a coding task)

1. Put real `VITE_SUPABASE_URL` + anon key in `.env`.
2. `npm run dev` → magic-link gate appears → sign in via emailed link.
3. Add an application; confirm the row appears in the Supabase table editor and that a `stage` event was auto-created by the trigger (not duplicated).
4. Signed-out RLS check (scratch Node script from `setup-supabase.md`): expect 0 rows.
5. Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets for deploy.

## Self-Review notes

- **Spec coverage:** runtime switch (Task 6), supabaseClient (Task 3), diffSync excluding events (Task 2), SupabaseStore optimistic + reconcile (Task 4), LoginGate (Task 5), error handling = console + optimistic-kept (Task 4 `push` catch), testing = diffSync + chooseBackend units (Tasks 2/4), CV upload available-but-unwired (Task 3, no UI), RLS manual (verification section). All covered.
- **Placeholder scan:** none — all steps carry real code.
- **Type consistency:** `computeDiff`, `RowOp`, `TableName`, `applyOp`, `fetchTables`, `chooseBackend`, `isOnline` names used identically across tasks.
