import { useRoute, routes } from './router'
import { Pipeline } from './components/Pipeline'
import { ApplicationDetail } from './components/ApplicationDetail'
import { Composer } from './components/Composer'
import { Evidence } from './components/Evidence'
import { Profiles } from './components/Profiles'
import { CvLocker } from './components/CvLocker'
import { Settings } from './components/Settings'
import { Guide } from './components/Guide'
import { Group } from './components/Group'
import { isOnline } from './store/supabaseClient'

export function App() {
  const route = useRoute()

  return (
    <div className="app">
      <Nav routeName={route.name} />
      <main className="page-wrap">
        {route.name === 'pipeline' && <Pipeline />}
        {route.name === 'application' && <ApplicationDetail id={route.id} />}
        {route.name === 'compose' && <Composer id={route.id} />}
        {route.name === 'evidence' && <Evidence />}
        {route.name === 'profiles' && <Profiles />}
        {route.name === 'cv' && <CvLocker />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'guide' && <Guide />}
        {route.name === 'group' && <Group />}
        {route.name === 'not_found' && <NotFound path={route.path} />}
      </main>
    </div>
  )
}

function Nav({ routeName }: { routeName: string }) {
  const tab = (href: string, label: string, active: boolean) => (
    <a className={`tab ${active ? 'active' : ''}`} href={href}>
      {label}
    </a>
  )
  return (
    <nav className="nav">
      <a className="brand" href={routes.pipeline()}>
        <span className="dot" />
        Job Tracker
      </a>
      {tab(routes.pipeline(), 'Pipeline', routeName === 'pipeline' || routeName === 'application')}
      {tab(routes.evidence(), 'Evidence', routeName === 'evidence')}
      {tab(routes.profiles(), 'Role profiles', routeName === 'profiles')}
      {tab(routes.cv(), 'CV locker', routeName === 'cv')}
      {isOnline && tab(routes.group(), 'Group', routeName === 'group')}
      {tab(routes.settings(), 'Settings', routeName === 'settings')}
      <span className="spacer" />
      {tab(routes.guide(), 'Guide', routeName === 'guide')}
    </nav>
  )
}

function NotFound({ path }: { path: string }) {
  return (
    <div className="page page-narrow">
      <div className="empty">
        <h3>Nothing here</h3>
        <p>
          <code>{path}</code> isn&rsquo;t a page in this app.
        </p>
        <a className="btn" href={routes.pipeline()}>
          Back to the pipeline
        </a>
      </div>
    </div>
  )
}
