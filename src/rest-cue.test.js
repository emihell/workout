import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { StoreContext } from './store-context.js'
import { RestEndCue, nextCueState, unlockAudio } from './rest-cue.js'

// react-test-renderer runs the real client reconciler (needed for effects), with
// no DOM. Flag the act environment so effects flush synchronously.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// ---------------------------------------------------------------------------
// The pure edge decision — the branch's real receipt. Driven as a sequence of
// (restEndsAt, now) states, no React, no audio. This is where fire-once /
// not-on-Next / not-on-pause / re-arm-fires-again are proven exactly.
// ---------------------------------------------------------------------------
describe('nextCueState', () => {
  it('first observation of a future rest seeds without firing', () => {
    const s = nextCueState(undefined, 1000, 500)
    assert.equal(s.fire, false)
    assert.equal(s.lastCued, null)
  })

  it('first observation of an already-past rest is treated as already-cued (no beep on reload)', () => {
    const s = nextCueState(undefined, 1000, 2000)
    assert.equal(s.fire, false)
    assert.equal(s.lastCued, 1000, 'adopts the past value so we never cue an edge we did not witness')
  })

  it('first observation with no rest seeds null', () => {
    const s = nextCueState(undefined, null, 500)
    assert.equal(s.fire, false)
    assert.equal(s.lastCued, null)
  })

  it('fires once on the natural 1→0 edge, then not again while the same rest sits at 0', () => {
    // Armed at t=1000, observed while still counting down.
    let s = nextCueState(undefined, 1000, 500)
    assert.equal(s.fire, false)
    // still counting
    s = nextCueState(s, 1000, 900)
    assert.equal(s.fire, false)
    // reached the end → fire
    s = nextCueState(s, 1000, 1000)
    assert.equal(s.fire, true)
    assert.equal(s.lastCued, 1000)
    // next ticks with remaining still 0 → no repeat
    s = nextCueState(s, 1000, 1200)
    assert.equal(s.fire, false)
    s = nextCueState(s, 1000, 1500)
    assert.equal(s.fire, false)
  })

  it('does not fire when Next clears restEndsAt before the edge', () => {
    let s = nextCueState(undefined, 1000, 500) // counting down
    s = nextCueState(s, null, 700) // Next → restEndsAt null
    assert.equal(s.fire, false)
    // and stays quiet afterwards
    s = nextCueState(s, null, 2000)
    assert.equal(s.fire, false)
  })

  it('does not fire on pause (restEndsAt nulled) even past the old end time', () => {
    let s = nextCueState(undefined, 1000, 500)
    s = nextCueState(s, null, 1000) // paused: restEndsAt nulled, remaining moved elsewhere
    assert.equal(s.fire, false)
    s = nextCueState(s, null, 1500)
    assert.equal(s.fire, false)
  })

  it('re-arms and fires again for a new restEndsAt (+30s / pause→resume mint a new value)', () => {
    // First rest fires.
    let s = nextCueState(undefined, 1000, 500)
    s = nextCueState(s, 1000, 1000)
    assert.equal(s.fire, true)
    assert.equal(s.lastCued, 1000)
    // +30s while running would instead change the value before the edge; here we
    // model a fresh rest armed later at t=5000.
    s = nextCueState(s, 5000, 4000) // counting down toward the new one
    assert.equal(s.fire, false)
    s = nextCueState(s, 5000, 5000) // new edge → fires again
    assert.equal(s.fire, true)
    assert.equal(s.lastCued, 5000)
  })

  it('+30s: a larger restEndsAt arriving before the edge defers, then fires once at the new end', () => {
    let s = nextCueState(undefined, 1000, 500)
    s = nextCueState(s, 1300, 1100) // +30s bumped the end past `now` again
    assert.equal(s.fire, false, 'not at the old end — it moved')
    s = nextCueState(s, 1300, 1300)
    assert.equal(s.fire, true)
    s = nextCueState(s, 1300, 1400)
    assert.equal(s.fire, false, 'only once for the bumped rest')
  })
})

// ---------------------------------------------------------------------------
// The component wiring: renders null, fires the injected side-effects on the
// edge, dedupes, re-arms, and is fail-silent. Mirrors wake-lock.test.js.
// ---------------------------------------------------------------------------
describe('RestEndCue', () => {
  function makeSpies() {
    const calls = { beep: 0, vibrate: 0 }
    return {
      calls,
      beep: () => {
        calls.beep += 1
      },
      vibrate: () => {
        calls.vibrate += 1
      },
    }
  }

  async function render(activeWorkout, spies) {
    let renderer
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          StoreContext.Provider,
          { value: { activeWorkout } },
          React.createElement(RestEndCue, { beep: spies.beep, vibrate: spies.vibrate }),
        ),
      )
      await tick()
    })
    return renderer
  }

  async function update(renderer, activeWorkout, spies) {
    await act(async () => {
      renderer.update(
        React.createElement(
          StoreContext.Provider,
          { value: { activeWorkout } },
          React.createElement(RestEndCue, { beep: spies.beep, vibrate: spies.vibrate }),
        ),
      )
      await tick()
    })
  }

  it('renders nothing', async () => {
    const spies = makeSpies()
    const renderer = await render(null, spies)
    assert.equal(renderer.toJSON(), null)
    await act(async () => renderer.unmount())
  })

  it('does not fire on mount with no active rest', async () => {
    const spies = makeSpies()
    const renderer = await render({ occurrenceId: 'w1' }, spies)
    assert.equal(spies.calls.beep, 0)
    assert.equal(spies.calls.vibrate, 0)
    await act(async () => renderer.unmount())
  })

  it('fires beep + vibrate once when a rest reaches its end, and not again for the same rest', async () => {
    const spies = makeSpies()
    // Mount with no rest so the first observation seeds cleanly.
    const renderer = await render({ occurrenceId: 'w1', restEndsAt: null }, spies)
    // Rest reaches 0 (restEndsAt now in the past → the countdown has arrived).
    const past = Date.now() - 100
    await update(renderer, { occurrenceId: 'w1', restEndsAt: past }, spies)
    assert.equal(spies.calls.beep, 1)
    assert.equal(spies.calls.vibrate, 1)
    // A re-render with the same restEndsAt must not repeat.
    await update(renderer, { occurrenceId: 'w1', restEndsAt: past }, spies)
    assert.equal(spies.calls.beep, 1, 'no repeat while remaining sits at 0')
    assert.equal(spies.calls.vibrate, 1)
    await act(async () => renderer.unmount())
  })

  it('does not fire when rest ends via Next (restEndsAt cleared to null)', async () => {
    const spies = makeSpies()
    const renderer = await render({ occurrenceId: 'w1', restEndsAt: Date.now() + 100000 }, spies)
    // Next clears it before the edge.
    await update(renderer, { occurrenceId: 'w1', restEndsAt: null }, spies)
    assert.equal(spies.calls.beep, 0)
    assert.equal(spies.calls.vibrate, 0)
    await act(async () => renderer.unmount())
  })

  it('re-arms: a new restEndsAt fires again after an earlier one already fired', async () => {
    const spies = makeSpies()
    const renderer = await render({ occurrenceId: 'w1', restEndsAt: null }, spies)
    await update(renderer, { occurrenceId: 'w1', restEndsAt: Date.now() - 100 }, spies)
    assert.equal(spies.calls.beep, 1)
    // Next clears (no cue), then a fresh rest is armed and lands.
    await update(renderer, { occurrenceId: 'w1', restEndsAt: null }, spies)
    await update(renderer, { occurrenceId: 'w1', restEndsAt: Date.now() - 50 }, spies)
    assert.equal(spies.calls.beep, 2, 'the new restEndsAt cues again')
    assert.equal(spies.calls.vibrate, 2)
    await act(async () => renderer.unmount())
  })

  it('never throws when the injected beep throws (fail-silent)', async () => {
    const throwingSpies = {
      beep: () => {
        throw new Error('audio blocked')
      },
      vibrate: () => {
        throw new Error('no vibrate')
      },
    }
    const renderer = await render({ occurrenceId: 'w1', restEndsAt: null }, throwingSpies)
    await assert.doesNotReject(
      update(renderer, { occurrenceId: 'w1', restEndsAt: Date.now() - 100 }, throwingSpies),
    )
    await act(async () => renderer.unmount())
  })
})

// ---------------------------------------------------------------------------
// The real default side-effects are no-ops when their APIs are absent, and never
// throw — the fail-silent contract at the boundary the component doesn't mock.
// ---------------------------------------------------------------------------
describe('default side-effects fail silently', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    originalNavigator = globalThis.navigator
    originalWindow = globalThis.window
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    })
  })

  it('unlockAudio is a no-op and does not throw when there is no AudioContext', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true })
    assert.doesNotThrow(() => unlockAudio())
  })

  it('unlockAudio is a no-op and does not throw when window is undefined', () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    assert.doesNotThrow(() => unlockAudio())
  })
})
