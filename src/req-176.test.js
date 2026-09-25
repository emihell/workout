// req-176 — Finish lists, per exercise, the sets Save will record as skipped. The list is
// derived from withSkippedUnloggedSets (what finishedState writes), not a second count.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { finishSkippedByItem, finishSkippedLines } from './finish-unfinished.js'
import { setsForItem, withSkippedUnloggedSets } from './workout-log.js'
import { act, importJsx, render } from './test-support/render.js'

const item = (id, name, sets, extra = {}) => ({
  id,
  routineItemId: id,
  exerciseId: `ex-${id}`,
  exerciseName: name,
  sets,
  targets: Array(sets).fill('10'),
  suggestedWeights: Array(sets).fill(20),
  ...extra,
})
const work = (it, reps = '10') => ({ routineItemId: it.routineItemId, exerciseId: it.exerciseId, setType: 'work', weight: 20, reps, rpe: 3, note: '' })
const wu = (it) => ({ ...work(it, '12'), setType: 'wu', rpe: null })

const curl = item('pi-curl', 'Leg curl', 3)
const press = item('pi-press', 'Leg press', 3)
const ext = item('pi-ext', 'Leg extension', 2)
const workoutOf = (items, sets) => ({ id: 'w', snapshot: { routineName: 'Lower', items }, sets, completedItemIds: [] })

// AC2 — the helper's per-item counts equal what withSkippedUnloggedSets actually adds for
// that item: the finished sets for the item minus the sets it had before Finish.
function assertMatchesSave(workout) {
  const saved = withSkippedUnloggedSets(workout)
  const byIndex = new Map(finishSkippedByItem(workout).map((entry) => [entry.index, entry]))
  const appended = saved.sets.slice((workout.sets || []).length)
  let cursor = 0
  workout.snapshot.items.forEach((it, i) => {
    const addedBySave = setsForItem(saved.sets, it).length - setsForItem(workout.sets, it).length
    const entry = byIndex.get(i)
    assert.equal(entry ? entry.added.length : 0, addedBySave, `item ${i} count`)
    assert.equal(entry ? entry.warmupSkipped + entry.workSkipped : 0, addedBySave)
    if (entry) {
      assert.deepEqual(entry.added, appended.slice(cursor, cursor + entry.added.length), `item ${i} records`)
      cursor += entry.added.length
    }
  })
  assert.equal(cursor, appended.length, 'every appended set is attributed')
}

describe('req-176 — finishSkippedLines', () => {
  it('AC1: half-done and untouched get a line, the fully-done one none, in workout order', () => {
    const w = workoutOf([curl, ext, press], [work(curl), work(ext), work(ext)])
    assert.deepEqual(finishSkippedLines(w), [
      'Leg curl: 1 of 3 sets. The other 2 will be saved as skipped.',
      'Not started, saved as skipped: Leg press.', // req-177 wording
    ])
    assertMatchesSave(w)
  })

  it('AC1: everything logged → nothing listed', () => {
    const w = workoutOf([ext], [work(ext), work(ext)])
    assert.deepEqual(finishSkippedLines(w), [])
    assertMatchesSave(w)
  })

  it('an unlogged planned warm-up is counted in what Save adds, but no longer named (req-177)', () => {
    const warm = { reps: 12 }
    const a = item('pi-a', 'Squat', 3, { warmup: warm })
    const b = item('pi-b', 'Row', 2, { warmup: warm })
    const c = item('pi-c', 'Press', 1, { warmup: warm })
    const d = item('pi-d', 'Dip', 2, { warmup: warm })
    const w = workoutOf([a, b, c, d], [work(a), work(b), work(b), wu(d)])
    assert.deepEqual(finishSkippedLines(w), [
      // req-177 wording: warm-ups unnamed (so Row, only its warm-up left, has no line),
      // untouched exercises collapse into the one "Not started" line.
      'Squat: 1 of 3 sets. The other 2 will be saved as skipped.',
      'Dip: 0 of 2 sets. 2 sets will be saved as skipped.',
      'Not started, saved as skipped: Press.',
    ])
    assertMatchesSave(w)
  })

  it('one left → "The other set"; an exercise already skipped via Skip exercise → no line', () => {
    const skipped = { ...work(ext, 'skipped'), weight: 0, note: 'skipped' }
    const w = workoutOf([curl, ext], [work(curl), work(curl), skipped, skipped])
    assert.deepEqual(finishSkippedLines(w), ['Leg curl: 2 of 3 sets. The other set will be saved as skipped.'])
    assertMatchesSave(w)
  })

  it('AC3: no snapshot items, no snapshot, or no workout → nothing, no throw', () => {
    assert.deepEqual(finishSkippedLines(workoutOf([], [])), [])
    assert.deepEqual(finishSkippedLines({ id: 'w', sets: [] }), [])
    assert.deepEqual(finishSkippedLines(null), [])
    assert.deepEqual(finishSkippedLines(undefined), [])
  })

  it('AC3: a legacy active workout (DEC-088 shape, items without id) lists what Save writes, per item', () => {
    // As migrateState leaves a v8 in-progress workout: routineItemId, no id (req-165.test.js).
    const legacy = (routineItemId, name, sets) => ({ routineItemId, exerciseId: `ex-${routineItemId}`, exerciseName: name, sets, targets: Array(sets).fill('8') })
    const a = legacy('si-a', 'Bench', 3)
    const b = legacy('si-b', 'Fly', 2)
    const w = workoutOf([a, b], [{ routineItemId: 'si-a', exerciseId: 'ex-si-a', setType: 'work', weight: 40, reps: '8', rpe: 3, note: '' }])
    assert.deepEqual(finishSkippedLines(w), [
      'Bench: 1 of 3 sets. The other 2 will be saved as skipped.',
      'Not started, saved as skipped: Fly.', // req-177 wording
    ])
    assertMatchesSave(w)
  })
})

// The Finish screen itself, against the real store.
const h = React.createElement
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

async function harness() {
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture(), activeWorkout: null }))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const captured = {}
  function Grab({ children }) {
    // A test harness reading the live store out of the tree (as req-175.test.js).
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return children ?? null
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Grab, null, child)))
  }
  await mount(null)
  return { captured, mount }
}

describe('req-176 — the Finish screen', () => {
  it('renders one line per unfinished exercise, and Save writes exactly those skipped sets', async () => {
    const { captured, mount } = await harness()
    const { WorkoutFinish } = await importJsx('./views/workout/finish.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-lower'))
    const active = captured.store.activeWorkout
    const first = active.snapshot.items.find((it) => Number(it.sets) >= 3)
    await act(async () =>
      captured.store.patchActive({
        sets: [{ routineItemId: first.routineItemId || first.id, exerciseId: first.exerciseId, setType: 'work', weight: 20, reps: '10', rpe: 3, note: '' }],
      }),
    )
    const lines = finishSkippedLines(captured.store.activeWorkout)
    // req-177: lines now collapse, so "every item has something left" is asserted on the
    // per-item entries; the lines are one for the started item + one "Not started" line.
    assert.equal(finishSkippedByItem(captured.store.activeWorkout).length, active.snapshot.items.length, 'every item has something left')
    assert.equal(lines.length, 2)
    await mount(h(WorkoutFinish, { routineId: 'sess-lower' }))
    const text = view.text()
    for (const line of lines) assert.ok(text.includes(line), `on screen: ${line}`)
    assert.match(text, new RegExp(`${first.exerciseName}: 1 of ${first.sets} sets\\.`))
    const expected = finishSkippedByItem(captured.store.activeWorkout).flatMap((entry) => entry.added)
    const before = captured.store.activeWorkout.sets.length
    await act(async () => captured.store.finishWorkout({}))
    assert.deepEqual(captured.store.workouts[0].sets.slice(before), expected)
  })

  it('AC3: a workout with no snapshot items and a legacy (id-less) one render Finish without error', async () => {
    const { captured, mount } = await harness()
    const { WorkoutFinish } = await importJsx('./views/workout/finish.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-lower'))
    const snapshot = captured.store.activeWorkout.snapshot
    await act(async () => captured.store.patchActive({ snapshot: { ...snapshot, items: [] }, sets: [] }))
    await mount(h(WorkoutFinish, { routineId: 'sess-lower' }))
    assert.match(view.text(), /Finish/)
    assert.equal(view.text().includes('saved as skipped'), false)

    const legacyItems = snapshot.items.map(({ id: _id, ...rest }) => rest)
    await act(async () => captured.store.patchActive({ snapshot: { ...snapshot, items: legacyItems }, sets: [] }))
    await mount(h(WorkoutFinish, { routineId: 'sess-lower' }))
    const text = view.text()
    for (const line of finishSkippedLines(captured.store.activeWorkout)) assert.ok(text.includes(line), line)
    assert.match(text, /Not started, saved as skipped: /) // req-177 wording
  })
})
