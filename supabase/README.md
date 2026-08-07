# Supabase

Nothing here runs until you decide to go online. The app is fully functional
offline (localStorage). See [`../docs/setup-supabase.md`](../docs/setup-supabase.md)
for the full walkthrough.

- `migrations/0001_init.sql` — schema, RLS policies, and triggers. Run this
  first, in the Supabase SQL editor.
- `verify_rls.sql` — paste-in checks to confirm a signed-out client reads
  nothing. **Do this before shipping app code** — do not assume RLS is on.

## Quick version

1. Create a free Supabase project.
2. Run `migrations/0001_init.sql` in the SQL editor.
3. Run the checks in `verify_rls.sql` and confirm the signed-out reads return
   zero rows.
4. Create a Storage bucket named `cvs` (private) for CV files.
5. Add repo secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Wire the Supabase data store (template in
   [`../docs/supabase-store-template.ts`](../docs/supabase-store-template.ts)).

The `service_role` key never goes in this repo, in any `.env`, or in CI.
