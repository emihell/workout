// req-153 — leftovers from req-24 / req-152. Item 2 (and the req-152 QA-1 exits, moved
// here from req-152.test.js as behaviour tests) run against a fake browser session
// history: entries, an index, hashchange fired async like a real fragment navigation,
// location.replace rewriting the current entry, and Back that keeps forward entries.
// Item 1 (the dead first Back) was dropped (DEC-084): route.js is req-152's go().
// Item 3 lives in req-24.test.js (the guard); item 5 is this file + the req-152 edits.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { go } from './route.js'
import { leaveWorkoutToToday } from './workout-actions.js'
import { inWorkoutFallback } from './workout-paths.js'
import { historyGroupRowMeta } from './views/history/helpers.js'

const BASE = 'http://localhost:5173/workout/'

function fakeBrowser(startHash = '#/') {
  const entries = [BASE + startHash]
  let index = 0
  const listeners = new Map()
  const queue = []
  const hashOf = (url) => url.slice(url.indexOf('#'))
  const fire = (event) => (listeners.get(event.type) || []).slice().forEach((fn) => fn(event))
  const hashchanged = (oldURL) => {
    const newURL = entries[index]
    if (hashOf(oldURL) !== hashOf(newURL)) queue.push(() => fire({ type: 'hashchange', oldURL, newURL }))
  }
  let reloads = 0
  const win = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || []
      const at = list.indexOf(fn)
      if (at >= 0) list.splice(at, 1)
    },
    history: {
      get length() {
        return entries.length
      },
      back() {
        if (index === 0) return
        const oldURL = entries[index]
        index -= 1
        hashchanged(oldURL)
      },
    },
    location: {
      get hash() {
        return hashOf(entries[index])
      },
      set hash(value) {
        const oldURL = entries[index]
        entries.splice(index + 1)
        entries.push(BASE + value)
        index += 1
        hashchanged(oldURL)
      },
      get href() {
        return entries[index]
      },
      // Same document + a new fragment → a fragment navigation (no reload); anything
      // else would reload the page.
      replace(url) {
        const oldURL = entries[index]
        if (url.slice(0, url.indexOf('#')) !== oldURL.slice(0, oldURL.indexOf('#'))) reloads += 1
        entries[index] = url
        hashchanged(oldURL)
      },
    },
  }
  const flush = () => {
    while (queue.length) queue.shift()()
  }
  const tapLink = (hash) => {
    win.location.hash = hash
    flush()
  }
  const back = () => {
    win.history.back()
    flush()
  }
  return { win, flush, tapLink, back, hash: () => win.location.hash, length: () => entries.length, reloads: () => reloads }
}

let browser
const previousWindow = globalThis.window
beforeEach(() => {
  browser = fakeBrowser('#/')
  globalThis.window = browser.win
})
afterEach(() => {
  globalThis.window = previousWindow
})

describe("go() — req-152's replace (moved here from req-152.test.js)", () => {
  it('replace rewrites the current entry in place: length unchanged, the replaced route is gone', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/finish')
    const before = browser.length()
    go('/', { replace: true })
    browser.flush()
    assert.equal(browser.hash(), '#/')
    assert.equal(browser.length(), before)
    browser.back()
    assert.equal(browser.hash(), '#/workout/x')
  })

  it('failure case: a plain (non-replace) go still pushes', () => {
    const before = browser.length()
    go('/history')
    browser.flush()
    assert.equal(browser.length(), before + 1)
    browser.back()
    assert.equal(browser.hash(), '#/')
  })

  it('a replace fires hashchange (the router re-renders) without a reload', () => {
    go('/workout/x')
    browser.flush()
    let fired = 0
    browser.win.addEventListener('hashchange', () => (fired += 1))
    go('/workout/x/finish', { replace: true })
    browser.flush()
    assert.equal(fired, 1)
    assert.equal(browser.reloads(), 0)
  })
})

describe('req-152 QA-1 exits — leaveWorkoutToToday (moved here as behaviour tests)', () => {
  it('Finish → Save: the finish entry is replaced; Back reaches the overview, never the finish route', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/finish')
    const before = browser.length()
    leaveWorkoutToToday()
    browser.flush()
    assert.equal(browser.hash(), '#/')
    assert.equal(browser.length(), before)
    browser.back()
    assert.equal(browser.hash(), '#/workout/x')
  })

  it('Abandon from the overview: the overview entry is replaced by Today (no new entry)', () => {
    go('/workout/x')
    browser.flush()
    const before = browser.length()
    leaveWorkoutToToday()
    browser.flush()
    assert.equal(browser.hash(), '#/')
    assert.equal(browser.length(), before)
  })
})

describe('the in-app visit stack still follows (moved from req-152.test.js)', () => {
  it('a replace rewrites the top of the stack; the replaced path is gone', () => {
    const saved = new Map()
    globalThis.sessionStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) }
    try {
      go('/workout/r1')
      browser.flush()
      go('/workout/r1/finish')
      browser.flush()
      assert.equal(JSON.parse(saved.get('workout-mvp-nav-2')).at(-1), '/workout/r1/finish')
      go('/', { replace: true })
      browser.flush()
      const stack = JSON.parse(saved.get('workout-mvp-nav-2'))
      assert.equal(stack.at(-1), '/')
      assert.ok(!stack.includes('/workout/r1/finish'))
    } finally {
      delete globalThis.sessionStorage
    }
  })
})

describe('item 2 — an in-workout route with no active workout', () => {
  it('known routine, no active workout → redirect (to its overview)', () => {
    assert.equal(inWorkoutFallback({ active: null, routineId: 'r1', routineKnown: true }), 'redirect')
  })
  it('known routine, a DIFFERENT routine active → redirect', () => {
    assert.equal(inWorkoutFallback({ active: { routineId: 'r2' }, routineId: 'r1', routineKnown: true }), 'redirect')
  })
  it('failure case: unknown routine → "Not found." (missing)', () => {
    assert.equal(inWorkoutFallback({ active: null, routineId: 'nope', routineKnown: false }), 'missing')
  })
  it('active for this routine (the item/set itself is missing) → "Not found."', () => {
    assert.equal(inWorkoutFallback({ active: { routineId: 'r1' }, routineId: 'r1', routineKnown: true }), 'missing')
    // req-165 — a raw `{ sessionId }` active workout can't reach this: migrateState renames it
    // to routineId on load (req-165.test.js); that case was the line above.
  })
  it('the redirect is a replace: Save → Back reaches the dead item page, which becomes the overview in place', () => {
    // [#/, overview, item log, finish] → Save (finish replaced with #/)
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log')
    browser.tapLink('#/workout/x/finish')
    leaveWorkoutToToday()
    browser.flush()
    browser.back() // → the old item log page (no active workout now)
    assert.equal(browser.hash(), '#/workout/x/item/a/log')
    const before = browser.length()
    go('/workout/x', { replace: true }) // what NotInWorkout does on mount
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x') // the overview's preview / Done view
    assert.equal(browser.length(), before) // in place, no new entry
    browser.back()
    assert.equal(browser.hash(), '#/workout/x') // the entry beneath (a duplicate — item 1, parked)
    browser.back()
    assert.equal(browser.hash(), '#/')
  })
})

// ---- req-153 re-review — the Finish exits land on Today (regression on 1b5e3bd) ----
// NotInWorkout's effect, as it runs: redirect only if the decision, taken with the
// browser's path at that moment, is 'redirect'.
const notInWorkoutEffect = (routineId, active = null) => {
  const currentPath = browser.hash().replace(/^#/, '')
  if (inWorkoutFallback({ active, routineId, routineKnown: true, currentPath }) === 'redirect') {
    go(`/workout/${routineId}`, { replace: true })
  }
}

describe('Finish → Save / Abandon lands on Today (the finish screen re-renders once more)', () => {
  it('Save: finishWorkout clears the workout, leaveWorkoutToToday moves to Today, the re-render must not pull back', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/finish')
    leaveWorkoutToToday() // after store.finishWorkout(…)
    notInWorkoutEffect('x') // the still-mounted finish screen, now with no active workout
    browser.flush()
    assert.equal(browser.hash(), '#/')
  })

  it('Abandon on Finish: same', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/finish')
    leaveWorkoutToToday() // abandonWorkout(store): store.abandonWorkout() then this
    notInWorkoutEffect('x')
    browser.flush()
    assert.equal(browser.hash(), '#/')
  })

  it('an OLD finish page reached by Back (no active workout) still redirects to the overview', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/finish')
    leaveWorkoutToToday()
    browser.flush()
    browser.back() // [#/, overview, #/] → the overview; one more old page for the test:
    browser.tapLink('#/workout/x/finish') // stands in for an old finish entry
    notInWorkoutEffect('x')
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x')
  })

  it('the decision: on a sub-route of this routine → redirect; anywhere else → left', () => {
    const base = { active: null, routineId: 'x', routineKnown: true }
    assert.equal(inWorkoutFallback({ ...base, currentPath: '/workout/x/finish' }), 'redirect')
    assert.equal(inWorkoutFallback({ ...base, currentPath: '/workout/x/item/a/log' }), 'redirect')
    assert.equal(inWorkoutFallback({ ...base, currentPath: '/' }), 'left')
    assert.equal(inWorkoutFallback({ ...base, currentPath: '/workout/x' }), 'left')
    assert.equal(inWorkoutFallback({ ...base, currentPath: '/workout/xy/finish' }), 'left')
    assert.equal(inWorkoutFallback({ ...base, routineKnown: false, currentPath: '/workout/x/finish' }), 'missing')
  })
})

// ---- item 5 — req-152 QA-4's source regex, now a behaviour test ----
describe('History detail row meta from its sets (was a detail.jsx source regex)', () => {
  const set = (skipped) => ({ s: { setType: 'work', weight: skipped ? null : 40, reps: skipped ? 'skipped' : '8' } })
  it('all four skipped → "skipped"', () => {
    assert.equal(historyGroupRowMeta({ role: 'main', warmup: true }, [set(true), set(true), set(true), set(true)]), 'Warm-up set · skipped')
  })
  it('2 of 4 skipped → "2 sets"', () => {
    assert.equal(historyGroupRowMeta({ role: 'main' }, [set(false), set(true), set(false), set(true)]), '2 sets')
  })
  it('no sets at all → "0 sets", not "skipped"', () => {
    assert.equal(historyGroupRowMeta({}, []), '0 sets')
  })
})
