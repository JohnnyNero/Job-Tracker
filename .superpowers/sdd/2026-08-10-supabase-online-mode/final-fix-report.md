# Final Fix Report — Supabase Online Mode
**Date:** 2026-08-10  
**Branch:** feature/supabase-online

---

## Files Changed

| File | Change |
|---|---|
| `src/store/diffSync.ts` | Full rewrite — composite-key AE handling, `byKey` helper, updated `RowOp` type |
| `src/store/diffSync.test.ts` | Added `withAe` helper + 3 new AE tests |
| `src/store/supabaseClient.ts` | Delete branch supports `match` object; guard-literal comment added |
| `src/store/SupabaseStore.tsx` | `pushChain` ref + serialized `commit` |

---

## Finding 1 (CRITICAL): `application_evidence` composite PK

`diffSync.ts` was keying `application_evidence` via `row.id` (undefined on this table) causing all rows to collapse to key `'undefined'`. Deletes used `.eq('id', ...)` against a table with no `id` column.

**Fix:**
- Removed `application_evidence` from `FULL_TABLES` (id-keyed list)
- Added dedicated `aeKey` composite-key function: `` `${application_id}|${evidence_id}` ``
- New block handles AE: insert/delete only, keyed on the pair
- Deletes emit `{ match: { application_id, evidence_id } }` instead of `{ id }`
- `applyOp` delete branch updated to iterate `op.match` entries via `.eq(k, v)` loop
- `RowOp` delete type updated: `id` and `match` both optional

## Finding 2 (IMPORTANT): Serialized async pushes

Rapid edits fired overlapping `push()` promises. A slow in-flight reconcile could overwrite a newer optimistic state when it settled.

**Fix:** Added `pushChain = useRef<Promise<void>>(Promise.resolve())`. Each `commit` chains `.then(() => push(prev, next))` onto the previous promise so pushes execute serially. `push` already catches its own errors so the chain never rejects.

## Finding 3 (MINOR): Guard-literal comment

Added comment above `looksReal` in `supabaseClient.ts` tying the placeholder string literals to `.env.example`.

---

## Test Results

```
 RUN  v2.1.9 C:/Users/johns/Desktop/Job-Tracker

 ✓ src/store/backend.test.ts > online env selects supabase
 ✓ src/store/backend.test.ts > no env falls back to local
 ✓ src/store/diffSync.test.ts > computeDiff > insert: id present in next, absent in prev
 ✓ src/store/diffSync.test.ts > computeDiff > update: same id, changed content
 ✓ src/store/diffSync.test.ts > computeDiff > delete: id present in prev, absent in next
 ✓ src/store/diffSync.test.ts > computeDiff > unchanged rows produce no ops
 ✓ src/store/diffSync.test.ts > computeDiff > non-stage event insert is emitted
 ✓ src/store/diffSync.test.ts > computeDiff > 'stage' events are never emitted
 ✓ src/store/diffSync.test.ts > computeDiff > non-stage event delete is emitted
 ✓ src/store/diffSync.test.ts > computeDiff > events are never updated (immutable)
 ✓ src/store/diffSync.test.ts > computeDiff > application_evidence insert is keyed on the composite pair  [NEW]
 ✓ src/store/diffSync.test.ts > computeDiff > multiple application_evidence rows do not collapse to one key  [NEW]
 ✓ src/store/diffSync.test.ts > computeDiff > application_evidence delete uses composite match, not id  [NEW]

 Test Files  2 passed (2)
       Tests  13 passed (13)
    Duration  653ms
```

**3 new AE tests: ALL PASS**

## Typecheck

```
> tsc -b --noEmit
(no output — clean)
```

## Build

```
> tsc -b && vite build
✓ 106 modules transformed.
dist/index.html                   0.88 kB │ gzip:  0.49 kB
dist/assets/index-Db4soxjo.css   19.10 kB │ gzip:  4.80 kB
dist/assets/index-ByQjabW4.js   239.44 kB │ gzip: 73.10 kB
✓ built in 2.11s
```
