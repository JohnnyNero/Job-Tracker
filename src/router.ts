import { useEffect, useState } from 'react'

// A tiny hash router. Hash routing needs no server-side SPA fallback, which is
// exactly what GitHub Pages lacks, so deep links like #/app/<id> always work.
// Routes are matched by a hand-rolled switch in App — there are only a handful.

export type Route =
  | { name: 'pipeline' }
  | { name: 'application'; id: string }
  | { name: 'compose'; id: string }
  | { name: 'evidence' }
  | { name: 'profiles' }
  | { name: 'cv' }
  | { name: 'settings' }
  | { name: 'guide' }
  | { name: 'not_found'; path: string }

function parse(hash: string): Route {
  // strip leading "#", tolerate "#/" and "#"
  const path = hash.replace(/^#/, '') || '/'
  const parts = path.split('/').filter(Boolean) // ["app","<id>"]

  if (parts.length === 0) return { name: 'pipeline' }
  switch (parts[0]) {
    case 'app':
      return parts[1] ? { name: 'application', id: parts[1] } : { name: 'pipeline' }
    case 'compose':
      return parts[1] ? { name: 'compose', id: parts[1] } : { name: 'pipeline' }
    case 'evidence':
      return { name: 'evidence' }
    case 'profiles':
      return { name: 'profiles' }
    case 'cv':
      return { name: 'cv' }
    case 'settings':
      return { name: 'settings' }
    case 'guide':
      return { name: 'guide' }
    default:
      return { name: 'not_found', path }
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** Programmatic navigation. */
export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : '#' + path
  if (window.location.hash === target) {
    // Force a re-parse even when navigating to the current hash.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

export const routes = {
  pipeline: () => '#/',
  application: (id: string) => `#/app/${id}`,
  compose: (id: string) => `#/compose/${id}`,
  evidence: () => '#/evidence',
  profiles: () => '#/profiles',
  cv: () => '#/cv',
  settings: () => '#/settings',
  guide: () => '#/guide',
}
