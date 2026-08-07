# Design review & streamlining plan

A deep critique of Job Tracker against the competitive landscape, documented job-seeker
pain points, and UI/UX best practice — with a prioritised plan to make it faster to use
and harder to abandon. Sources are linked inline; treat individual star-ratings and
percentages as directional.

---

## 1. The one problem to design against

Every decision here serves a single goal, and it's the same one in `CLAUDE.md`: **the board
must still be in use in six weeks.** That failure mode is externally confirmed and quantified:

- **~87% of job seekers start with a detailed spreadsheet and most abandon it within six
  weeks** — because they track too much or too little and it doesn't connect to a next action.
  A 25-column tracker means *"you spend more time updating the sheet than searching for jobs."*
  ([CV Anywhere](https://cvanywhere.com/blog/why-job-seekers-quit-spreadsheets))
- **The "20-minute breaking point":** ~60% of seekers abandon an application (or the tooling
  around it) once it becomes too time-consuming.
  ([Forbes](https://www.forbes.com/sites/bryanrobinson/2026/06/01/the-20-minute-breaking-point-when-job-seekers-ditch-applications/))
- The tracking burden bites hardest at **10–20 active applications**, where bookkeeping becomes
  a daily time-drain. ([Careerflow](https://www.careerflow.ai/blog/job-tracker-apps-vs-spreadsheets))

So the two levers that matter most are **(a) make capture nearly free** and **(b) make the tool
tell you what needs doing** so it never silently goes stale. Almost everything below is one of
those two.

---

## 2. What this app already gets right (don't lose these)

The research is unusually kind to our core bets:

- **Archived ad text beats dead links.** Postings expire on timers (Indeed free posts ~30 days;
  many vanish within days of filling), so a saved *link* 404s and people lose the JD for interview
  prep — they resort to the Wayback Machine.
  ([jobspipe](https://jobspipe.dev/blog/find-expired-job-postings)) We already paste-and-keep the
  ad. This is a genuine, under-served differentiator — lean into it.
- **A reusable, capability-tagged evidence bank linked to per-role criteria is unique.** The STAR
  "story bank" idea is well established (5–8 stories cover ~80% of behavioural questions — *build
  once, reuse forever*: [CVPilot](https://cvpilot.pro/blog/career-story-bank-star-stories-reuse)),
  but story banks and trackers are always *separate tools*. **Nobody links a capability-tagged
  evidence library to extracted per-application criteria.** That's our moat.
- **Table, not kanban.** Kanban's manual card-dragging is a documented ceiling for Huntr/Trello
  past ~20–30 apps. A sortable table is the correct choice for scanning and comparing — keep it.
- **Offline-first / own-your-data.** The loudest complaints in the whole category are about
  *pricing and trust*: weekly billing, opaque pricing, no-refund policies, hard cancellation,
  credits that don't roll over, support black holes (Huntr, Teal, Simplify+). Our stance is a
  differentiator, not a limitation.
- **Local-first speed + save-on-blur inline editing** are the two hardest things to retrofit, and
  we have them. Best-in-class apps (Linear, Superhuman) win largely on perceived instant-ness and
  no-modal inline editing. ([performance.dev on Linear](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown))

**Implication:** the highest-return work is *not* new surface area — it's removing friction around
what we already have.

---

## 3. Competitive landscape (abridged)

| Tool | Loved for | Complaints (anti-patterns to avoid) |
|---|---|---|
| **Huntr** | Kanban pipeline, Chrome autofill, AI resume tailoring | Expensive (~$40/mo), hard cancellation, AI credits don't roll over, constant card-dragging ([LoopCV](https://www.loopcv.pro/directory/huntr/), [Wobo](https://www.wobo.ai/blog/huntr-review/)) |
| **Teal** | The **tracker** is near-universally praised; resume/ATS keyword matching | **Weekly billing** (#1 complaint, "rose 44% quietly"); all-in-one surface "borders on overwhelming" ([LoopCV](https://www.loopcv.pro/directory/teal/)) |
| **Simplify** | Free autofill extension (~4.9/5, ~3.7k reviews) | Autofill degrades on Workday/iCIMS/Taleo; **hostile paid billing** → Trustpilot ~3.0 ([AutoApplier](https://www.autoapplier.com/blog/simplify-jobs)) |
| **Careerflow** | All-in-one hub incl. contacts + follow-up reminders | Breadth over depth; tracker capped at 10 saved jobs free ([Jobright](https://jobright.ai/blog/careerflow-review-2026-features-pricing-and-user-experience/)) |
| **Sheets / Notion / Airtable** | Free, own your data, familiar | Clunky as the search grows; over-structuring causes abandonment; Airtable "overkill" for basic tracking ([LinkinReachly](https://linkinreachly.com/blog/job-application-trackers-compared-spreadsheet-vs-apps/)) |

**Positioning wedge:** the tracker is the loved, low-controversy core of every paid tool, and the
complaints cluster on billing/trust. Be *the thing a spreadsheet-quitter graduates to without a
subscription.*

---

## 4. Cross-tool pain points (what to solve)

1. **Capture friction** — manual entry is the primary reason trackers die (~5–10 min/app; breaking
   point at 10–20 active apps). Every tool that wins does so via one-click capture/autofill.
2. **Staleness with no nudge** — the tracker is passive; nothing says *what needs action today*.
3. **Dead job links** — the source JD disappears. (We already solve this.)
4. **Per-role tailoring fatigue** — rewriting bullets/answers from a blank page every time.
5. **Memory loss** — *"what did I say, to whom, and which version did I send?"*
6. **Follow-up timing uncertainty** — norm is 5–10 business days; stale = 14+, ghosted = 30+.
   ([Sprout](https://www.usesprout.com/blog/track-job-applications))
7. **Coverage blindness** — no view of which requirements you *can't* yet evidence.
8. **Over-structuring backfires** — complexity itself causes abandonment.
9. **Trust / lock-in anxiety** — subscriptions and data-hostage-at-upgrade push people back to Sheets.

---

## 5. Deep critique of the current build

Honest friction points in what we've shipped, mapped to the pains above.

**Capture (pain #1) — our biggest gap.**
- New-application still means typing role + company by hand. The ad-paste box is there, but we
  *don't parse it* — the archived text is a separate action, not a by-product of capture.
- Criteria extraction exists but only after opening the detail screen and clicking "Extract from
  ad." At capture time it's invisible.

**Staleness (pain #2) — the signal is passive.**
- The days-silent colour is computed and shown, but there's no **"Needs you"** list, no follow-up
  date, no snooze, no one-click "log follow-up." The user still has to *notice* amber/red. The
  single best defence against the six-week death is to make the signal an *action queue*.

**Tailoring & memory (pains #4–5).**
- Criteria → evidence linking is fully manual. We already tag evidence by capability — we should
  **suggest** matching evidence per criterion and flag uncovered criteria as gaps (a per-app
  coverage view mirroring the Profile one).
- "Told them" is a single free-text field. It should be an append-only per-stage log (we already
  have an events model) so *what you said to whom* survives.
- We bump `use_count` on copy but don't record **which composed draft** went to which application —
  so "which version did I send here?" is unanswerable months later.

**Discoverability / self-explanatory-ness (UX).**
- Keyboard shortcuts exist on the pipeline but are effectively **invisible** — only a small nav
  hint and the `?` overlay. Returning users won't rediscover them. Linear's lesson: *show the key
  inline on hover/focus.* ([925studios](https://www.925studios.co/blog/linear-design-breakdown-saas-ui-2026))
- No **command palette**. A ⌘K palette is the universal escape hatch in every fast app and doubles
  as feature discovery; it's also the natural mobile action surface.
  ([Superhuman](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/))
- **Visual hierarchy**: our field labels are uppercase and fairly prominent; Refactoring UI's rule
  is *labels are secondary — let the data be loudest*, and cap at 2–3 font weights / a small colour
  set. Quieting labels would make the dense forms calmer.
  ([Refactoring UI notes](https://gist.github.com/selcukcihan/b9418596a98abfcd4bbc622550820cc5))

**Switching cost (pain #9).**
- No CSV/Sheets **import**. The dominant migration path in this market is *from* a spreadsheet; our
  Dataset already matches our JSON export, so an import mapper is cheap and removes the re-typing
  wall for exactly the users most likely to adopt us.

**Responsive (now fixed to "fits", not yet "designed for touch").**
- Every screen now collapses to one column with no sideways scroll. Two refinements remain, per
  best practice: the **three-pane composer should become tabbed** (Criteria | Evidence | Draft)
  rather than a long stack, and the **master-detail screens** (Evidence, Profiles) should
  *drill-in* (list → editor → back) instead of stacking both.
  ([Oracle Alta master-detail](https://www.oracle.com/webfolder/ux/mobile/pattern/masterdetail.html))

---

## 6. Streamlining plan (prioritised)

Ranked by *impact on the stale-in-six-weeks failure ÷ effort*, scoped to the offline-first,
store-mediated architecture.

### Tier 1 — Kill capture friction · ✅ shipped
1. **Paste-to-create.** ✅ One paste of the ad heuristically fills role, company, location, and
   salary (offline parser in `src/lib/parseAd.ts`; first-line + label + money-regex heuristics),
   without clobbering manual edits, and archives the text we already store. A 5–10-minute entry is
   now one paste.
2. **Minimal required fields.** ✅ Role is the only required field; everything else is optional and
   inline-editable. New rows are never gated behind a full form.
3. **Auto-extract criteria at capture.** ✅ On create, the ad is split into a criteria checklist for
   the new application, so our best structural feature is zero-effort output.

### Tier 2 — Turn "days silent" into an action queue · ✅ shipped
4. **A "Needs you" triage view.** ✅ A ranked panel at the top of the pipeline (and a "need you"
   tally): follow-up-due, stale (≥14d), ghosted (≥30d), and closing-soon drafts, each with one-click
   *Log follow-up* (adds a contact event and pushes the nudge +1 week), *Snooze 1wk*, and *Mark
   ghosted*. Logic in `src/lib/triage.ts`; empty state is a green "all caught up".
5. **Per-application `next_action_at` + snooze.** ✅ New field on applications; entering "Applied"
   auto-sets a follow-up nudge to +7 business days, and a snooze in the future suppresses the
   nudge until then. Schema mirrored in `0001_init.sql`.

### Tier 3 — Make tailoring & memory cheap
6. **Criteria → evidence auto-suggest** by capability tag, with per-app coverage gaps flagged. This
   is the feature *no competitor has*.
7. **"Told them" → per-stage log** (append-only events) so what you committed to survives.
8. **Snapshot the sent draft** per application; add a "you've reused this bullet in overlapping
   roles" warning alongside `use_count`.

### Tier 4 — Reduce switching cost & prove ROI
9. **CSV/Sheets import** mapped into the Dataset (2-minute migration for spreadsheet-quitters).
10. **A small offline analytics strip** (response rate by stage, apps by profile, median
    days-to-response) — a few tiles, not a 25-column dashboard.

### Cross-cutting UX (self-explanatory & fast)
- **⌘K command palette** driven off store actions, with a visible "⌘K" chip in the header.
- **Inline shortcut hints** (Linear-style, on row hover/focus) + keep the `?` overlay.
- **Quieter labels / hierarchy** — ≤3 weights, small colour set, data louder than labels.
- **Feedback inside the 400 ms Doherty window** (we're already local-first; keep optimistic writes
  when Supabase lands). ([Laws of UX — Doherty](https://lawsofux.com/doherty-threshold/))
- **Composer tabs on mobile; drill-in master-detail on mobile.**

### Explicitly don't
- **No kanban** (manual dragging is a documented scaling ceiling — the table is correct).
- **Don't grow the field count** — every new field must be optional or derived.
- **No billing/lock-in anti-patterns** — our own-your-data stance is the marketing asset.

---

## 7. UI principles to make it self-explanatory

Load-bearing rules, applied to this app:

- **Recognition over recall** (Nielsen #6): show the current stage as a chip, show shortcut keys in
  place, never make the user remember something from another screen.
  ([IxDF](https://ixdf.org/literature/topics/recognition-vs-recall))
- **Progressive disclosure**: collapse rarely-touched fields (advanced/notes) so the common path is
  short. ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/))
- **Hick's + Fitts's laws**: one primary action per view; make it big and close; demote the rest;
  ≥44px touch targets. ([Laws of UX — Hick](https://lawsofux.com/hicks-law/),
  [Fitts](https://lawsofux.com/fittss-law/))
- **Hierarchy via weight & colour, not size alone**; **de-emphasise labels, let data speak.**
  ([Refactoring UI](https://www.sglavoie.com/posts/book-summary-refactoring-ui/))
- **Empty states that teach** — what this is + the single next action (+ opt-in sample). We already
  do this; keep them action-oriented. ([Pencil & Paper](https://www.pencilandpaper.io/articles/empty-states))
- **Follow conventions** (Jakob's Law) unless breaking one is an obvious, easy-to-learn win.
- **Break responsive layouts where the content breaks**, not at device names; fluid type with
  `clamp()`; body text ≥16px on mobile; line length ~45–75ch for the ad pane and evidence editor.
  ([NN/g breakpoints](https://www.nngroup.com/articles/breakpoints-in-responsive-design/))

---

## 8. Screen-by-screen

- **Pipeline:** right-align date/count columns; keep grid lines quiet; make the **days-silent
  signal the loudest scannable thing** with a non-colour backup (icon/label) for accessibility;
  explicit active-sort caret. Mobile: horizontal scroll with a *frozen* role column is the
  best-practice alternative to the current column-hiding — consider it if hidden columns are missed.
  ([NN/g Mobile Tables](https://www.nngroup.com/articles/mobile-tables/))
- **Application detail:** quieten labels; progressively disclose rare fields; constrain the ad
  column to ~45–75ch. (Stacks correctly on mobile now.)
- **Evidence bank:** drill-in on mobile; inline-edit on blur (already). 
- **Profiles / coverage:** treat coverage as a scannable matrix with a *visible* legend.
- **Composer:** make the active filter *visible* (chips) so the user recognises why evidence is
  filtered; **tabbed panes on mobile.**
- **Criteria checklist:** lean into its natural clarity — big toggles, a visible "3/7 met" progress
  indicator, keyboard toggling.

---

## 9. Top 5 to do next

1. **Paste-to-create with heuristic parse + auto-extract criteria** (Tier 1) — the single biggest
   friction cut.
2. **"Needs you" triage view + `next_action_at`/snooze** (Tier 2) — the single best anti-staleness
   move.
3. **⌘K command palette + inline shortcut hints** — the biggest discoverability win.
4. **Criteria → evidence auto-suggest + per-app coverage** — activate the moat.
5. **CSV import** — remove the switching wall for spreadsheet-quitters.

> **One line:** we already own the two hardest-won differentiators in this market (archived ad text
> and a capability-tagged evidence library linked to per-role criteria). The work now is to make
> *capture nearly free* and *turn the days-silent signal into an active queue* — the exact
> six-week failure mode the research confirms and `CLAUDE.md` names.

*Sources are linked inline. Some primary domains (nngroup.com, lawsofux.com, Reddit, G2) were not
directly fetchable during research due to network policy; their content came from search-result
digests and corroborating reachable pages — verify specifics before quoting externally.*
