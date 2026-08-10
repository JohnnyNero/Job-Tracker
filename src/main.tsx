import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import { StoreProvider } from './store/store'
import { App } from './App'

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
