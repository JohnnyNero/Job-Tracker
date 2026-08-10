# Accountability groups — design

**Date:** 2026-08-10
**Status:** Approved (design), pending implementation

## Goal

Let a small group of users (e.g. two partners) hold each other accountable in
the job hunt by sharing **aggregate progress numbers only** — never raw data.
Companies, notes, salary, evidence, and CVs stay private to their owner. Members
join a group via an invite code and see one another's accountability cards.

This builds on the existing Supabase online mode (magic-link auth, RLS scoped to
`auth.uid()`). Offline localStorage mode is unaffected.

## Privacy principle (the load-bearing constraint)

Raw rows never cross between users. The existing per-table RLS (`user_id =
auth.uid()`) stays exactly as-is and owner-only. The **only** cross-user data
flow is a set of aggregate counts, produced by a single `SECURITY DEFINER`
function that returns counts — never an application, event, or note row.

## Data model (new tables)

### `profiles`
- `user_id uuid primary key references auth.users on delete cascade`
- `display_name text not null`
- `created_at timestamptz not null default now()`
- RLS: a user may `select`/`insert`/`update` **their own** profile
  (`user_id = auth.uid()`). Display names of other members are exposed only via
  the summary function, not by direct select.

### `groups`
- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `invite_code text not null unique` — short random (e.g. 8 chars, base32,
  ambiguous characters removed), generated client-side and retried on the rare
  unique-collision.
- `created_by uuid not null default auth.uid() references auth.users`
- `created_at timestamptz not null default now()`
- RLS: a member may `select` groups they belong to. `insert` allowed for the
  authenticated creator. (No direct update/delete in v1.)
- Note: joining by code cannot use a direct `select` (a non-member is not
  allowed to read the group yet). Joining therefore goes through the
  `join_group` `SECURITY DEFINER` RPC below, which resolves the code without
  exposing group listings.

### `group_members`
- `group_id uuid not null references groups on delete cascade`
- `user_id uuid not null default auth.uid() references auth.users on delete cascade`
- `joined_at timestamptz not null default now()`
- `primary key (group_id, user_id)`
- RLS: a user may `select` membership rows of groups they belong to; may
  `insert` their **own** membership (`user_id = auth.uid()`); may `delete` their
  **own** membership (leave).

**One group at a time:** enforced in app logic (join/create leaves any existing
membership first). Not a DB constraint — keeps the schema simple.

## The summary function (`SECURITY DEFINER`)

```
group_summary(p_group_id uuid) returns table (
  user_id uuid,
  display_name text,
  applied_this_week int,
  active int,
  overdue int,
  interviews int,
  offers int
)
```

Behaviour:
1. Reject unless `auth.uid()` is a member of `p_group_id` (guard clause; raise or
   return no rows).
2. For each member of the group, compute over **that member's** applications:
   - `applied_this_week` — applications with `applied_on >= current_date - 7`.
   - `active` — `stage <> 'closed'`.
   - `overdue` — `stage <> 'closed'` and `next_action_at < current_date`.
   - `interviews` — `stage = 'interview'` (also counts `final_stage`? v1: just
     `interview` and `final_stage` combined — see Decisions).
   - `offers` — `stage = 'offer'`, plus closed with `outcome = 'accepted'`.
3. Return one row per member with their `display_name` from `profiles`.

Invoked from the client via `supabase.rpc('group_summary', { p_group_id })`.
The function is the ONLY place that reads across users' *application* data, and
it returns counts plus display names only.

### `join_group(p_code)` (`SECURITY DEFINER`)

```
join_group(p_code text) returns groups
```

Resolves the invite code to a group without a member-only `select` blocking a
newcomer. Behaviour: look up the group by `invite_code`; raise a clear error if
none; reject if the group is at the size cap; delete the caller's existing
membership rows (one-group-at-a-time); insert `(group_id, auth.uid())`; return
the group row. All under the caller's identity via `auth.uid()`, so a user can
only ever join *themselves*.

## App changes

### New store surface (online only)
Extend the Supabase-backed store (or a small dedicated `groupsClient.ts`) with:
- `getMyGroup(): Promise<Group | null>` — the caller's current group (+ members
  count) or null.
- `createGroup(name): Promise<Group>` — leaves any existing group, inserts group
  + own membership, returns it.
- `joinGroup(code): Promise<Group>` — wraps the `join_group` RPC (resolves code,
  leaves existing, joins) and returns the group.
- `leaveGroup(): Promise<void>`.
- `fetchSummary(groupId): Promise<MemberSummary[]>` — wraps the RPC.
- `getMyProfile()/setDisplayName(name)`.

### New "Group" page
- **Not in a group:** two actions — *Create group* (name → shows generated
  invite code) and *Join group* (enter code).
- **In a group:** the group name + invite code (copyable), a *Leave group*
  button, and a card per member showing the four/five stats. Your own card is
  included and clearly marked "You".
- Empty/loading/error states handled inline.

### Settings
- A **Display name** field (used on your card). Prompt for it the first time a
  signed-in user has no profile.

### Offline mode
- The Group page is hidden/disabled when `isOnline` is false (the whole feature
  requires Supabase). No offline behaviour changes.

### Auth
- New user **sign-ups must be enabled** in Supabase (Authentication → Providers
  → Email) so a partner can create an account. (Operator step, documented.)

## Error handling

- RPC / query failures surface as a non-blocking inline error on the Group page;
  the rest of the app is unaffected.
- Joining with an unknown code shows "No group found for that code."
- Leaving/creating/joining refetch the group state to reconcile.

## Testing

- **Pure unit tests (Vitest):** invite-code generator (length, alphabet,
  excluded ambiguous chars); any client-side summary shaping/formatting helper.
- **SQL-level verification (manual, documented):** as two separate signed-in
  users in one group, confirm `group_summary` returns both members' counts;
  confirm a non-member calling `group_summary` for that group gets nothing;
  confirm a member still cannot `select` another member's `applications` rows
  directly (RLS unchanged). This is the privacy proof and must be run before use.
- **Backend-switch test:** Group feature is gated on `isOnline`.

## Decisions (defaults; revisit if wrong)

- One group per user at a time (app-enforced).
- "This week" = rolling last 7 days (`applied_on >= current_date - 7`).
- Group size cap ~10 (enforced softly in `joinGroup`).
- `interviews` counts both `interview` and `final_stage`; `offers` counts
  `stage = 'offer'` plus closed-accepted.

## Out of scope (YAGNI for v1)

- Nudges / pokes, comments, reactions.
- Historical trend charts (only current snapshot counts).
- Per-application selective sharing.
- Multiple simultaneous group memberships.
- Group admin roles / removing other members / renaming groups.
