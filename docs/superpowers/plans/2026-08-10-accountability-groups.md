# Accountability Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a small group of users share aggregate job-hunt progress numbers (never raw data) via an invite code, to hold each other accountable.

**Architecture:** New `profiles`/`groups`/`group_members` tables. All existing per-table RLS stays owner-only and unchanged. The ONLY cross-user data flow is aggregate counts + display names, returned by `SECURITY DEFINER` Postgres functions (`group_summary`, `join_group`, `create_group`, `is_group_member`). A new online-only "Group" page and a groups client wrap these. Offline localStorage mode is untouched.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, `@supabase/supabase-js` v2, Postgres/Supabase (SQL migration), Vitest for pure units.

## Global Constraints

- Privacy: raw rows never cross users. Existing table RLS (`user_id = auth.uid()`) stays exactly as-is. Cross-user data is ONLY aggregate counts + display names from `SECURITY DEFINER` functions.
- Never reference the `service_role` key anywhere.
- Feature is ONLINE ONLY — every new UI surface is gated on `isOnline` from `src/store/supabaseClient.ts`; offline behaviour must not change.
- Code style: no semicolons, single quotes, 2-space indent, named exports. `npm run typecheck`, `npm test`, `npm run build` must stay clean.
- Fixed business rules: one group per user at a time (enforced in the RPCs by deleting existing membership first); "this week" = `applied_on >= current_date - 7`; group size cap = 10; `interviews` counts stages `interview` + `final_stage`; `offers` counts `stage = 'offer'` plus closed rows with `outcome = 'accepted'`.
- `Dataset`/domain types live in `src/types.ts`. The `supabase` client and `isOnline` are exported from `src/store/supabaseClient.ts`.

---

### Task 1: Invite code generator (pure, TDD)

**Files:**
- Create: `src/lib/inviteCode.ts`
- Test: `src/lib/inviteCode.test.ts`

**Interfaces:**
- Produces: `generateInviteCode(): string` — 8 chars from an unambiguous alphabet (no `0/O/1/I/L`), uppercase.

- [ ] **Step 1: Write the failing test**

`src/lib/inviteCode.test.ts`:
```ts
import { describe, expect, test } from 'vitest'
import { generateInviteCode, INVITE_ALPHABET } from './inviteCode'

describe('generateInviteCode', () => {
  test('is 8 characters', () => {
    expect(generateInviteCode()).toHaveLength(8)
  })

  test('uses only the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      for (const ch of generateInviteCode()) {
        expect(INVITE_ALPHABET).toContain(ch)
      }
    }
  })

  test('excludes ambiguous characters', () => {
    expect(INVITE_ALPHABET).not.toMatch(/[0O1IL]/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- inviteCode`
Expected: FAIL — module not found / not exported.

- [ ] **Step 3: Implement**

`src/lib/inviteCode.ts`:
```ts
// Crockford-ish alphabet with ambiguous glyphs (0 O 1 I L) removed so codes are
// easy to read aloud and type.
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** An 8-character human-friendly invite code. Uniqueness is enforced by the DB
 * unique constraint; callers retry on the rare collision. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += INVITE_ALPHABET[b % INVITE_ALPHABET.length]
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- inviteCode`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inviteCode.ts src/lib/inviteCode.test.ts
git commit -m "feat: add invite code generator"
```

---

### Task 2: SQL migration — tables, RLS, SECURITY DEFINER functions

**Files:**
- Create: `supabase/migrations/0002_accountability_groups.sql`

**Interfaces:**
- Produces (Postgres): tables `profiles`, `groups`, `group_members`; functions `is_group_member(uuid) → boolean`, `create_group(text, text) → groups`, `join_group(text) → groups`, `group_summary(uuid) → setof rows`.

**Note:** This SQL cannot be executed in the build environment. Its "test" is the operator applying it in the Supabase SQL editor and running the verification queries in Task 6. The reviewer verifies SQL correctness by reading it. The task deliverable is the committed, self-consistent migration file.

- [ ] **Step 1: Create the migration file**

`supabase/migrations/0002_accountability_groups.sql`:
```sql
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
  select count(*) into n from group_members where group_id = g.id;
  if n >= 10 then
    raise exception 'That group is full';
  end if;
  delete from group_members where user_id = auth.uid();
  insert into group_members (group_id, user_id)
    values (g.id, auth.uid())
    on conflict do nothing;
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
```

- [ ] **Step 2: Sanity scan (self-review, no execution)**

Confirm by reading: every SECURITY DEFINER function has `set search_path = public`; `group_summary` filters on `is_group_member(p_group_id)` so a non-member gets nothing; only counts/display names are returned (no `a.*` row columns); `create_group`/`join_group` delete existing membership first (one-group rule); cap check uses `>= 10`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_accountability_groups.sql
git commit -m "feat: add accountability groups schema, RLS, and functions"
```

---

### Task 3: Groups client wrapper

**Files:**
- Create: `src/store/groupsClient.ts`

**Interfaces:**
- Consumes: `supabase` from `./supabaseClient`.
- Produces:
  - Types: `Group { id: string; name: string; invite_code: string }`, `MemberSummary { user_id: string; display_name: string; applied_this_week: number; active: number; overdue: number; interviews: number; offers: number }`, `Profile { user_id: string; display_name: string }`.
  - `getMyProfile(): Promise<Profile | null>`
  - `setDisplayName(name: string): Promise<void>`
  - `getMyGroup(): Promise<Group | null>`
  - `createGroup(name: string): Promise<Group>`
  - `joinGroup(code: string): Promise<Group>`
  - `leaveGroup(): Promise<void>`
  - `fetchSummary(groupId: string): Promise<MemberSummary[]>`

- [ ] **Step 1: Implement the module**

`src/store/groupsClient.ts`:
```ts
import { supabase } from './supabaseClient'
import { generateInviteCode } from '../lib/inviteCode'

export interface Group {
  id: string
  name: string
  invite_code: string
}

export interface MemberSummary {
  user_id: string
  display_name: string
  applied_this_week: number
  active: number
  overdue: number
  interviews: number
  offers: number
}

export interface Profile {
  user_id: string
  display_name: string
}

function client() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

async function uid(): Promise<string> {
  const { data, error } = await client().auth.getUser()
  if (error || !data.user) throw new Error('Not signed in')
  return data.user.id
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('user_id, display_name').maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function setDisplayName(name: string): Promise<void> {
  const user_id = await uid()
  const { error } = await client().from('profiles').upsert({ user_id, display_name: name })
  if (error) throw error
}

export async function getMyGroup(): Promise<Group | null> {
  const me = await uid()
  const { data: mem, error: memErr } = await client()
    .from('group_members')
    .select('group_id')
    .eq('user_id', me)
    .maybeSingle()
  if (memErr) throw memErr
  if (!mem) return null
  const { data: g, error: gErr } = await client()
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', mem.group_id)
    .maybeSingle()
  if (gErr) throw gErr
  return g ?? null
}

export async function createGroup(name: string): Promise<Group> {
  // Retry on the rare invite-code unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode()
    const { data, error } = await client().rpc('create_group', { p_name: name, p_code: code })
    if (!error) return data as Group
    if (!String(error.message).toLowerCase().includes('duplicate')) throw error
  }
  throw new Error('Could not generate a unique invite code, please try again')
}

export async function joinGroup(code: string): Promise<Group> {
  const { data, error } = await client().rpc('join_group', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return data as Group
}

export async function leaveGroup(): Promise<void> {
  const me = await uid()
  const { error } = await client().from('group_members').delete().eq('user_id', me)
  if (error) throw error
}

export async function fetchSummary(groupId: string): Promise<MemberSummary[]> {
  const { data, error } = await client().rpc('group_summary', { p_group_id: groupId })
  if (error) throw error
  return (data ?? []) as MemberSummary[]
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. (`rpc(...)` returns loosely-typed data; the `as` casts are expected.)

- [ ] **Step 3: Commit**

```bash
git add src/store/groupsClient.ts
git commit -m "feat: add groups client wrapper"
```

---

### Task 4: Router `group` route + Nav tab + App render

**Files:**
- Modify: `src/router.tsx`
- Test: `src/router.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isOnline` from `./store/supabaseClient`; `Group` page component from `./components/Group` (created in Task 5 — import will resolve once that file exists; do Task 4 then Task 5, or create a temporary stub — see Step 5).
- Produces: `routes.group()` → `'#/group'`; `Route` union includes `{ name: 'group' }`; `parse` exported for tests.

- [ ] **Step 1: Write the failing router test**

`src/router.test.ts`:
```ts
import { expect, test } from 'vitest'
import { parse } from './router'

test('parses #/group to the group route', () => {
  expect(parse('#/group')).toEqual({ name: 'group' })
})

test('parses empty hash to pipeline', () => {
  expect(parse('#')).toEqual({ name: 'pipeline' })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- router`
Expected: FAIL — `parse` not exported / no `group` case.

- [ ] **Step 3: Update `src/router.tsx`**

Add `group` to the union, export `parse`, add the parse case, and add the route builder.

In the `Route` type, add after the `settings` line:
```ts
  | { name: 'group' }
```
Change `function parse(` to `export function parse(`.
In the `switch (parts[0])`, add before `default`:
```ts
    case 'group':
      return { name: 'group' }
```
In the `routes` object, add after `settings`:
```ts
  group: () => '#/group',
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- router`
Expected: PASS.

- [ ] **Step 5: Wire `src/App.tsx`**

Add the import (top, with the other component imports):
```tsx
import { Group } from './components/Group'
import { isOnline } from './store/supabaseClient'
```
Add the route render inside `<main>` after the settings line:
```tsx
        {route.name === 'group' && <Group />}
```
In `Nav`, add an online-only tab. Change the `Nav` signature to also accept nothing extra (it already has `routeName`), and add this tab right after the CV locker tab:
```tsx
      {isOnline && tab(routes.group(), 'Group', routeName === 'group')}
```

(If `./components/Group` does not exist yet, create a one-line placeholder `export function Group() { return null }` so this task builds; Task 5 replaces it.)

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/router.tsx src/router.test.ts src/App.tsx
git commit -m "feat: add group route and online-only nav tab"
```

---

### Task 5: Group page component

**Files:**
- Create/replace: `src/components/Group.tsx`

**Interfaces:**
- Consumes: `getMyGroup`, `createGroup`, `joinGroup`, `leaveGroup`, `fetchSummary`, `getMyProfile`, `setDisplayName`, and types `Group`/`MemberSummary` from `../store/groupsClient`.
- Produces: `Group(): JSX.Element`.

- [ ] **Step 1: Implement the component**

`src/components/Group.tsx`:
```tsx
import { useEffect, useState } from 'react'
import {
  createGroup,
  fetchSummary,
  getMyGroup,
  getMyProfile,
  joinGroup,
  leaveGroup,
  setDisplayName,
  type Group as GroupT,
  type MemberSummary,
} from '../store/groupsClient'

export function Group() {
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<GroupT | null>(null)
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [myName, setMyName] = useState('')
  const [needsName, setNeedsName] = useState(false)

  async function refresh() {
    setError(null)
    try {
      const profile = await getMyProfile()
      setMyName(profile?.display_name ?? '')
      setNeedsName(!profile)
      const g = await getMyGroup()
      setGroup(g)
      setMembers(g ? await fetchSummary(g.id) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (loading) return <div className="page page-narrow"><p className="muted">Loading…</p></div>

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>Group</h1>
      </div>

      {error && <p role="alert" className="section-note" style={{ color: 'crimson' }}>{error}</p>}

      <div className="panel">
        <h2>Your display name</h2>
        <div className="row wrap" style={{ gap: 10 }}>
          <input
            value={myName}
            placeholder="How you appear to the group"
            onChange={(e) => setMyName(e.target.value)}
          />
          <button
            className="btn"
            disabled={!myName.trim()}
            onClick={() => void act(() => setDisplayName(myName.trim()))}
          >
            Save name
          </button>
        </div>
        {needsName && <p className="section-note">Set a display name so your partner can recognise you.</p>}
      </div>

      {!group ? (
        <>
          <div className="panel">
            <h2>Create a group</h2>
            <div className="row wrap" style={{ gap: 10 }}>
              <input value={name} placeholder="Group name" onChange={(e) => setName(e.target.value)} />
              <button
                className="btn primary"
                disabled={!name.trim()}
                onClick={() => void act(() => createGroup(name.trim()))}
              >
                Create
              </button>
            </div>
          </div>
          <div className="panel">
            <h2>Join a group</h2>
            <div className="row wrap" style={{ gap: 10 }}>
              <input value={code} placeholder="Invite code" onChange={(e) => setCode(e.target.value)} />
              <button
                className="btn"
                disabled={!code.trim()}
                onClick={() => void act(() => joinGroup(code.trim()))}
              >
                Join
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel">
            <h2>{group.name}</h2>
            <p className="muted">
              Invite code: <code>{group.invite_code}</code> — share it to add someone.
            </p>
            <button className="btn danger" onClick={() => void act(() => leaveGroup())}>
              Leave group
            </button>
          </div>
          <div className="panel">
            <h2>Accountability</h2>
            {members.length === 0 ? (
              <p className="muted">No members yet.</p>
            ) : (
              <div className="row wrap" style={{ gap: 12 }}>
                {members.map((m) => (
                  <div key={m.user_id} className="panel" style={{ minWidth: 160 }}>
                    <h3 style={{ marginTop: 0 }}>{m.display_name}</h3>
                    <p className="muted">Applied this week: {m.applied_this_week}</p>
                    <p className="muted">Active: {m.active}</p>
                    <p className="muted">Overdue follow-ups: {m.overdue}</p>
                    <p className="muted">Interviews: {m.interviews}</p>
                    <p className="muted">Offers: {m.offers}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/Group.tsx
git commit -m "feat: add Group accountability page"
```

---

### Task 6: Docs — operator steps for groups

**Files:**
- Modify: `docs/setup-supabase.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Append an accountability-groups section**

Add this section near the end of `docs/setup-supabase.md` (before the free-tier note if present):
```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/setup-supabase.md
git commit -m "docs: operator steps for accountability groups"
```

---

## Manual verification (after implementation — needs two real accounts)

1. Apply `0002_accountability_groups.sql`; enable sign-ups.
2. As user A: set a display name, create a group, note the invite code.
3. As user B (second email): set a display name, join with the code.
4. Both see two cards with each other's counts on the Group page.
5. Confirm B cannot read A's applications directly (RLS): the summary shows counts but no raw rows are fetchable.

## Self-Review notes

- **Spec coverage:** tables profiles/groups/group_members (Task 2); `group_summary` + `join_group` + `create_group` + `is_group_member` (Task 2); aggregate-only privacy (Task 2 functions; raw RLS untouched); invite code (Task 1); client surface getMyGroup/createGroup/joinGroup/leaveGroup/fetchSummary/profile (Task 3); Group page create/join/leave/cards + display name (Task 5); online-only gating (Task 4 nav + route); sign-ups + verification docs (Task 6). Metrics = applied-this-week/active/overdue/interviews/offers per spec.
- **Placeholder scan:** none — all steps carry real code.
- **Type consistency:** `Group`, `MemberSummary`, `Profile`, and function names (`getMyGroup`, `createGroup`, `joinGroup`, `leaveGroup`, `fetchSummary`, `setDisplayName`, `getMyProfile`, `generateInviteCode`, `parse`, `routes.group`) are used identically across tasks. RPC names (`create_group`, `join_group`, `group_summary`) match between SQL (Task 2) and client (Task 3).
