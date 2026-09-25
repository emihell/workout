// req-162 — after Skip exercise, the item's log route must not render "Not found." while
// its replace-redirect to the overview is pending (the smoke test caught a one-render
// flash, req-159). A RENDER test (req-156 harness): the real WorkoutItemLog mounted with
// a store whose item is marked done. The redirect runs in an effect; the router is not
// mounted, so what the component itself rendered is what stays on screen here.
import { describe, it, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { importJsx, render } from './test-support/render.js'
import { StoreContext } from './store-context.js'

const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)

const h = React.createElement
const ITEM = { id: 'pi-a', routineItemId: 'si-a', exerciseId: 'ex-a', exerciseName: 'Chest Press' }
const store = (completedItemIds) => ({
  exercises: [],
  routines: [{ id: 'r', name: 'Upper', exercises: [] }],
  workouts: [],
  activeWorkout: { id: 'wo', routineId: 'r', snapshot: { items: [ITEM] }, sets: [], completedItemIds },
})

let view
beforeEach(() => {
  location.hash = '#/workout/r/item/si-a/log'
})
afterEach(async () => {
  await view?.unmount()
  view = null
})

const mount = (s, itemId) => render(h(StoreContext.Provider, { value: s }, h(WorkoutItemLog, { routineId: 'r', itemId })))

describe('req-162 — the log route of a marked-done item', () => {
  it('renders nothing (no "Not found.") and redirects to the overview', async () => {
    view = await mount(store(['si-a']), 'si-a')
    assert.doesNotMatch(view.text(), /Not found\./)
    assert.equal(view.text(), '')
    assert.equal(location.hash, '#/workout/r', 'the redirect still runs')
  })
  it('a genuinely unknown item id with an active workout still says "Not found."', async () => {
    view = await mount(store([]), 'no-such-item')
    assert.match(view.text(), /Not found\./)
  })
})
