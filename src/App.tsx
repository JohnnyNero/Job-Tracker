import type { ReactNode } from 'react'
import { useRoute, routes } from './router'
import {
  PipelineIcon,
  EvidenceIcon,
  ProfilesIcon,
  CvIcon,
  SettingsIcon,
  GuideIcon,
} from './components/NavIcons'
import { Pipeline } from './components/Pipeline'
import { ApplicationDetail } from './components/ApplicationDetail'
import { Composer } from './components/Composer'
import { InterviewPrep } from './components/InterviewPrep'
import { Evidence } from './components/Evidence'
import { Profiles } from './components/Profiles'
import { CvLocker } from './components/CvLocker'
import { Settings } from './components/Settings'
import { Guide } from './components/Guide'
import { DataBanners } from './components/DataBanners'

export function App() {
  const route = useRoute()

  return (
    <div className="app">
      <Nav routeName={route.name} />
      <main className="page-wrap">
        <DataBanners />
        {route.name === 'pipeline' && <Pipeline />}
        {route.name === 'application' && <ApplicationDetail id={route.id} />}
        {route.name === 'compose' && <Composer id={route.id} />}
        {route.name === 'prep' && <InterviewPrep id={route.id} />}
        {route.name === 'evidence' && <Evidence />}
        {route.name === 'profiles' && <Profiles />}
        {route.name === 'cv' && <CvLocker />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'guide' && <Guide />}
        {route.name === 'not_found' && <NotFound path={route.path} />}
      </main>
    </div>
  )
}

function Nav({ routeName }: { routeName: string }) {
  const tab = (
    href: string,
    label: string,
    short: string,
    icon: ReactNode,
    active: boolean,
  ) => (
    <a className={`tab ${active ? 'active' : ''}`} href={href} aria-current={active ? 'page' : undefined}>
      <span className="tab-icon">{icon}</span>
      <span className="tab-full">{label}</span>
      <span className="tab-short">{short}</span>
    </a>
  )
  return (
    <nav className="nav">
      <a className="brand" href={routes.pipeline()}>
        <span className="dot" />
        Job Tracker
      </a>
      {tab(routes.pipeline(), 'Pipeline', 'Pipeline', <PipelineIcon />, routeName === 'pipeline' || routeName === 'application' || routeName === 'compose' || routeName === 'prep')}
      {tab(routes.evidence(), 'Evidence', 'Evidence', <EvidenceIcon />, routeName === 'evidence')}
      {tab(routes.profiles(), 'Role profiles', 'Profiles', <ProfilesIcon />, routeName === 'profiles')}
      {tab(routes.cv(), 'CV locker', 'CV', <CvIcon />, routeName === 'cv')}
      {tab(routes.settings(), 'Settings', 'Settings', <SettingsIcon />, routeName === 'settings')}
      <span className="spacer" />
      {tab(routes.guide(), 'Guide', 'Guide', <GuideIcon />, routeName === 'guide')}
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
