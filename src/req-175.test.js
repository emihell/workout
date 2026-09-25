// req-175 (DEC-093) — plain words: "WU" → "Warm-up", the History volume reads
// "{n} kg lifted", "Replace exercise" → "Swap exercise", Effort "Failure" → "Couldn't finish".
// Display text only: the stored setType / rpe after logging the same sets are pinned
// from main (7dc75ff), and an old (v8) backup still displays with the new words.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'

const h = React.createElement
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const OLD = ['WU set', 'WU ·', 'Failure', 'Replace exercise']

let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

async function harness(payload, { viaImport = false } = {}) {
  localStorage.clear()
  if (!viaImport) localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...payload, activeWorkout: null }))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const captured = {}
  function Grab({ children }) {
    // A test harness reading the live store out of the tree (as req-173.test.js).
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return children ?? null
  }
  const mount = async (child) => {
    await view?.unmount()
    view = await render(h(StoreProvider, null, h(Grab, null, child)))
  }
  await mount(null)
  if (viaImport) await act(async () => captured.store.applyBackup(payload))
  return { captured, mount }
}

describe('req-175 — the live workout: new words on screen, stored setType / rpe unchanged', () => {
  it('Leg Extension: Warm-up set title and preview, Swap exercise, "Couldn\'t finish"; the finished sets deep-equal main', async () => {
    const { captured, mount } = await harness(fixture())
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { RPE_OPTIONS } = await import('./ids.js')
    await act(async () => captured.store.startWorkout('sess-lower'))
    await mount(h(WorkoutItemLog, { routineId: 'sess-lower', itemId: 'si-sess-lower-2-ex-leg-extension' }))
    const text = view.text()
    assert.match(text, /Warm-up set/)
    assert.match(text, /Warm-up · /, 'the set preview line')
    assert.match(text, /Swap exercise/)
    for (const old of OLD) assert.equal(text.includes(old), false, `"${old}" still on screen`)
    await view.click(view.button('Complete')) // the warm-up, as prefilled
    const effort5 = RPE_OPTIONS.find((o) => o.value === 5).label // label-agnostic, so it runs on main too
    assert.equal(effort5, "Couldn't finish")
    assert.ok(view.button(effort5), 'the Effort control shows the new word')
    assert.equal(view.text().includes('Failure'), false)
    await view.click(view.button(effort5))
    await view.click(view.button('Complete'))
    await act(async () => captured.store.finishWorkout({}))
    const finished = captured.store.workouts[0]
    const logged = finished.sets.filter((s) => s.exerciseId === 'ex-leg-extension')
    assert.deepEqual(logged, EXPECTED_MAIN)
  })
})

// Pinned from main (7dc75ff): these same steps (the Effort segment picked by
// RPE_OPTIONS value 5, so label-agnostic) run on an export of origin/main printed exactly
// these four records — the warm-up, the "Couldn't finish" work set, and Finish's two skips.
const LEG = { routineItemId: 'si-sess-lower-2-ex-leg-extension', exerciseId: 'ex-leg-extension' }
const EXPECTED_MAIN = [
  { ...LEG, setType: 'wu', weight: 9, reps: '12', rpe: null, note: '', targetReps: '12', targetWeight: null },
  { ...LEG, setType: 'work', weight: 18, reps: '12', rpe: 5, note: '', targetReps: '12', targetWeight: 20 },
  { ...LEG, setType: 'work', weight: 0, reps: 'skipped', rpe: null, note: 'skipped', targetReps: '12', targetWeight: 24 },
  { ...LEG, setType: 'work', weight: 0, reps: 'skipped', rpe: null, note: 'skipped', targetReps: '13', targetWeight: 24 },
]

describe('req-175 — an imported old (v8) backup displays with the new words', () => {
  it('History: "Warm-up set" rows, "Couldn\'t finish" effort, "{n} kg lifted" with a thousands separator', async () => {
    const { captured, mount } = await harness(fixture(), { viaImport: true })
    const { HistoryDetail, HistoryWorkoutExercise } = await importJsx('./views/history/index.jsx', import.meta.url)
    const { workoutVolume } = await import('./history-queries.js')
    const workout = captured.store.workouts.find((w) => w.id === 'wo-w42-sess-upper')
    const stored = workout.sets.filter((s) => s.exerciseId === 'ex-chest-press').map(({ setType, rpe }) => ({ setType, rpe }))
    assert.deepEqual(stored, [
      { setType: 'wu', rpe: null },
      { setType: 'work', rpe: 4 },
      { setType: 'work', rpe: 5 },
      { setType: 'work', rpe: 5 },
    ], 'the import keeps the stored values')

    await mount(h(HistoryWorkoutExercise, { workoutId: workout.id, exerciseId: 'ex-chest-press' }))
    let text = view.text()
    assert.match(text, /Warm-up set · /)
    assert.match(text, /Couldn't finish/)
    for (const old of OLD) assert.equal(text.includes(old), false, `"${old}" still on screen`)

    await mount(h(HistoryDetail, { workoutId: workout.id }))
    text = view.text()
    const volume = workoutVolume(workout)
    assert.ok(volume >= 1000, `fixture volume ${volume} exercises the separator`)
    assert.ok(text.includes(`${volume.toLocaleString('en-US')} kg lifted`), text)
    assert.match(text, /\d,\d{3} kg lifted/)
    for (const old of OLD) assert.equal(text.includes(old), false, `"${old}" still on screen`)
  })
})
