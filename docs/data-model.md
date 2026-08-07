# Data model

The types in `src/types.ts` and the tables in
`supabase/migrations/0001_init.sql` are the same model, one in TypeScript and
one in Postgres. Keep them in lockstep.

## The one design decision everything hangs off

I apply for a **variety of roles**, not one type. So:

- Evidence about me is stored **once**, neutrally, with the real specifics.
- It is tagged by **capability** (cost control, rota and scheduling, handling
  conflict) — never by industry. Industry tags die the moment I apply outside a
  sector.
- **Role profiles** hold the framing: positioning, which capabilities matter,
  the vocabulary a sector uses. Framing lives in the profile; facts live in the
  evidence.
- A CV bullet and an interview answer are the **same evidence at different
  lengths** — one `evidence` row with a `bullet` field and a `full_text` field,
  not two features.

There are deliberately **no per-sector copies** of an evidence item.

## Entities

- **capabilities** — the curated vocabulary (~15–25). Kept as a table so the UI
  offers a picker instead of free-typing near-duplicates.
- **role_profiles** — framing per kind of role. `priority_capabilities` is an
  array of capability *names*.
- **evidence** — the bank. `bullet` (CV length) + `full_text` (answer length),
  `capabilities[]`, `use_count`, `last_used_at`.
- **cv_versions** — finished files actually sent. Roughly one base CV per
  profile. `file_path` is a name/link offline, a Storage path online.
- **applications** — the core record. Stage, outcome, the archived `ad_text`,
  `told_them` (what you committed to on a call), and `next_action_at` (the
  follow-up nudge / snooze that drives the "Needs you" triage queue; auto-set to
  +7 business days on entering `applied`).
- **application_evidence** — join: which evidence went into which application.
- **criteria** — ad criteria checklist (Phase 4).
- **events** — the timeline: automatic `stage` rows plus manual `note`/`contact`.

## Stage & outcome lifecycle

Stages, in order:

```
drafting → applied → acknowledged → shortlisted → interview → final_stage → offer → closed
```

- **Stage** is where a live application is. **Outcome** is only meaningful once
  `stage = 'closed'`, and is one of `rejected | withdrew | no_response |
  accepted`. `no_response` is a first-class ending, not an afterthought — it's
  probably the most common one.
- Closing records **`closed_from_stage`** — the stage it died at. Knowing *where*
  applications die is the single analytic worth having.
- Reopening a closed application clears the outcome and `closed_from_stage`.

These rules are enforced in two places that must agree:
- offline: `src/store/mutations.ts` (`changeStage`, `closeApplication`)
- online: triggers in `0001_init.sql` (`applications_before_update`,
  `applications_log_stage`)

## The days-silent signal

`src/lib/dates.ts` → `daysSignal(app)` drives the pipeline's "Days" column:

- stage `applied` or `acknowledged` → days since `applied_on`, labelled
  **silent**. Neutral under 10 days, **amber** 10–20, **red** at 21+.
- stage `drafting` with `closes_on` set → days until it closes, **amber** inside
  3 days.
- otherwise → blank.

## Row Level Security

Every table has RLS enabled with the same `own rows` policy
(`user_id = auth.uid()`), because the anon key is public. `user_id` defaults to
`auth.uid()` on insert. Details and verification steps in
[setup-supabase.md](setup-supabase.md).
