# Going online with Supabase

The app works fully offline today (localStorage). Follow this when you want it
backed by Postgres and synced across machines. Nothing here is required to use
the app.

> Implementation: see `docs/superpowers/specs/2026-08-10-supabase-online-mode-design.md`
> and `docs/superpowers/plans/2026-08-10-supabase-online-mode.md`.

The order matters: **stand up the database and prove RLS works before any app
code reads from it.** The anon key is public; RLS is the only thing between your
data and the world.

## 1. Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a project (the
   free tier is fine). Pick a region near you.
2. Note two values from **Project Settings → API**:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

   Both are safe to expose. The **`service_role`** key on the same page is not —
   never put it in this repo, a committed `.env`, or a GitHub Actions step.

## 2. Run the schema

Open **SQL Editor** in the dashboard, paste the contents of
[`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql),
and run it. This creates every table, enables RLS with an `own rows` policy on
each, and installs the triggers (updated_at, automatic stage events,
`closed_from_stage` on close).

## 3. Verify RLS — before writing app code

Do not trust that RLS is on; prove it.

**In the dashboard:** run [`../supabase/verify_rls.sql`](../supabase/verify_rls.sql)
and confirm RLS is enabled on all 8 tables, all 8 policies exist, and the
anon-role counts are zero.

**From a real signed-out client** (the trustworthy test). With your URL and anon
key, run this in a scratch Node script:

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(URL, ANON_KEY) // no auth = anonymous
const { data, error } = await supabase.from('applications').select('*')
console.log({ rows: data?.length, error })
// Expect rows: 0 (or an empty array). If you can read rows unauthenticated,
// STOP and fix RLS.
```

Insert a test row while signed in (via the dashboard), then re-run the snippet
signed-out. Still zero? RLS works.

## 4. Auth (single user — you)

Under **Authentication → Providers**, keep **Email** on and use magic links.
Optionally turn **off** new sign-ups after your first login so only you can get
in. There is no multi-user concept in this app; RLS scopes everything to your
`auth.uid()`.

## 5. Storage for CV files

Create a **private** bucket named `cvs` (Storage → New bucket). The CV locker
stores a file name/link offline; online it uploads to this bucket and links via
signed URLs (see the template).

## 6. Wire the app

1. `npm install @supabase/supabase-js`
2. Copy [`supabase-store-template.ts`](supabase-store-template.ts) into
   `src/store/` and build a `SupabaseStore` that fulfils the same shape as the
   value in `src/store/store.tsx`.
3. Add a magic-link login gate around `<App/>`.
4. Choose the backend at runtime: if `import.meta.env.VITE_SUPABASE_URL` is set,
   use Supabase; otherwise stay on localStorage. That keeps offline dev working.

**One behavioural difference to respect:** online, the database triggers write
stage events and maintain `closed_from_stage`/`updated_at`. So the online store
must NOT also insert stage events itself (the offline store does). Everything
else is the same code path.

## 7. Move your offline data in

Your offline data and the DB share one shape. Export JSON from **Settings**,
then insert each array into its table (a short seed script, or the dashboard
importer). Because ids and timestamps are already present in the export, they
carry straight over.

## 8. Deploy secrets

In the GitHub repo: **Settings → Secrets and variables → Actions** → add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The deploy workflow already
reads them (empty is fine until you add them). Push to `main` to build and
publish.

## Accountability groups (optional)

To enable the shared accountability feature:

1. Run [`../supabase/migrations/0002_accountability_groups.sql`](../supabase/migrations/0002_accountability_groups.sql)
   in the SQL editor (after `0001_init.sql`).
2. Enable new sign-ups: **Authentication → Providers → Email → allow new users
   to sign up**, so a partner can create their own account.
3. Verify privacy after setup, signed in as two different users in one group:
   - `select * from group_summary('<group-id>')` returns a counts row per member.
   - A non-member calling `group_summary` for that group gets zero rows.
   - A member still CANNOT read another member's rows directly:
     `select * from applications` returns only their own (RLS unchanged).

---

### Note on free-tier pausing

Free Supabase projects pause after a stretch of inactivity. If the app looks
dead after a quiet fortnight, that's why — open the dashboard to wake it. Your
regular JSON exports mean a paused (or lost) project never holds your data
hostage.
