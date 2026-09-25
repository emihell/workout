// req-177 — phone polish. Display only: Effort "Couldn't finish" → "Max" (stored rpe 5),
// Finish collapses untouched exercises into one "Not started" line and stops naming
// warm-ups, and both set-count summaries singularize ("1 set").
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { RPE_OPTIONS, rpeLabel, rpeOptionValue } from './ids.js'
import { finishSkippedByItem, finishSkippedLines } from './finish-unfinished.js'
import { withSkippedUnloggedSets } from './workout-log.js'
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
const work = (it) => ({ routineItemId: it.routineItemId, exerciseId: it.exerciseId, setType: 'work', weight: 20, reps: '10', rpe: 3, note: '' })
const workoutOf = (items, sets) => ({ id: 'w', snapshot: { routineName: 'Upper', items }, sets, completedItemIds: [] })

describe('req-177 AC1 — Effort "Max" is stored rpe 5', () => {
  it('the option labelled Max has value 5, and 5 reads back as Max', () => {
    assert.deepEqual(RPE_OPTIONS.map((o) => o.label), ['Easy', 'Moderate', 'Hard', 'Max'])
    assert.equal(RPE_OPTIONS.find((o) => o.label === 'Max').value, 5)
    assert.equal(rpeLabel(5), 'Max')
    assert.equal(rpeOptionValue(5), 5)
  })
})

describe('req-177 AC2/AC4 — Finish lines', () => {
  const a = item('pi-a', 'Chest press', 3, { warmup: { reps: 12 } })
  const b = item('pi-b', 'Rowing', 3, { warmup: { reps: 12 } })
  const c = item('pi-c', 'Lat Pulldown', 3)
  const d = item('pi-d', 'Shoulder Press', 2)

  it('one line per partly-logged exercise, then ONE "Not started" line in workout order; warm-ups unnamed', () => {
    const w = workoutOf([a, b, c, d], [work(a)])
    assert.deepEqual(finishSkippedLines(w), [
      'Chest press: 1 of 3 sets. The other 2 will be saved as skipped.',
      'Not started, saved as skipped: Rowing, Lat Pulldown, Shoulder Press.',
    ])
    for (const line of finishSkippedLines(w)) assert.equal(/warm-up/i.test(line), false)
  })

  it('AC3: per-item skipped counts still equal what withSkippedUnloggedSets adds (warm-ups included)', () => {
    const w = workoutOf([a, b, c, d], [work(a)])
    const added = withSkippedUnloggedSets(w).sets.length - w.sets.length
    const entries = finishSkippedByItem(w)
    assert.equal(entries.reduce((n, e) => n + e.added.length, 0), added)
    assert.deepEqual(entries.map((e) => e.added.length), [3, 4, 3, 2]) // a: 2 work + WU; b: 3 + WU
  })

  it('AC4: everything logged → no lines', () => {
    assert.deepEqual(finishSkippedLines(workoutOf([c, d], [work(c), work(c), work(c), work(d), work(d)])), [])
  })

  it('AC4: everything untouched → only the one "Not started" line', () => {
    assert.deepEqual(finishSkippedLines(workoutOf([a, b, c], [])), ['Not started, saved as skipped: Chest press, Rowing, Lat Pulldown.'])
  })

  it('AC4: one exercise → no trailing comma or "and"', () => {
    const lines = finishSkippedLines(workoutOf([c], []))
    assert.deepEqual(lines, ['Not started, saved as skipped: Lat Pulldown.'])
    assert.doesNotMatch(lines[0].split(": ")[1], /,|\band\b/) // the names part
  })
})

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
    // A test harness reading the live store out of the tree (as req-176.test.js).
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

describe('req-177 AC1 — picking Max on the live workout stores rpe 5', () => {
  it('Leg Extension: Max button → the finished work set has rpe 5', async () => {
    const { captured, mount } = await harness()
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-lower'))
    await mount(h(WorkoutItemLog, { routineId: 'sess-lower', itemId: 'si-sess-lower-2-ex-leg-extension' }))
    await view.click(view.button('Complete')) // the warm-up, as prefilled
    await view.click(view.button('Max'))
    await view.click(view.button('Complete'))
    await act(async () => captured.store.finishWorkout({}))
    const worked = captured.store.workouts[0].sets.filter((s) => s.exerciseId === 'ex-leg-extension' && s.setType === 'work' && s.note !== 'skipped')
    assert.deepEqual(worked.map((s) => s.rpe), [5])
  })
})

describe('req-177 AC5 — "1 set" in the Finish summary and History', () => {
  it('a one-set workout reads "1 set" on Finish and in History detail', async () => {
    const { captured, mount } = await harness()
    const { WorkoutFinish } = await importJsx('./views/workout/finish.jsx', import.meta.url)
    const { HistoryDetail } = await importJsx('./views/history/index.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-lower'))
    const first = captured.store.activeWorkout.snapshot.items[0]
    await act(async () =>
      captured.store.patchActive({
        sets: [{ routineItemId: first.routineItemId || first.id, exerciseId: first.exerciseId, setType: 'work', weight: 20, reps: '10', rpe: 3, note: '' }],
      }),
    )
    await mount(h(WorkoutFinish, { routineId: 'sess-lower' }))
    assert.match(view.text(), / · 1 set(?!s)/)
    assert.equal(view.text().includes('1 sets'), false)
    await act(async () => captured.store.finishWorkout({}))
    await mount(h(HistoryDetail, { workoutId: captured.store.workouts[0].id }))
    assert.match(view.text(), / · 1 set · /)
    assert.equal(view.text().includes('1 sets'), false)
  })

  it('two sets still read "2 sets"', async () => {
    const { captured, mount } = await harness()
    const { WorkoutFinish } = await importJsx('./views/workout/finish.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-lower'))
    const first = captured.store.activeWorkout.snapshot.items[0]
    const s = { routineItemId: first.routineItemId || first.id, exerciseId: first.exerciseId, setType: 'work', weight: 20, reps: '10', rpe: 3, note: '' }
    await act(async () => captured.store.patchActive({ sets: [s, s] }))
    await mount(h(WorkoutFinish, { routineId: 'sess-lower' }))
    assert.match(view.text(), / · 2 sets/)
  })
})
