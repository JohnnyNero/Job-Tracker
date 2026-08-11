-- Job Tracker — cross-device sync (magic-link auth).
--
-- Run this in the Supabase SQL editor AFTER 0001_init.sql.
--
-- Design note: this app is a single-user, offline-first tracker whose whole
-- dataset already lives as one JSON blob in localStorage (the exact shape of the
-- JSON export). Rather than mirror all twelve relational tables online — which
-- would mean making every mutation async and reconciling per-row conflicts — we
-- sync that same blob to ONE row per user here. It's last-writer-wins with a
-- union merge on the client (see src/lib/merge.ts), which is the right trade for
-- one person moving between a phone and a laptop: adds are never lost, and the
-- board stays instant and fully offline-capable. The relational schema in
-- 0001_init.sql remains for a future full migration; it is untouched by this.
--
-- Security: the anon key is public, so RLS is load-bearing. This row is scoped
-- to auth.uid() exactly like every table in 0001. Verify with a signed-out
-- client before trusting it.

create table if not exists user_state (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  -- The entire Dataset (same shape as the JSON export / localStorage blob).
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_state enable row level security;

-- Postgres has no "create policy if not exists"; drop then create so re-running
-- this file is safe.
drop policy if exists "own rows" on user_state;
create policy "own rows" on user_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep updated_at current on every write, and force user_id to the caller so a
-- client can never write a row for someone else even if it tries.
create or replace function user_state_before_write()
returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_state_before_write on user_state;
create trigger user_state_before_write
  before insert or update on user_state
  for each row execute function user_state_before_write();

-- Let clients receive realtime row changes (so the other device updates live).
-- Safe to run repeatedly; ignore the "already member" error if it re-runs.
do $$
begin
  alter publication supabase_realtime add table user_state;
exception when duplicate_object then null;
end $$;
