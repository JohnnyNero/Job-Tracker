// Job-board deep links. The app can't (and shouldn't) scrape these boards — it
// just builds the search URL from your keywords/location and opens it in a new
// tab. Zero network, zero ToS issues: it's a smart set of bookmarks.

export interface SearchInput {
  keywords: string
  location: string
  remote: boolean
}

export interface Board {
  id: string
  name: string
  build: (q: SearchInput) => string
  /** Only shown when the search is marked remote. */
  remoteOnly?: boolean
}

const e = encodeURIComponent

export const BOARDS: Board[] = [
  {
    id: 'indeed',
    name: 'Indeed',
    build: ({ keywords, location }) =>
      `https://www.indeed.com/jobs?q=${e(keywords)}&l=${e(location)}`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    build: ({ keywords, location, remote }) =>
      `https://www.linkedin.com/jobs/search/?keywords=${e(keywords)}&location=${e(location)}${
        remote ? '&f_WT=2' : ''
      }`,
  },
  {
    id: 'google',
    name: 'Google Jobs',
    build: ({ keywords, location }) =>
      `https://www.google.com/search?q=${e(`${keywords} jobs ${location}`.trim())}&ibp=htl;jobs`,
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    build: ({ keywords }) => `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${e(keywords)}`,
  },
  {
    id: 'wwr',
    name: 'We Work Remotely',
    build: ({ keywords }) => `https://weworkremotely.com/remote-jobs/search?term=${e(keywords)}`,
    remoteOnly: true,
  },
  {
    id: 'remotive',
    name: 'Remotive',
    build: ({ keywords }) => `https://remotive.com/remote-jobs/search/${e(keywords)}`,
    remoteOnly: true,
  },
]

/** Boards to show for a given search (remote-only boards appear only when the
 * search is remote). */
export function boardsFor(q: SearchInput): Board[] {
  return BOARDS.filter((b) => (b.remoteOnly ? q.remote : true))
}

export function searchLabel(q: SearchInput): string {
  return [q.keywords || '(any role)', q.location, q.remote ? 'remote' : '']
    .filter(Boolean)
    .join(' · ')
}
