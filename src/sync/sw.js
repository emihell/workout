// req-230 §2 — the service worker of the SERVER build only (vite.config.js writes it to sw.js
// with the build's file list and id; the plain build has none). It keeps the app's files so the
// app opens with no signal once it has been loaded.
//
//   install   → cache every built file (this version's own cache)
//   activate  → delete older versions' caches. A new version never skips waiting on its own: it
//               waits for the page to say so (message SKIP_WAITING). The page asks when the app is
//               opened, reloaded or returned to — and never while a workout is in progress
//               (src/sync/sw-update.js; review round 1: a tab that is never fully closed, as on
//               iOS, would otherwise never get the new version).
//               clients.claim() makes the very first install control the open page.
//   fetch     → /api/* and anything not a GET or not ours: straight to the network, never cached.
//               A page load: the cached app (index.html), the network only if it's missing.
//               Any other file: the cache, then the network.
const VERSION = __SW_VERSION__
const FILES = __SW_FILES__
const PREFIX = 'workout-app-'
const CACHE = PREFIX + VERSION
const SHELL = './'

function route(request, origin) {
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== origin) return 'network'
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return 'network'
  if (request.mode === 'navigate') return 'shell'
  return 'cache'
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SHELL, ...FILES.filter((f) => f !== 'index.html')])))
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const kind = route(event.request, self.location.origin)
  if (kind === 'network') return
  const key = kind === 'shell' ? SHELL : event.request
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(key))
      .then((hit) => hit || fetch(event.request)),
  )
})
