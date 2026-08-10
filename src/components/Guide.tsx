import type { ReactNode } from 'react'
import { routes } from '../router'

// A plain-language guide to how the app works. Doubles as onboarding — it's
// linked from the empty pipeline and the nav.
export function Guide() {
  return (
    <div className="page page-narrow guide">
      <div className="page-head">
        <h1>Guide</h1>
        <span className="sub">How the whole thing fits together.</span>
      </div>

      <div className="banner">
        A private, offline job tracker built to survive real use. Everything lives in this browser
        (export a backup any time from <a href={routes.settings()}>Settings</a>). The goal: capturing
        a job is one paste, and nothing ever goes silently stale.
      </div>

      <Section title="The daily loop">
        <ol className="guide-loop">
          <li>
            <b>Open the pipeline.</b> The <b>Needs you</b> panel at the top tells you exactly what to
            chase, snooze, or close today — you never have to hunt.
          </li>
          <li>
            <b>Capture new roles</b> with <Kbd>n</Kbd>: paste the ad and the fields fill themselves.
          </li>
          <li>
            <b>Compose tailored answers</b> from your reusable evidence, criterion by criterion.
          </li>
        </ol>
      </Section>

      <Section title="Finding & capturing jobs">
        <p>
          The app doesn&rsquo;t scrape job boards (that&rsquo;s against their terms and blocked
          anyway) — it makes <b>looking</b> and <b>capturing</b> friction-free.
        </p>
        <ul>
          <li>
            <b>Find jobs</b> (button on the pipeline) builds a search from your keywords and
            location and opens it on Indeed, LinkedIn, Google Jobs, Glassdoor and remote boards in
            one click. <b>Save</b> the searches you run so a weekly re-run is one tap.
          </li>
          <li>
            <b>Clip bookmarklet.</b> From <a href={routes.settings()}>Settings</a>, drag{' '}
            <b>Clip to Job Tracker</b> to your bookmarks bar. On any listing, click it and the
            new-application form opens pre-filled with the page title, link, and any text you
            selected — fix what the parser missed and save.
          </li>
          <li>
            <b>Share from your phone.</b> Install the app (Add to Home Screen), then use a
            listing&rsquo;s <b>Share</b> button and pick <b>Job Tracker</b> to send it straight into
            capture. (Android; on iOS use the bookmarklet.)
          </li>
        </ul>
      </Section>

      <Section title="Getting started & staying on track">
        <p>
          New here? The <b>Get started</b> checklist on the pipeline walks you through the whole
          loop in five steps — add a job, break it into criteria, build your evidence bank, link a
          story, mark it applied. It ticks itself off as you go and hides once you&rsquo;re set (or
          hit <b>Hide</b>; bring it back from <a href={routes.settings()}>Settings</a>).
        </p>
        <ul>
          <li>
            <b>Paste your CV to seed the evidence bank.</b> On the Evidence screen, <b>Import from
            CV</b> pulls the achievement lines out of your résumé so you start with a stocked bank,
            not a blank one — pick the ones worth keeping and tidy the titles.
          </li>
          <li>
            <b>A weekly target.</b> The ring on the pipeline tracks applications you marked applied
            this week against your target (set it in Settings). Consistency is what keeps a search
            alive — a steady weekly number beats bingeing then going quiet.
          </li>
          <li>
            <b>Move things forward.</b> Below the &ldquo;Needs you&rdquo; queue, a short list of
            proactive steps that raise your odds rather than just chase what&rsquo;s stale: an
            interview to prep, an application whose essential criteria have no story yet, or a nudge
            when your pipeline is thin (keeping ~8–12 live means no single rejection stings).
          </li>
        </ul>
      </Section>

      <Section title="Pipeline & the “days” signal">
        <p>
          Your applications live in one sortable table — click any column header to sort. Change an
          application&rsquo;s <b>stage</b> right in the row; closing prompts for the outcome
          (including <b>No response</b>, which is a valid, common ending).
        </p>
        <p>The <b>Days</b> column is the health signal:</p>
        <ul>
          <li>
            <Dot tone="neutral" /> <b>Applied / Acknowledged</b> — days since you applied.{' '}
            <span className="muted">Neutral under 10.</span>
          </li>
          <li>
            <Dot tone="amber" /> <b>10–20 days silent</b> — amber; worth a nudge soon.
          </li>
          <li>
            <Dot tone="red" /> <b>21+ days silent</b> — red; chase or let it go.
          </li>
          <li>
            <Dot tone="amber" /> <b>Drafting with a close date</b> — days until the ad closes (amber
            inside 3 days).
          </li>
        </ul>
        <p className="muted">
          Filters (Live / All / per-stage + profile) and search (<Kbd>/</Kbd>) narrow the list; the
          header tally summarises it. Hover any tally number for what it means.
        </p>
      </Section>

      <Section title="The “Needs you” queue">
        <p>
          The passive signal above becomes an active to-do. An application shows up when a follow-up
          is due, it&rsquo;s gone silent long enough to chase (<b>≥14 days</b>) or is probably ghosted
          (<b>≥30 days</b>), or a draft&rsquo;s ad closes within 3 days. Each row has one-click:
        </p>
        <ul>
          <li>
            <b>Log follow-up</b> — adds a dated contact note and pushes the next nudge out ~1 week.
          </li>
          <li>
            <b>Snooze 1wk</b> — hide it until next week.
          </li>
          <li>
            <b>Mark ghosted</b> — close it as “no response”.
          </li>
        </ul>
        <p className="muted">
          Applying to a job auto-sets a follow-up nudge for ~7 business days later, so it resurfaces
          on its own.
        </p>
      </Section>

      <Section title="Capturing an application">
        <p>
          Press <Kbd>n</Kbd> and <b>paste the job ad</b>. An offline parser fills the role, company,
          location, and salary; you fix anything it gets wrong (role is the only required field). On
          create, the ad is <b>archived</b> (the link will die — the paste won&rsquo;t) and split into
          a <b>criteria checklist</b> for that application.
        </p>
      </Section>

      <Section title="Application detail">
        <ul>
          <li>
            <b>Ad text</b> stays on the right so you can read it while you work. Everything saves as
            you go — no Save buttons.
          </li>
          <li>
            <b>Criteria</b> — the checklist from the ad. Link each to the evidence that answers it;
            uncovered criteria even <b>suggest</b> matching evidence. Coverage gaps are what to write
            about.
          </li>
          <li>
            <b>Told them</b> — a dated log of what you committed to (salary quoted, notice, start
            date). It saves you when someone rings six weeks later.
          </li>
          <li>
            <b>Drafts sent</b> — snapshots of what you copied from the composer, so “which version did
            I send here?” is always answerable.
          </li>
          <li>
            <b>Timeline</b> — stage changes log themselves; add notes for calls and emails.
          </li>
        </ul>
      </Section>

      <Section title="Evidence bank">
        <p>
          Your achievements, stored <b>once</b> and reused everywhere. Each item holds the same story
          at two lengths — a one-line <b>bullet</b> (CV) and a fuller <b>answer</b> (interview) — and
          is tagged by <b>capability</b>, never by industry. An item with only one length filled is
          flagged <b>half-finished</b>. <b>Use count</b> shows how often you&rsquo;ve leaned on it.
        </p>
      </Section>

      <Section title="Role profiles & coverage">
        <p>
          A profile is how you <b>frame</b> yourself for a kind of role — positioning, the
          vocabulary that sector uses, and the <b>priority capabilities</b> that matter. The{' '}
          <b>coverage view</b> counts your evidence against each priority capability; zero (red) and
          one (amber) are gaps to write about <em>before</em> you need them.
        </p>
      </Section>

      <Section title="Composer">
        <p>
          Three panes: what you&rsquo;re <b>answering</b> (your criteria + positioning), your{' '}
          <b>evidence</b> filtered to the profile&rsquo;s priorities, and the <b>draft</b>. Click{' '}
          <b>+ Bullet</b> or <b>+ Full</b> to drop evidence in; drag or use ↑/↓ to reorder; edit
          freely. <b>Copy all</b> concatenates it to your clipboard, records which evidence you used,
          and snapshots the draft against the application.
        </p>
        <p className="muted">
          It only concatenates — it never rewrites or generates. You do the framing. On a phone the
          three panes become tabs.
        </p>
      </Section>

      <Section title="Interview prep">
        <p>
          Once a role reaches <b>Interview</b>, open <b>Prep…</b> from the application. It assembles
          everything you need in the room from what you already captured — the role facts, how to{' '}
          <b>position yourself</b> (from the profile), <b>what they&rsquo;re judging</b> (your
          criteria and the story linked to each), and <b>what you told them</b>, so your answers stay
          consistent with earlier calls.
        </p>
        <ul>
          <li>
            <b>Draft from criteria</b> turns each criterion into a behavioural question stub,
            carrying over the evidence you already linked.
          </li>
          <li>
            <b>Link a story</b> to each question and its full-length answer appears inline to
            rehearse against — no hunting through the evidence bank.
          </li>
          <li>
            <b>Came up?</b> — after the interview, mark which questions were actually asked. Over
            time that tells you what these interviews really probe.
          </li>
        </ul>
      </Section>

      <Section title="Keyboard shortcuts">
        <table className="guide-keys">
          <tbody>
            <tr><td><Kbd>/</Kbd></td><td>Focus search</td></tr>
            <tr><td><Kbd>n</Kbd></td><td>New application</td></tr>
            <tr><td><Kbd>j</Kbd> / <Kbd>k</Kbd></td><td>Move row selection</td></tr>
            <tr><td><Kbd>Enter</Kbd></td><td>Open the selected application</td></tr>
            <tr><td><Kbd>Esc</Kbd></td><td>Close any panel or dialog</td></tr>
            <tr><td><Kbd>Cmd/Ctrl</Kbd> + <Kbd>Enter</Kbd></td><td>Save the current field and close</td></tr>
            <tr><td><Kbd>?</Kbd></td><td>Show shortcuts on the pipeline</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Your data">
        <p>
          Everything is stored locally in this browser. From <a href={routes.settings()}>Settings</a>{' '}
          you can <b>export</b> a JSON backup (do this regularly — it&rsquo;s your only backup while
          offline, and it&rsquo;s your migration file too), <b>import</b> one, load <b>sample data</b>{' '}
          to explore, or <b>reset</b>. Connecting a Supabase backend for cross-device sync is an
          optional later step.
        </p>
      </Section>

      <p style={{ marginTop: 24 }}>
        <a className="btn primary" href={routes.pipeline()}>
          Back to the pipeline
        </a>
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel guide-section">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>
}

function Dot({ tone }: { tone: 'neutral' | 'amber' | 'red' }) {
  const color =
    tone === 'red' ? 'var(--tone-red-fg)' : tone === 'amber' ? 'var(--tone-amber-fg)' : 'var(--text-3)'
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        marginRight: 4,
        verticalAlign: 'middle',
      }}
    />
  )
}
