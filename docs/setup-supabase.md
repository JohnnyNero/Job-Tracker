# Turning on cross-device sync

The app works fully offline (localStorage). Cross-device sync is **already built
in** — it just needs a free Supabase project and two public keys. Once those are
set, you sign in with an email magic link in **Settings → Sync across devices**,
and your board follows you between phone and laptop automatically.

The order matters: **stand up the database and prove RLS works before the app
talks to it.** The anon key is public; RLS is the only thing between your data
and the world.

## What sync actually does

Your whole dataset already lives as one JSON blob (the same shape as the
Settings JSON export). Sync mirrors that blob to **one row per user** in a
`user_state` table (see [`../supabase/migrations/0002_sync.sql`](../supabase/migrations/0002_sync.sql)),
guarded by RLS so only you can read it. On each device the app keeps working on
its instant local copy and, in the background, **pushes** changes up (debounced)
and **pulls + merges** changes down (live, via realtime). The merge is a union
by row id — so *an add on one device is never lost on the other* — with the
newer copy winning when the same record was edited in two places. It stays fully
offline-capable; sync is a background layer on top.

> This is deliberately simpler than mirroring all twelve relational tables. For
> one person moving between devices it's the safer trade. The relational schema
> in `0001_init.sql` remains for a possible future full migration and is **not
> required** for sync.

## 1. Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a project (free
   tier is fine). Pick a region near you.
2. From **Project Settings → API**, note two values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

   Both are safe to expose. The **`service_role`** key on the same page is not —
   never put it in this repo, a committed `.env`, or a CI step.

## 2. Run the sync schema

Open **SQL Editor**, paste the contents of
[`../supabase/migrations/0002_sync.sql`](../supabase/migrations/0002_sync.sql),
and run it. This creates the `user_state` table, enables RLS with an `own rows`
policy, installs a trigger that stamps `user_id`/`updated_at`, and adds the table
to the realtime publication so the other device updates live. (You can also run
`0001_init.sql` first if you want the full relational schema in place for later —
sync doesn't need it.)

## 3. Verify RLS — before trusting it

Don't assume RLS is on; prove it. With your URL and anon key, run a scratch Node
script signed-out:

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(URL, ANON_KEY) // no auth = anonymous
const { data, error } = await supabase.from('user_state').select('*')
console.log({ rows: data?.length, error })
// Expect rows: 0. If you can read rows unauthenticated, STOP and fix RLS.
```

## 4. Turn on email magic-link auth

1. **Authentication → Providers → Email**: keep it enabled (magic links work out
   of the box; you don't need to enable passwords).
2. **Authentication → URL Configuration → Redirect URLs**: add your app's URL so
   the magic link is allowed to return to it. For GitHub Pages that's:

   ```
   https://<your-github-username>.github.io/Job-Tracker/
   ```

   (Add `http://localhost:5173/Job-Tracker/` too if you want to test sync in
   `npm run dev`.)
3. Optional: once you've signed in once, turn **off** new sign-ups so only you
   can get in. There's no multi-user concept here; RLS scopes everything to your
   `auth.uid()`.

## 5. Add the two repo secrets and deploy

In GitHub: **Settings → Secrets and variables → Actions** → add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The deploy workflow already
reads them. Re-run the deploy (push to `main`, or run the **Deploy to GitHub
Pages** workflow) so the published build carries the keys.

That's it — the sync code is already in the app.

## 6. Sign in on each device

Open the app → **Settings → Sync across devices** → enter your email → click the
link it sends. Do this on **both** your phone and laptop with the **same email**.
The first device seeds the cloud from what's already on it; the second pulls it
down and merges. From then on, changes flow both ways in the background.

Your existing offline data isn't lost: the first device to sign in pushes its
local board up, so whatever you already had becomes the cloud copy.

---

### Notes

- **Backups still matter.** Sync is not a backup — a bad edit syncs everywhere.
  Keep exporting JSON from Settings now and then. The app also snapshots an undo
  point before adopting a merge, so a surprising first sync is reversible.
- **Free-tier pausing.** Free Supabase projects pause after a stretch of
  inactivity; if sync looks dead after a quiet fortnight, open the dashboard to
  wake it. Offline still works throughout, and your JSON exports mean a paused or
  lost project never holds your data hostage.
- **CV files.** File upload to Supabase Storage isn't part of blob sync (the CV
  builder assembles from data that *is* synced). A private `cvs` bucket + signed
  URLs remain a future add-on.
