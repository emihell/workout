import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { StoreContext } from './store-context.js'
import { WakeLock } from './wake-lock.js'

// react-test-renderer runs the real client reconciler (needed for effects), with
// no DOM. Flag the act environment so effects flush synchronously.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Let detached microtasks/promises inside the effect settle.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// A mock of navigator.wakeLock. Records every request('screen') call and hands
// back sentinels that track their own release() the way WakeLockSentinel does
// (including the `released` boolean the browser flips on auto-release).
function makeWakeLock() {
  let requestImpl = null
  const wakeLock = {
    requests: [],
    sentinels: [],
    setRequestImpl(fn) {
      requestImpl = fn
    },
    async request(type) {
      wakeLock.requests.push(type)
      if (requestImpl) return requestImpl()
      const sentinel = {
        released: false,
        releaseCount: 0,
        async release() {
          this.released = true
          this.releaseCount += 1
        },
      }
      wakeLock.sentinels.push(sentinel)
      return sentinel
    },
  }
  return wakeLock
}

// A minimal document stand-in: tracks visibilitychange listeners so the test can
// drive them, and carries a settable visibilityState.
function makeDoc() {
  const listeners = {}
  return {
    visibilityState: 'visible',
    listeners,
    addEventListener(type, fn) {
      ;(listeners[type] ||= []).push(fn)
    },
    removeEventListener(type, fn) {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
    },
  }
}

describe('WakeLock', () => {
  let originalNavigator
  let originalDocument
  let doc

  beforeEach(() => {
    originalNavigator = globalThis.navigator
    originalDocument = globalThis.document
    doc = makeDoc()
    // navigator is a non-configurable getter on some Node versions; define fresh.
    Object.defineProperty(globalThis, 'navigator', {
      value: { wakeLock: makeWakeLock() },
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'document', {
      value: doc,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
      writable: true,
    })
  })

  async function render(activeWorkout) {
    let renderer
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          StoreContext.Provider,
          { value: { activeWorkout } },
          React.createElement(WakeLock),
        ),
      )
      await tick()
    })
    return renderer
  }

  async function update(renderer, activeWorkout) {
    await act(async () => {
      renderer.update(
        React.createElement(
          StoreContext.Provider,
          { value: { activeWorkout } },
          React.createElement(WakeLock),
        ),
      )
      await tick()
    })
  }

  function fireVisibility(state) {
    doc.visibilityState = state
    for (const fn of doc.listeners.visibilitychange || []) fn()
  }

  it('does not request a lock when there is no active workout', async () => {
    await render(null)
    assert.equal(globalThis.navigator.wakeLock.requests.length, 0)
  })

  it('requests a screen lock when a workout becomes active', async () => {
    const renderer = await render(null)
    assert.equal(globalThis.navigator.wakeLock.requests.length, 0)

    await update(renderer, { occurrenceId: 'w1' })
    const wl = globalThis.navigator.wakeLock
    assert.equal(wl.requests.length, 1)
    assert.equal(wl.requests[0], 'screen')
    assert.equal(wl.sentinels.length, 1)
  })

  it('releases the lock when the workout ends (activeWorkout → null)', async () => {
    const renderer = await render({ occurrenceId: 'w1' })
    const wl = globalThis.navigator.wakeLock
    assert.equal(wl.sentinels.length, 1)
    const sentinel = wl.sentinels[0]

    await update(renderer, null)
    assert.equal(sentinel.releaseCount, 1)
    assert.equal(sentinel.released, true)
  })

  it('releases the lock on unmount', async () => {
    const renderer = await render({ occurrenceId: 'w1' })
    const sentinel = globalThis.navigator.wakeLock.sentinels[0]
    await act(async () => {
      renderer.unmount()
      await tick()
    })
    assert.equal(sentinel.releaseCount, 1)
  })

  it('re-acquires on visibilitychange→visible after the browser auto-released it', async () => {
    await render({ occurrenceId: 'w1' })
    const wl = globalThis.navigator.wakeLock
    assert.equal(wl.requests.length, 1)

    // Simulate the browser auto-releasing when the tab backgrounds.
    wl.sentinels[0].released = true
    await act(async () => {
      fireVisibility('hidden')
      fireVisibility('visible')
      await tick()
    })

    assert.equal(wl.requests.length, 2, 'a fresh lock is requested on return')
    assert.equal(wl.sentinels.length, 2)
  })

  it('does not re-request on visibilitychange when the lock is still live', async () => {
    await render({ occurrenceId: 'w1' })
    const wl = globalThis.navigator.wakeLock
    assert.equal(wl.requests.length, 1)

    await act(async () => {
      fireVisibility('visible') // sentinel still live (released === false)
      await tick()
    })
    assert.equal(wl.requests.length, 1, 'no duplicate lock while one is held')
  })

  it('is a silent no-op when navigator.wakeLock is undefined', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    })
    // Must not throw and must not register a visibility listener.
    await assert.doesNotReject(render({ occurrenceId: 'w1' }))
    assert.equal((doc.listeners.visibilitychange || []).length, 0)
  })

  it('swallows a rejecting request without throwing', async () => {
    globalThis.navigator.wakeLock.setRequestImpl(() => Promise.reject(new Error('denied')))
    await assert.doesNotReject(render({ occurrenceId: 'w1' }))
    // Requested (and rejected) but nothing broke.
    assert.equal(globalThis.navigator.wakeLock.requests.length, 1)
  })
})
