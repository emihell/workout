// req-124 — Replace lands on the new exercise. store.replaceItem now generates the new
// item's id BEFORE the setState updater and returns it; the reducer it runs is
// storage.replaceItemInState (store.jsx can't be imported under `node --test`). This
// proves (1) the reducer inserts an item under exactly that id, so the returned key
// resolves, (2) a failed replace inserts nothing, and (3) a source guard that
// store.replaceItem returns the id it passes and replace.jsx navigates to that key's
// log path. The req-109 behaviour itself stays covered by skip-replace.test.js.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildPlannedWorkout, migrateState, planSnapshot } from './model.js'
import { replaceItemInState } from './storage.js'
import { itemKey } from './workout-log.js'
import { itemLogPath } from './workout-paths.js'

const EXERCISES = [
  { id: 'ex-a', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-n', name: 'Pec Fly', equipment: 'Machine', type: 'machine', weightStep: '5' },
]

function baseState() {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        focus: 'Machines',
        exercises: [{ id: 'ri-a', exerciseId: 'ex-a', role: 'main', restSec: 120, sets: 2, targets: ['10', '8'] }],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: [],
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    performedOn: '2026-09-23',
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    completedItemIds: [],
    sets: [],
    seedOverrides: {},
  }
  return state
}

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('req-124 replaceItem returns the key of the inserted item', () => {
  it("the id chosen before the updater is the inserted item's key, and it exists in the snapshot", () => {
    const state = baseState()
    const originalKey = itemKey(state.activeWorkout.snapshot.items[0])
    const next = replaceItemInState(state, originalKey, 'ex-n', 'mid-new-1')
    const inserted = next.activeWorkout.snapshot.items.find((item) => itemKey(item) === 'mid-new-1')
    assert.ok(inserted, 'an item keyed by the returned id is in the snapshot')
    assert.equal(inserted.exerciseId, 'ex-n')
    assert.equal(inserted.exerciseName, 'Pec Fly')
    assert.deepEqual(next.activeWorkout.snapshot.items.map(itemKey), [originalKey, 'mid-new-1'])
    // the path replace.jsx builds from the bare key is the new item's own log path
    assert.equal(itemLogPath('r1', { id: 'mid-new-1' }), itemLogPath('r1', inserted))
    assert.equal(itemLogPath('r1', inserted), '/workout/r1/item/mid-new-1/log')
  })

  it('a failed replace (unknown exercise / unknown item / no workout) inserts nothing', () => {
    const state = baseState()
    const originalKey = itemKey(state.activeWorkout.snapshot.items[0])
    assert.equal(replaceItemInState(state, originalKey, 'ex-missing', 'mid-x'), state)
    assert.equal(replaceItemInState(state, 'no-such-item', 'ex-n', 'mid-x'), state)
    const idle = { ...state, activeWorkout: null }
    assert.equal(replaceItemInState(idle, originalKey, 'ex-n', 'mid-x'), idle)
  })

  it('source guard: store.replaceItem returns the id it hands the reducer; the picker navigates to it', () => {
    const store = src('./store.jsx')
    assert.match(
      store,
      /replaceItem\(itemId, exerciseId\) \{\s*const id = uid\('mid'\)\s*setState\(\(s\) => replaceItemInState\(s, itemId, exerciseId, id\)\)\s*return id\s*\}/,
    )
    const picker = src('./views/workout/replace.jsx')
    assert.match(picker, /const newKey = store\.replaceItem\(itemKey\(item\), exerciseId\)/)
    assert.match(picker, /go\(itemLogPath\(routineId, \{ id: newKey \}\), \{ replace: true \}\)/)
    // the done-bounce (original now skipped → done) must not override that navigation
    assert.match(picker, /picked\.current = true\s*\/\/[^\n]*\n\s*const newKey = store\.replaceItem/)
    assert.match(picker, /if \(done && !picked\.current\) go\(`\/workout\/\$\{routineId\}`, \{ replace: true \}\)/)
  })
})
