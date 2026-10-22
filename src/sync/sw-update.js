// req-230 review round 1 (#6) — when a new version of the app (a waiting service worker) takes
// over. Checked when the app opens, on a reload, and when it comes back to the screen: if a new
// version is waiting and NO workout is in progress, the page tells it to take over and reloads
// once it has. During a workout nothing happens; the next check after Finish/Abandon does it.
export const SKIP_WAITING = { type: 'SKIP_WAITING' }

// → true when it asked the waiting version to take over.
export function activateWaiting(registration, workoutInProgress) {
  if (!registration?.waiting) return false
  if (workoutInProgress()) return false
  registration.waiting.postMessage(SKIP_WAITING)
  return true
}

// Wires the checks. `container` = navigator.serviceWorker; `reload` = location.reload.
export function watchForUpdates({ container, registration, workoutInProgress, reload, onVisible }) {
  let reloading = false
  const hadController = Boolean(container.controller)
  container.addEventListener('controllerchange', () => {
    // The very first install claims the page: nothing to reload for.
    if (!hadController || reloading) return
    reloading = true
    reload()
  })
  const check = () => {
    registration.update?.().catch?.(() => {})
    activateWaiting(registration, workoutInProgress)
  }
  check() // the app was just opened / reloaded
  onVisible(check)
  return check
}
