// req-244 (DEC-139) — the workout pill, two lines: line 1 the rest clock or "GO" (pulse kept),
// line 2 "Set 2 of 4 · Ex 3 of 7" in words; "Ex 1 of 7" alone before a set (no stray
// separator); "Tap to skip rest" on the exercise's own screen while resting. The reserve
// (--ui-restpill-h) grows to the two lines so the pill covers nothing.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { itemKey, workoutPillState } from './workout-log.js'

const h = React.createElement
const DB = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const { WorkoutPill } = await importJsx('./ui/index.jsx', import.meta.url)
import { workoutPillLines } from './ui/workout-pill.js'

let view = null
afterEach(async () => {
  await view?.unmount()
  view = null
})

const lines = async (props) => {
  view = await render(h(WorkoutPill, { onOpen: () => {}, ...props }))
  const pill = view.container.querySelector('.ui-restpill')
  assert.ok(pill, 'the pill renders')
  const sub = pill.querySelector('.ui-restpill__sub')
  return {
    top: pill.querySelector('.ui-restpill__time').textContent,
    bottom: sub ? sub.textContent : null,
    go: pill.classList.contains('ui-restpill--go'),
    label: pill.getAttribute('aria-label'),
    text: pill.textContent,
  }
}

const SET = { current: 2, total: 4 }
const EX = { current: 3, total: 7 }

describe('criterion 1 — resting / GO', () => {
  it('resting: line 1 "1:12", line 2 "Set 2 of 4 · Ex 3 of 7", no pulse', async () => {
    const r = await lines({ clock: '1:12', set: SET, exercise: EX })
    assert.equal(r.top, '1:12')
    assert.equal(r.bottom, 'Set 2 of 4 · Ex 3 of 7')
    assert.equal(r.go, false)
    assert.equal(r.label, 'Rest 1:12, set 2 of 4, exercise 3 of 7 — open the exercise')
  })
  it('rest over: line 1 "GO" with the pulse class, line 2 unchanged', async () => {
    const r = await lines({ go: true, set: SET, exercise: EX })
    assert.equal(r.top, 'GO')
    assert.equal(r.bottom, 'Set 2 of 4 · Ex 3 of 7')
    assert.equal(r.go, true)
    assert.equal(r.label, 'Go, set 2 of 4, exercise 3 of 7 — open the exercise')
  })
  it('own screen while resting (skip): line 2 "Tap to skip rest", the counts are not shown', async () => {
    const r = await lines({ clock: '1:12', set: SET, exercise: EX, skip: true })
    assert.equal(r.top, '1:12')
    assert.equal(r.bottom, 'Tap to skip rest')
    assert.doesNotMatch(r.text, /of/)
    assert.match(r.label, /skip the rest/)
  })
})

describe('criterion 2 (failure case) — no set count', () => {
  it('first exercise, nothing logged: line 2 is only "Ex 1 of 7" — no separator', async () => {
    const r = await lines({ go: true, set: null, exercise: { current: 1, total: 7 } })
    assert.equal(r.top, 'GO')
    assert.equal(r.bottom, 'Ex 1 of 7')
    assert.doesNotMatch(r.text, /·/)
    assert.equal(r.label, 'Go, exercise 1 of 7 — open the exercise')
  })
  it('pure: no stray separator at either end, and no line 2 at all with no counts', () => {
    assert.equal(workoutPillLines({ go: true, exercise: { current: 1, total: 7 } }).bottom, 'Ex 1 of 7')
    assert.equal(workoutPillLines({ go: true, set: SET }).bottom, 'Set 2 of 4')
    assert.equal(workoutPillLines({ go: true }).bottom, '')
  })
  it('the old "·skip" and fraction texts are gone', async () => {
    const r = await lines({ clock: '0:45', set: SET, exercise: EX })
    assert.doesNotMatch(r.text, /\d\/\d/)
    assert.doesNotMatch(r.text, /skip/)
  })
})

describe('wired — the real pill (views/workout/rest.jsx) against the real store', () => {
  it('a fresh workout reads "GO" over "Ex 1 of 9"; item 1 done and a set logged on item 2, resting, the clock over "Set N of M · Ex 2 of 9"', async () => {
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutPill: RealPill } = await importJsx('./views/workout/rest.jsx', import.meta.url)
    localStorage.clear()
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...DB, activeWorkout: null }))
    const captured = {}
    function Screen() {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return captured.store.activeWorkout ? h(RealPill) : null
    }
    view = await render(h(StoreProvider, null, h(Screen)))
    await act(async () => captured.store.startWorkout('sess-upper'))
    const pill = () => view.container.querySelector('.ui-restpill')
    const top = () => pill().querySelector('.ui-restpill__time').textContent
    const bottom = () => pill().querySelector('.ui-restpill__sub').textContent
    assert.ok(pill(), 'the pill shows')
    assert.equal(top(), 'GO')
    assert.equal(bottom(), 'Ex 1 of 9')

    // Item 1 (Rowing) marked done, one work set logged on item 2 (Chest press), resting.
    const [first, second] = captured.store.activeWorkout.snapshot.items
    const set = { routineItemId: second.routineItemId, exerciseId: second.exerciseId, setType: 'work', weight: 20, reps: '8' }
    await act(async () =>
      captured.store.patchActive({ completedItemIds: [itemKey(first)], sets: [set], restEndsAt: Date.now() + 72_000 }),
    )
    const state = workoutPillState(captured.store.activeWorkout, Date.now())
    assert.equal(itemKey(state.item), itemKey(second))
    assert.equal(state.resting, true)
    assert.ok(state.total > 1, 'Chest press plans more than one set')
    assert.match(top(), /^1:1\d$/)
    assert.equal(bottom(), `Set ${state.current} of ${state.total} · Ex 2 of 9`)
  })
})

describe('criterion 3 — the reserve fits two lines (the pill covers nothing)', () => {
  const css = readFileSync(new URL('./ui/ui.css', import.meta.url), 'utf8')
  const rule = (selector) => {
    const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))
    assert.ok(m, `${selector} rule exists`)
    return m[1]
  }
  it('--ui-restpill-h counts the clock line, the words line, the padding and the border', () => {
    const decl = css.match(/--ui-restpill-h:\s*calc\(([^;]*)\);/)
    assert.ok(decl, '--ui-restpill-h is defined')
    const formula = decl[1].replace(/\s+/g, ' ').trim()
    assert.equal(formula, 'var(--ui-text-emphasis) + var(--ui-text-body) * var(--ui-restpill-line2) + 2 * var(--ui-s2) + 2px')
  })
  it('the two lines use exactly those heights, stacked', () => {
    assert.match(rule('.ui-restpill'), /flex-direction: column;/)
    assert.match(rule('.ui-restpill__time'), /font-size: var\(--ui-text-emphasis\);[\s\S]*line-height: 1;/)
    assert.match(rule('.ui-restpill__sub'), /font-size: var\(--ui-text-body\);/)
    assert.match(rule('.ui-restpill__sub'), /line-height: var\(--ui-restpill-line2\);/)
  })
  it('failure case: the one-line reserve (emphasis + padding only) is gone', () => {
    assert.doesNotMatch(css, /--ui-restpill-h: calc\(var\(--ui-text-emphasis\) \+ 2 \* var\(--ui-s2\) \+ 2px\)/)
  })
})
