import type { Dataset } from '../types'
import { newId } from '../lib/id'

// Sample dataset loaded on demand from Settings. It exists so you can see the
// pipeline, days-silent colours, timeline, and profile links populated before
// entering real data. It is never loaded automatically — empty states must
// stay visible for a genuinely empty board.

function daysAgoIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function daysAgoDate(n: number): string {
  return daysAgoIso(n).slice(0, 10)
}

function daysAheadDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function sampleDataset(): Dataset {
  // profiles
  const opsProfile = newId()
  const dutyProfile = newId()

  // cv versions
  const opsCv = newId()
  const dutyCv = newId()

  // cv builder: work history + education
  const expOdeon = newId()
  const expCinema = newId()
  const eduCollege = newId()

  // evidence
  const rotaEv = newId()
  const costEv = newId()
  const conflictEv = newId()
  const trainingEv = newId()

  // applications
  const appSilentAmber = newId()
  const appSilentRed = newId()
  const appDraftingClosing = newId()
  const appInterview = newId()
  const appClosed = newId()

  return {
    person: {
      full_name: 'Jamie Rivera',
      headline: 'Operations Manager',
      email: 'jamie.rivera@example.com',
      phone: '07700 900123',
      location: 'Leeds, UK',
      links: ['linkedin.com/in/jamie-rivera'],
      summary:
        'Operations manager with seven years leading multi-site leisure teams — fair rotas, tight cost control, calm under pressure.',
      skills: [
        { name: 'Operations', items: ['Rota & scheduling', 'Cost control', 'P&L ownership', 'Health & safety'] },
        { name: 'Leadership', items: ['Team leadership', 'Training & onboarding', 'Conflict resolution'] },
      ],
    },
    capabilities: [
      { id: newId(), name: 'cost control', note: 'Reducing spend without cutting service.' },
      { id: newId(), name: 'rota and scheduling', note: 'Building fair, workable staff rotas.' },
      { id: newId(), name: 'handling conflict', note: 'Defusing disputes; difficult conversations.' },
      { id: newId(), name: 'training and onboarding', note: 'Bringing new starters up to speed.' },
      { id: newId(), name: 'stock and ordering', note: null },
    ],
    role_profiles: [
      {
        id: opsProfile,
        name: 'General operations manager',
        positioning:
          'A hands-on operations manager who keeps day-to-day service running while quietly taking cost out of the P&L.',
        priority_capabilities: ['cost control', 'rota and scheduling', 'handling conflict'],
        vocabulary: 'P&L, footfall, SLA, shrinkage, labour %',
        created_at: daysAgoIso(40),
      },
      {
        id: dutyProfile,
        name: 'Duty / floor manager',
        positioning:
          'A calm floor manager who owns the shift: staffing it, fixing what breaks, and sending customers away happy.',
        priority_capabilities: ['rota and scheduling', 'handling conflict', 'training and onboarding'],
        vocabulary: 'covers, front of house, service standards, incident log',
        created_at: daysAgoIso(38),
      },
    ],
    cv_versions: [
      {
        id: opsCv,
        label: 'ops-v3',
        profile_id: opsProfile,
        angle: 'Leads on cost control and P&L ownership.',
        file_path: 'CV - operations manager v3.docx',
        is_current: true,
        layout: {
          summary:
            'Hands-on operations manager who keeps day-to-day service running while taking cost out of the P&L. Seven years leading multi-site leisure teams.',
          hidden_experience_ids: [],
          hidden_education_ids: [],
          bullets: {
            [expOdeon]: [
              { id: newId(), evidence_id: rotaEv, text: null },
              { id: newId(), evidence_id: costEv, text: null },
              { id: newId(), evidence_id: conflictEv, text: null },
            ],
            [expCinema]: [{ id: newId(), evidence_id: trainingEv, text: null }],
          },
          skills: null,
        },
        created_at: daysAgoIso(30),
      },
      {
        id: dutyCv,
        label: 'duty-v2',
        profile_id: dutyProfile,
        angle: 'Front-of-house leadership and shift ownership.',
        file_path: 'CV - duty manager v2.docx',
        is_current: true,
        layout: null,
        created_at: daysAgoIso(25),
      },
    ],
    cv_experience: [
      {
        id: expOdeon,
        company: 'Odeon',
        title: 'Operations Manager',
        location: 'Leeds',
        start: '2021-03',
        end: null,
        position: 0,
      },
      {
        id: expCinema,
        company: 'Vue Cinemas',
        title: 'Duty Manager',
        location: 'Leeds',
        start: '2018-06',
        end: '2021-02',
        position: 1,
      },
    ],
    cv_education: [
      {
        id: eduCollege,
        institution: 'Leeds City College',
        qualification: 'BTEC Level 3',
        field: 'Business & Management',
        start: '2016',
        end: '2018',
        note: 'Final project: a staffing-cost model for a 40-cover café, graded Distinction.',
        position: 0,
      },
    ],
    evidence: [
      {
        id: rotaEv,
        title: 'Rebuilt the kitchen prep rota',
        bullet: 'Rebuilt the prep rota, cutting weekly overtime by 30% with no drop in service.',
        full_text:
          'The kitchen was running on a rota nobody trusted, so people padded shifts and overtime crept up. I mapped actual covers by hour, rebuilt the rota around genuine demand, and agreed the change with the team so it stuck. Overtime fell about 30% within two months and complaints about understaffing stopped.',
        capabilities: ['rota and scheduling', 'cost control'],
        when_happened: 'first year at the cinema',
        use_count: 4,
        last_used_at: daysAgoIso(9),
        created_at: daysAgoIso(35),
      },
      {
        id: costEv,
        title: 'Cut supplier spend on consumables',
        bullet: 'Renegotiated three supplier contracts, saving ~£8k a year on consumables.',
        full_text:
          'I noticed we were ordering the same consumables from three suppliers at three prices. I consolidated the orders, put the volume out to the two best, and used it to negotiate. It saved roughly £8k a year and made stock-takes simpler.',
        capabilities: ['cost control', 'stock and ordering'],
        when_happened: '2024',
        use_count: 2,
        last_used_at: daysAgoIso(20),
        created_at: daysAgoIso(34),
      },
      {
        id: conflictEv,
        title: 'Defused a long-running rota dispute',
        bullet: null,
        full_text:
          'Two senior staff had been feuding over weekend shifts for months and it was poisoning the rota. I sat down with each separately, found the actual grievance (one felt the split was never explained), then set a transparent rule for weekend allocation. The friction dropped and both stayed.',
        capabilities: ['handling conflict', 'rota and scheduling'],
        when_happened: 'last year',
        use_count: 1,
        last_used_at: daysAgoIso(30),
        created_at: daysAgoIso(33),
      },
      {
        id: trainingEv,
        // Deliberately half-finished: bullet only, no full_text, to show the
        // "half-finished" flag in the evidence bank.
        title: 'Onboarded five seasonal starters in a week',
        bullet: 'Built a one-week onboarding plan that got five seasonal staff serving unaided.',
        full_text: null,
        capabilities: ['training and onboarding'],
        when_happened: 'last summer',
        use_count: 0,
        last_used_at: null,
        created_at: daysAgoIso(20),
      },
    ],
    applications: [
      {
        id: appDraftingClosing,
        next_action_at: null,
        role: 'Operations Manager',
        company: 'Riverside Leisure',
        profile_id: opsProfile,
        stage: 'drafting',
        outcome: null,
        closed_from_stage: null,
        source: 'Indeed',
        link: 'https://example.com/job/ops-riverside',
        ad_text:
          'Operations Manager — Riverside Leisure\n\nWe are looking for a hands-on Operations Manager to run our busy leisure site.\n\nResponsibilities:\n- Own the site P&L and control labour costs\n- Build and manage staff rotas across a 7-day operation\n- Handle escalations and resolve customer and staff conflict\n- Maintain service standards and health & safety compliance\n\nRequirements:\n- Proven operations or duty management experience\n- Comfortable with cost control and labour percentage targets\n- Calm under pressure',
        keywords: ['operations management', 'cost control', 'P&L', 'staff rotas', 'health & safety', 'labour costs'],
        location: 'Leeds',
        salary_stated: '£32,000–£36,000',
        applied_on: null,
        closes_on: daysAheadDate(2),
        cv_version_id: opsCv,
        told_them: null,
        notes: 'Closes soon — finish the tailored answers tonight.',
        created_at: daysAgoIso(3),
        updated_at: daysAgoIso(1),
      },
      {
        id: appSilentAmber,
        next_action_at: null,
        role: 'Duty Manager',
        company: 'Vue Cinemas',
        profile_id: dutyProfile,
        stage: 'applied',
        outcome: null,
        closed_from_stage: null,
        source: 'LinkedIn',
        link: 'https://example.com/job/duty-vue',
        ad_text:
          'Duty Manager — Vue Cinemas\n\nLead the shift. Own front of house. Keep customers happy and staff on task.\n\n- Manage covers and breaks across the day\n- Train and support new starters\n- Handle incidents and complaints calmly\n- Cash-up and end-of-day reporting',
        keywords: ['duty management', 'front of house', 'customer service', 'cash handling', 'staff training'],
        location: 'Manchester',
        salary_stated: 'Competitive',
        applied_on: daysAgoDate(14),
        closes_on: null,
        cv_version_id: dutyCv,
        told_them: 'Quoted 1 month notice. Available for interview any weekday afternoon.',
        notes: '',
        created_at: daysAgoIso(15),
        updated_at: daysAgoIso(14),
      },
      {
        id: appSilentRed,
        next_action_at: null,
        role: 'Site Manager',
        company: 'ParkLife Ltd',
        profile_id: opsProfile,
        stage: 'acknowledged',
        outcome: null,
        closed_from_stage: null,
        source: 'Direct',
        link: 'https://example.com/job/site-parklife',
        ad_text:
          'Site Manager — ParkLife Ltd\n\nRun our flagship site end to end. Full P&L ownership, team of 20, seven-day operation.',
        keywords: ['P&L', 'site management', 'team leadership'],
        location: 'Sheffield',
        salary_stated: '£38,000',
        applied_on: daysAgoDate(24),
        closes_on: null,
        cv_version_id: opsCv,
        told_them: 'Told them current salary £34k, looking for £38k+.',
        notes: 'They acknowledged receipt but have gone quiet since.',
        created_at: daysAgoIso(25),
        updated_at: daysAgoIso(22),
      },
      {
        id: appInterview,
        next_action_at: daysAgoDate(2),
        role: 'Assistant Operations Manager',
        company: 'Odeon',
        profile_id: opsProfile,
        stage: 'interview',
        outcome: null,
        closed_from_stage: null,
        source: 'Referral',
        link: 'https://example.com/job/aom-odeon',
        ad_text:
          'Assistant Operations Manager — Odeon\n\nSupport the Operations Manager across a multi-screen site. Rotas, cost control, staff development.',
        keywords: ['operations', 'cost control', 'rotas', 'staff development'],
        location: 'Leeds',
        salary_stated: '£29,000 + bonus',
        applied_on: daysAgoDate(21),
        closes_on: null,
        cv_version_id: opsCv,
        told_them: 'Confirmed I can start with 4 weeks notice. First interview went well.',
        notes: 'Second interview being scheduled.',
        created_at: daysAgoIso(22),
        updated_at: daysAgoIso(4),
      },
      {
        id: appClosed,
        next_action_at: null,
        role: 'Venue Manager',
        company: 'The Warehouse',
        profile_id: dutyProfile,
        stage: 'closed',
        outcome: 'no_response',
        closed_from_stage: 'applied',
        source: 'Indeed',
        link: 'https://example.com/job/venue-warehouse',
        ad_text: 'Venue Manager — The Warehouse\n\nRun a busy live music venue.',
        keywords: [],
        location: 'Manchester',
        salary_stated: '£30,000',
        applied_on: daysAgoDate(60),
        closes_on: null,
        cv_version_id: dutyCv,
        told_them: '',
        notes: 'Never heard back. Marked as no response after six weeks.',
        created_at: daysAgoIso(61),
        updated_at: daysAgoIso(18),
      },
    ],
    events: [
      {
        id: newId(),
        application_id: appSilentAmber,
        kind: 'stage',
        body: 'Drafting → Applied',
        occurred_at: daysAgoIso(14),
      },
      {
        id: newId(),
        application_id: appSilentRed,
        kind: 'stage',
        body: 'Drafting → Applied',
        occurred_at: daysAgoIso(24),
      },
      {
        id: newId(),
        application_id: appSilentRed,
        kind: 'stage',
        body: 'Applied → Acknowledged',
        occurred_at: daysAgoIso(22),
      },
      {
        id: newId(),
        application_id: appInterview,
        kind: 'stage',
        body: 'Applied → Interview',
        occurred_at: daysAgoIso(6),
      },
      {
        id: newId(),
        application_id: appInterview,
        kind: 'note',
        body: 'Phone screen with the area manager. Asked a lot about labour % targets.',
        occurred_at: daysAgoIso(5),
      },
      {
        id: newId(),
        application_id: appClosed,
        kind: 'stage',
        body: 'Closed (No response) from Applied',
        occurred_at: daysAgoIso(18),
      },
    ],
    application_evidence: [
      { application_id: appInterview, evidence_id: rotaEv },
      { application_id: appInterview, evidence_id: costEv },
      { application_id: appSilentAmber, evidence_id: rotaEv },
      { application_id: appSilentAmber, evidence_id: conflictEv },
    ],
    criteria: [
      {
        id: newId(),
        application_id: appInterview,
        text: 'Build and manage staff rotas across a 7-day operation',
        essential: true,
        covered_by: rotaEv,
        position: 0,
      },
      {
        id: newId(),
        application_id: appInterview,
        text: 'Comfortable with cost control and labour percentage targets',
        essential: true,
        covered_by: costEv,
        position: 1,
      },
      {
        id: newId(),
        application_id: appInterview,
        text: 'Handle escalations and resolve customer and staff conflict',
        essential: true,
        covered_by: conflictEv,
        position: 2,
      },
      {
        id: newId(),
        application_id: appInterview,
        text: 'Experience with health & safety compliance',
        essential: false,
        covered_by: null,
        position: 3,
      },
    ],
    interview_questions: [
      {
        id: newId(),
        application_id: appInterview,
        text: 'Walk me through how you build a rota for a busy 7-day week.',
        covered_by: rotaEv,
        notes: 'Lead with the fairness angle — that’s what kept turnover down.',
        asked: true,
        position: 0,
      },
      {
        id: newId(),
        application_id: appInterview,
        text: 'Tell me about a time you brought costs back under control.',
        covered_by: costEv,
        notes: null,
        asked: false,
        position: 1,
      },
      {
        id: newId(),
        application_id: appInterview,
        text: 'Describe a conflict between staff members and how you handled it.',
        covered_by: conflictEv,
        notes: null,
        asked: false,
        position: 2,
      },
      {
        id: newId(),
        application_id: appInterview,
        text: 'Why do you want to leave your current role?',
        covered_by: null,
        notes: 'Frame as moving toward growth, not away from problems.',
        asked: false,
        position: 3,
      },
    ],
  }
}
