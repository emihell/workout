// req-153 — Back-button and guard leftovers from req-24 / req-152. Items 1 + 2 (and the
// req-152 QA-1 exits, moved here from req-152.test.js as behaviour tests) run against a
// fake browser session history: entries with state, an index, hashchange fired async
// like a real fragment navigation, and Back that keeps forward entries (history.length
// never shrinks). Item 3 lives in req-24.test.js (the guard), item 5 is this file + the
// req-152 edits listed in reports/req-153.md.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { BACK_TIMEOUT_MS, go, installEntryStamps, resetEntryStampsForTest } from './route.js'
import { leaveWorkoutToToday } from './workout-actions.js'
import { inWorkoutFallback } from './workout-paths.js'
import { historyGroupRowMeta } from './views/history/helpers.js'

const BASE = 'http://localhost:5173/workout/'

function fakeBrowser(startHash = '#/') {
  const entries = [{ url: BASE + startHash, state: null }]
  let index = 0
  const listeners = new Map()
  const queue = []
  const hashOf = (url) => url.slice(url.indexOf('#'))
  const fire = (event) => (listeners.get(event.type) || []).slice().forEach((fn) => fn(event))
  const navigated = (oldURL) => {
    const newURL = entries[index].url
    if (hashOf(oldURL) !== hashOf(newURL)) queue.push(() => fire({ type: 'hashchange', oldURL, newURL }))
  }
  const win = {
    HashChangeEvent: class {
      constructor(type, init) {
        Object.assign(this, { type }, init)
      }
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || []
      const at = list.indexOf(fn)
      if (at >= 0) list.splice(at, 1)
    },
    dispatchEvent(event) {
      fire(event)
    },
    history: {
      get length() {
        return entries.length
      },
      get state() {
        return entries[index].state
      },
      replaceState(state, _title, url) {
        entries[index] = { url: url ? BASE + url : entries[index].url, state }
      },
      back() {
        if (index === 0) return
        const oldURL = entries[index].url
        index -= 1
        navigated(oldURL)
      },
    },
    location: {
      get hash() {
        return hashOf(entries[index].url)
      },
      set hash(value) {
        const oldURL = entries[index].url
        entries.splice(index + 1)
        entries.push({ url: BASE + value, state: null })
        index += 1
        navigated(oldURL)
      },
      get href() {
        return entries[index].url
      },
    },
  }
  const flush = () => {
    while (queue.length) queue.shift()()
  }
  // A user tapping a plain <a href="#/…"> link: a native push, no go().
  const tapLink = (hash) => {
    win.location.hash = hash
    flush()
  }
  const back = () => {
    win.history.back()
    flush()
  }
  return { win, flush, tapLink, back, hash: () => win.location.hash, length: () => entries.length }
}

let browser
const previousWindow = globalThis.window
beforeEach(() => {
  browser = fakeBrowser('#/')
  globalThis.window = browser.win
  resetEntryStampsForTest()
  installEntryStamps()
})
afterEach(() => {
  globalThis.window = previousWindow
})

describe('item 1 — no duplicate entry when a replace targets the entry beneath', () => {
  it('overview → item (link) → last set → replace to the overview: length did not grow, one Back leaves', () => {
    go('/workout/x') // Start (push)
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log') // the overview row is a link
    const before = browser.length()
    go('/workout/x', { replace: true }) // markDoneAndGoToOverview
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x')
    assert.equal(browser.length(), before) // no new entry
    browser.back()
    assert.equal(browser.hash(), '#/') // one Back leaves the workout
  })

  it('two replaces to the overview in one tick (Skip + the marked-done effect) step back ONCE', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log')
    go('/workout/x', { replace: true })
    go('/workout/x', { replace: true }) // before the first back has arrived
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x')
    browser.back()
    assert.equal(browser.hash(), '#/') // still in the app, one Back from the overview
  })

  it('a different go() while stepping back is applied on arrival', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log')
    go('/workout/x', { replace: true })
    go('/workout/x/finish') // a push requested mid-step-back
    browser.flush()
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x/finish')
    browser.back()
    assert.equal(browser.hash(), '#/workout/x')
  })

  it('a back that never arrives settles on the timer (navigation is not stuck)', async () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log')
    browser.win.history.back = () => {} // swallowed
    go('/workout/x', { replace: true })
    await new Promise((r) => setTimeout(r, BACK_TIMEOUT_MS + 50))
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x') // replaced in place instead
    go('/history')
    browser.flush()
    assert.equal(browser.hash(), '#/history')
  })

  it('a replace whose target is NOT beneath replaces in place and keeps what is beneath', () => {
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log')
    go('/workout/x/item/b/log', { replace: true }) // e.g. Replace exercise → the new item
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x/item/b/log')
    assert.equal(browser.length(), 3)
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
  })

  it('safety net: an entry whose stamp is wrong (e.g. from before req-153) still lands on the target', () => {
    go('/a')
    browser.flush()
    go('/b')
    browser.flush()
    browser.win.history.replaceState({ below: '/target' }, '') // wrong: /a is beneath
    go('/target', { replace: true })
    browser.flush()
    assert.equal(browser.hash(), '#/target')
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

  it('Abandon from the overview (Today beneath): steps back onto Today, no duplicate', () => {
    go('/workout/x')
    browser.flush()
    leaveWorkoutToToday()
    browser.flush()
    assert.equal(browser.hash(), '#/')
    assert.equal(browser.length(), 2) // [#/, #/workout/x (forward)] — not a third entry
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
    assert.equal(inWorkoutFallback({ active: { sessionId: 'r1' }, routineId: 'r1', routineKnown: true }), 'missing')
  })
  it('the redirect is a replace: Save → Back → Back never stops on the dead item page', () => {
    // [#/, overview, item log] → Save (finish replaced with #/ as in the Finish test above)
    go('/workout/x')
    browser.flush()
    browser.tapLink('#/workout/x/item/a/log')
    browser.tapLink('#/workout/x/finish')
    leaveWorkoutToToday()
    browser.flush()
    browser.back() // → the dead item log page
    assert.equal(browser.hash(), '#/workout/x/item/a/log')
    go('/workout/x', { replace: true }) // what NotInWorkout does on mount
    browser.flush()
    assert.equal(browser.hash(), '#/workout/x') // stepped back onto the overview entry
    browser.back()
    assert.equal(browser.hash(), '#/')
  })
})

// ---- item 5 — req-152 QA-4's source regex, now a behaviour test ----
describe('History detail row meta from its sets (was a detail.jsx source regex)', () => {
  const set = (skipped) => ({ s: { setType: 'work', weight: skipped ? null : 40, reps: skipped ? 'skipped' : '8' } })
  it('all four skipped → "skipped"', () => {
    assert.equal(historyGroupRowMeta({ role: 'main', warmup: true }, [set(true), set(true), set(true), set(true)]), 'WU set · skipped')
  })
  it('2 of 4 skipped → "2 sets"', () => {
    assert.equal(historyGroupRowMeta({ role: 'main' }, [set(false), set(true), set(false), set(true)]), '2 sets')
  })
  it('no sets at all → "0 sets", not "skipped"', () => {
    assert.equal(historyGroupRowMeta({}, []), '0 sets')
  })
})
