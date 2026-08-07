-- RLS smoke checks. The point is to prove that a client holding only the public
-- anon key, with no signed-in user, can read NOTHING.
--
-- The most trustworthy check is from an actual signed-out client (see
-- docs/setup-supabase.md for a 10-line Node snippet). These SQL checks are a
-- second line of defence you can run in the Supabase SQL editor.

-- 1) Every app table must have RLS enabled. Expect rowsecurity = true for all.
select relname as table, relrowsecurity as rls_enabled
from pg_class
where relname in (
  'capabilities','role_profiles','evidence','cv_versions',
  'applications','application_evidence','criteria','events'
)
order by relname;

-- 2) Every table must have the "own rows" policy. Expect 8 rows.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename;

-- 3) Simulate an anonymous request. With RLS on and no auth.uid(), these must
-- all return 0. Switching to the 'anon' role means no JWT, so auth.uid() is null
-- and the "own rows" policy matches nothing.
set role anon;
select 'applications' as t, count(*) from applications
union all select 'evidence', count(*) from evidence
union all select 'events', count(*) from events
union all select 'role_profiles', count(*) from role_profiles;
reset role;

-- If any count above is non-zero under the anon role, STOP and fix RLS before
-- deploying — your data would be world-readable.
