-- Job Tracker — initial schema, RLS, and triggers.
--
-- Run this in the Supabase SQL editor (or via the CLI) BEFORE deploying app
-- code that talks to Supabase. Then verify RLS with a signed-out client
-- (see docs/setup-supabase.md) — do not assume RLS is on just because this ran.
--
-- Security model: the anon key ships in the client bundle and is public.
-- Every table therefore has RLS enabled with policies scoped to auth.uid().
-- Single user (you), Supabase magic-link auth. The service_role key must never
-- appear in this repo or in CI.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Canonical capability vocabulary. Small, hand-curated, ~15-25 entries.
create table if not exists capabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null unique,          -- "cost control", "handling conflict"
  note text                           -- what I mean by it, for my own consistency
);

-- Role profiles: the framing layer.
create table if not exists role_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,                 -- "General operations manager"
  positioning text,                   -- the two-line pitch for this kind of role
  priority_capabilities text[] not null default '{}',
  vocabulary text,                    -- terms this sector uses; free text notes
  created_at timestamptz not null default now()
);

-- Evidence bank: bullets and answers are the same thing at different lengths.
create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,                -- "Rebuilt the kitchen prep rota"
  bullet text,                        -- one line, CV length
  full_text text,                     -- situation / action / result, answer length
  capabilities text[] not null default '{}',
  when_happened text,                 -- free text; "2024", "first year at the cinema"
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists evidence_capabilities_gin on evidence using gin (capabilities);

-- CV locker: the finished files I actually sent.
create table if not exists cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  label text not null,                -- "ops-v3"
  profile_id uuid references role_profiles on delete set null,
  angle text,                         -- what this version leans into
  file_path text,                     -- Supabase Storage path
  is_current boolean not null default false,
  layout jsonb,                       -- assembled CV document (CV builder)
  created_at timestamptz not null default now()
);

-- CV builder: "about you" (one row per user), work history, and education.
-- Bullets under each experience live in cv_versions.layout, so different CV
-- versions can emphasise different achievements from the same history.
create table if not exists person (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  full_name text not null default '',
  headline text,
  email text,
  phone text,
  location text,
  links text[] not null default '{}',
  summary text,
  skills text[] not null default '{}'
);

create table if not exists cv_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company text not null default '',
  title text not null default '',
  location text,
  start text,
  "end" text,
  position int not null default 0
);

create table if not exists cv_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  institution text not null default '',
  qualification text,
  field text,
  start text,
  "end" text,
  note text,
  position int not null default 0
);

-- Applications
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null,
  company text,
  profile_id uuid references role_profiles on delete set null,
  stage text not null default 'drafting'
    check (stage in ('drafting','applied','acknowledged','shortlisted',
                     'interview','final_stage','offer','closed')),
  outcome text                        -- set only when stage = 'closed'
    check (outcome is null or outcome in ('rejected','withdrew','no_response','accepted')),
  closed_from_stage text,             -- which stage it died at; set by trigger on close
  source text,                        -- Indeed, LinkedIn, direct, referral
  link text,
  ad_text text,                       -- archived at capture; the listing will 404
  location text,
  salary_stated text,                 -- free text; ranges and "competitive" both happen
  applied_on date,
  closes_on date,
  next_action_at date,               -- follow-up nudge / snooze; drives the triage queue
  cv_version_id uuid references cv_versions on delete set null,
  told_them text,                     -- salary quoted, notice period, anything committed to
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which evidence went into which application
create table if not exists application_evidence (
  application_id uuid not null references applications on delete cascade,
  evidence_id uuid not null references evidence on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (application_id, evidence_id)
);

-- Criteria pulled from the ad (phase 4)
create table if not exists criteria (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null,
  essential boolean not null default true,
  covered_by uuid references evidence on delete set null,
  position int not null default 0
);

-- Interview questions to rehearse (interview prep mode). Each optionally links
-- to an evidence story you'd tell, and records whether it actually came up.
create table if not exists interview_questions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null,
  covered_by uuid references evidence on delete set null,
  notes text,
  asked boolean not null default false,
  position int not null default 0
);

-- Timeline: stage changes and free-text notes
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('stage','note','contact','told','draft')),
  body text not null,
  occurred_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — same policy shape on every table.
-- ---------------------------------------------------------------------------

alter table capabilities        enable row level security;
alter table role_profiles       enable row level security;
alter table evidence            enable row level security;
alter table cv_versions         enable row level security;
alter table person              enable row level security;
alter table cv_experience       enable row level security;
alter table cv_education        enable row level security;
alter table applications        enable row level security;
alter table application_evidence enable row level security;
alter table criteria            enable row level security;
alter table interview_questions enable row level security;
alter table events              enable row level security;

-- Postgres has no "create policy if not exists"; drop then create so this file
-- is safe to re-run.
drop policy if exists "own rows" on capabilities;
create policy "own rows" on capabilities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on role_profiles;
create policy "own rows" on role_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on evidence;
create policy "own rows" on evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on cv_versions;
create policy "own rows" on cv_versions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on person;
create policy "own rows" on person
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on cv_experience;
create policy "own rows" on cv_experience
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on cv_education;
create policy "own rows" on cv_education
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on applications;
create policy "own rows" on applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on application_evidence;
create policy "own rows" on application_evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on criteria;
create policy "own rows" on criteria
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on interview_questions;
create policy "own rows" on interview_questions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on events;
create policy "own rows" on events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- 1 + 2) Before every update: keep updated_at current, and manage the
-- stage/outcome bookkeeping around closing and reopening.
create or replace function applications_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();

  if new.stage = 'closed' and old.stage is distinct from 'closed' then
    -- record where it died
    new.closed_from_stage := old.stage;
  elsif new.stage <> 'closed' and old.stage = 'closed' then
    -- reopened: clear the closed-only fields
    new.closed_from_stage := null;
    new.outcome := null;
  end if;

  -- Follow-up nudge: when an application first reaches 'applied', default a
  -- next_action_at if none is set. The offline store uses +7 BUSINESS days
  -- (src/store/mutations.ts changeStage); this trigger uses a calendar
  -- approximation. If you need exact parity online, replace with a
  -- business-day calculation.
  if new.stage = 'applied' and old.stage is distinct from 'applied'
     and new.next_action_at is null then
    new.next_action_at := (now() + interval '9 days')::date;  -- ~7 business days
  end if;

  -- Start the days-silent clock: advancing to a waiting stage with no applied
  -- date stamps today (mirrors changeStage in src/store/mutations.ts).
  if new.stage in ('applied','acknowledged') and new.applied_on is null then
    new.applied_on := current_date;
  end if;

  return new;
end $$;

drop trigger if exists applications_before_update on applications;
create trigger applications_before_update
  before update on applications
  for each row execute function applications_before_update();

-- Human labels for stages/outcomes, so the event text a trigger writes matches
-- the offline store's exactly (STAGE_LABELS / OUTCOME_LABELS in src/lib/
-- constants.ts). Keep these three in sync — same two-sources-of-truth rule as
-- the rest of the bookkeeping.
create or replace function stage_label(s text) returns text language sql immutable as $$
  select case s
    when 'drafting' then 'Drafting'
    when 'applied' then 'Applied'
    when 'acknowledged' then 'Acknowledged'
    when 'shortlisted' then 'Shortlisted'
    when 'interview' then 'Interview'
    when 'final_stage' then 'Final stage'
    when 'offer' then 'Offer'
    when 'closed' then 'Closed'
    else coalesce(s, 'unknown')
  end
$$;

create or replace function outcome_label(o text) returns text language sql immutable as $$
  select case o
    when 'rejected' then 'Rejected'
    when 'withdrew' then 'Withdrew'
    when 'no_response' then 'No response'
    when 'accepted' then 'Accepted'
    else coalesce(o, '?')
  end
$$;

-- 3) After a stage change: append a 'stage' event. Stage history is automatic;
-- it is never logged by hand. Body text mirrors changeStage/closeApplication in
-- src/store/mutations.ts so timelines read identically on either backend.
create or replace function applications_log_stage()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into events (application_id, user_id, kind, body, occurred_at)
    values (
      new.id,
      new.user_id,
      'stage',
      case
        when new.stage = 'closed'
          then 'Closed (' || outcome_label(new.outcome) || ') from '
               || stage_label(coalesce(new.closed_from_stage, old.stage))
        when old.stage = 'closed'
          then 'Reopened → ' || stage_label(new.stage)
        else stage_label(old.stage) || ' → ' || stage_label(new.stage)
      end,
      now()
    );
  end if;
  return new;
end $$;

drop trigger if exists applications_log_stage on applications;
create trigger applications_log_stage
  after update on applications
  for each row execute function applications_log_stage();
