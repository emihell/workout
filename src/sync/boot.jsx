// req-230 — the server build's entry. main.jsx imports this ONLY when the build flag `__SYNC__`
// is on (vite.config.js), so the Pages build contains no login screen, no sync code and no
// service worker (src/sync/pages-build.test.js checks the built files).
import { StrictMode } from 'react'
import { loadNotes, subscribeNoteSaved } from '../dev/dev-notes.js'
import { getLoadUnreadable, loadState, saveState, subscribeSaved } from '../persistence.js'
import { createSync } from './engine.js'
import { SyncRoot } from './root.jsx'

export function createBrowserSync() {
  const engine = createSync({
    fetch: (...args) => window.fetch(...args),
    storage: window.localStorage,
    isUnreadable: getLoadUnreadable,
    loadLocal: loadState,
    saveLocal: saveState,
    subscribeSaved,
    loadNotes,
  })
  subscribeNoteSaved(() => engine.noteSaved())
  // Coming back online or to the app → sync now; leaving it → send what's waiting now.
  window.addEventListener('online', () => engine.trigger())
  document.addEventListener('visibilitychange', () => engine.trigger())
  return engine
}

// The service worker (sw.js, made by vite.config.js for this build only) caches the app so it
// opens with no signal. A new version waits until every tab of the app is closed, then takes
// over on the next open — never in the middle of a workout.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const register = () =>
    navigator.serviceWorker.register('./sw.js').catch((error) => console.error('req-230: service worker', error))
  // This module arrives by a dynamic import, often after `load` has fired (found by a headless
  // run: a `load` listener alone never registered the worker).
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

export function renderSyncApp(root) {
  const sync = createBrowserSync()
  // No user yet: read the stored data now, so an unreadable value (DEC-032) is known before
  // choosing between the login screen and the app.
  if (!sync.getStatus().user) loadState()
  registerServiceWorker()
  root.render(
    <StrictMode>
      <SyncRoot sync={sync} />
    </StrictMode>,
  )
}
