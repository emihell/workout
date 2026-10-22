// req-230 review round 1 (#6) — a waiting new version takes over on open / reload / return to
// the app, but never while a workout is in progress (then after Finish/Abandon, on the next check).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SKIP_WAITING, activateWaiting, watchForUpdates } from './sw-update.js'

function fakes({ waiting = true, controller = true } = {}) {
  const posted = []
  const listeners = {}
  const registration = {
    waiting: waiting ? { postMessage: (m) => posted.push(m) } : null,
    updates: 0,
    update() {
      this.updates += 1
      return Promise.resolve()
    },
  }
  const container = { controller: controller ? {} : null, addEventListener: (type, fn) => (listeners[type] = fn) }
  let visible = null
  let reloads = 0
  return {
    posted,
    registration,
    container,
    fire: (type) => listeners[type](),
    returnToApp: () => visible(),
    reloads: () => reloads,
    deps: (inProgress) => ({
      container,
      registration,
      workoutInProgress: inProgress,
      reload: () => (reloads += 1),
      onVisible: (fn) => (visible = fn),
    }),
  }
}

describe('req-230 review #6 — when a new version takes over', () => {
  it('on open with no workout in progress: the waiting version is told to take over, then the page reloads once', () => {
    const f = fakes()
    watchForUpdates(f.deps(() => false))
    assert.deepEqual(f.posted, [SKIP_WAITING])
    f.fire('controllerchange')
    f.fire('controllerchange')
    assert.equal(f.reloads(), 1)
  })

  it('during a workout: nothing on open or on return; after Finish, the next return to the app does it', () => {
    const f = fakes()
    let inProgress = true
    watchForUpdates(f.deps(() => inProgress))
    f.returnToApp()
    assert.deepEqual(f.posted, [], 'never mid-workout')
    inProgress = false // Finish / Abandon
    f.returnToApp()
    assert.deepEqual(f.posted, [SKIP_WAITING])
    assert.ok(f.registration.updates >= 3, 'each check also looks for a new version')
  })

  it('nothing waiting → nothing asked; the first install (no controller yet) never reloads', () => {
    const none = fakes({ waiting: false })
    assert.equal(activateWaiting(none.registration, () => false), false)
    const first = fakes({ waiting: false, controller: false })
    watchForUpdates(first.deps(() => false))
    first.fire('controllerchange')
    assert.equal(first.reloads(), 0)
  })
})
