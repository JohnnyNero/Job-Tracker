/* Service worker for Job Tracker — makes the app installable and fully usable
   offline. The app's data already lives in localStorage; this just keeps the
   shell (HTML/JS/CSS/icons) available with no network.

   Strategy:
   - Navigations: network-first, falling back to the cached app shell so deep
     links and reloads work offline.
   - Static assets (hashed JS/CSS/icons): stale-while-revalidate — serve the
     cached copy instantly, refresh it in the background. New deploys ship new
     hashed filenames, so they're fetched fresh on first online load.
   Bump CACHE to force old caches out on the next activation. */
const CACHE = 'job-tracker-v2'
const BASE = new URL(self.registration.scope).pathname // e.g. /Job-Tracker/
const SHELL = [
  BASE,
  BASE + 'manifest.webmanifest',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // App navigations → network-first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(BASE).then((r) => r || caches.match(BASE + 'index.html'))),
    )
    return
  }

  // Everything else → stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
