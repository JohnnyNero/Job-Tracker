import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import { StoreProvider } from './store/store'
import { App } from './App'

// PWA share-target (Android): the OS share sheet lands on the app with the
// shared job as ?title=&text=&url= query params (before the hash). Fold them
// into the #/new capture route before React reads the hash, then strip the
// query so a refresh doesn't re-trigger it.
;(() => {
  try {
    const sp = new URLSearchParams(window.location.search)
    if (sp.has('title') || sp.has('text') || sp.has('url')) {
      const q = new URLSearchParams()
      for (const k of ['title', 'text', 'url']) {
        const v = sp.get(k)
        if (v) q.set(k, v)
      }
      window.history.replaceState(null, '', import.meta.env.BASE_URL + '#/new?' + q.toString())
    }
  } catch {
    /* ignore */
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

// Register the service worker (production only — a SW caching a dev server just
// causes stale-asset confusion). Scoped to the app's base path so it controls
// the whole app on GitHub Pages.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(() => {
      // Offline support is a progressive enhancement — ignore failures.
    })
  })
}
