-- Accountability groups: aggregate-only sharing between members.
--
-- Privacy model: raw tables (applications, evidence, events, …) keep their
-- owner-only RLS from 0001. The ONLY cross-user data flow is aggregate counts
-- plus display names, returned by the SECURITY DEFINER functions below.
-- Run this in the Supabase SQL editor after 0001. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Membership helper (SECURITY DEFINER breaks RLS recursion on group_members)
-- ---------------------------------------------------------------------------

create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles       enable row level security;
alter table groups         enable row level security;
alter table group_members  enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "member sees group" on groups;
create policy "member sees group" on groups
  for select using (is_group_member(id));

drop policy if exists "create group" on groups;
create policy "create group" on groups
  for insert with check (created_by = auth.uid());

drop policy if exists "see co-members" on group_members;
create policy "see co-members" on group_members
  for select using (is_group_member(group_id));

drop policy if exists "join self" on group_members;
create policy "join self" on group_members
  for insert with check (user_id = auth.uid());

drop policy if exists "leave self" on group_members;
create policy "leave self" on group_members
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Create / join (SECURITY DEFINER so RETURNING and code lookup work cleanly)
-- ---------------------------------------------------------------------------

-- One group at a time: both create and join drop the caller's existing
-- membership first. The caller only ever acts as themselves via auth.uid().
create or replace function create_group(p_name text, p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  delete from group_members where user_id = auth.uid();
  insert into groups (name, invite_code, created_by)
    values (p_name, p_code, auth.uid())
    returning * into g;
  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

create or replace function join_group(p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
  n int;
begin
  select * into g from groups where invite_code = p_code;
  if g.id is null then
    raise exception 'No group found for that code';
  end if;
  -- Serialize concurrent joins to this group so the cap check is race-free.
  perform 1 from groups where id = g.id for update;
  select count(*) into n from group_members where group_id = g.id;
  if n >= 10 then
    raise exception 'That group is full';
  end if;
  delete from group_members where user_id = auth.uid();
  insert into group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- The aggregate summary — the only place application data crosses users.
-- Returns counts + display names, never a raw row.
-- ---------------------------------------------------------------------------

create or replace function group_summary(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  applied_this_week int,
  active int,
  overdue int,
  interviews int,
  offers int
)
language sql
security definer
set search_path = public
as $$
  select
    gm.user_id,
    coalesce(p.display_name, 'Member') as display_name,
    count(a.id) filter (where a.applied_on >= current_date - 7)::int,
    count(a.id) filter (where a.stage <> 'closed')::int,
    count(a.id) filter (where a.stage <> 'closed' and a.next_action_at < current_date)::int,
    count(a.id) filter (where a.stage in ('interview','final_stage'))::int,
    (count(a.id) filter (where a.stage = 'offer')
      + count(a.id) filter (where a.stage = 'closed' and a.outcome = 'accepted'))::int
  from group_members gm
  left join profiles p on p.user_id = gm.user_id
  left join applications a on a.user_id = gm.user_id
  where gm.group_id = p_group_id
    and is_group_member(p_group_id)  -- caller must belong, else zero rows
  group by gm.user_id, p.display_name;
$$;
