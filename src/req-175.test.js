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
// req-192 test edit (DEC-108 §2): "Failure" is the effort word again (rpe 5), so it leaves the
// old-words list; the retired "Max" takes its place as " · Max" (the set-line form; a bare
// "Max" could match other text).
const OLD = ['WU set', 'WU ·', ' · Max', 'Replace exercise']

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
  it('Leg Extension: Warm-up set title and preview, "Failure" (req-192; "Max" in req-177); the finished sets deep-equal main', async () => {
    const { captured, mount } = await harness(fixture())
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { RPE_OPTIONS } = await import('./ids.js')
    await act(async () => captured.store.startWorkout('sess-lower'))
    await mount(h(WorkoutItemLog, { routineId: 'sess-lower', itemId: 'si-sess-lower-2-ex-leg-extension' }))
    const text = view.text()
    assert.match(text, /Warm-up set/)
    assert.match(text, /Warm-up · /, 'the set preview line')
    // req-188 (test edit) — Swap exercise moved to the workout list's row sheet; the log
    // screen's only Skip is the set one. req-175's "Swap" wording is checked there now.
    assert.doesNotMatch(text, /Swap exercise|Skip exercise/)
    assert.match(text, /Skip set/)
    for (const old of OLD) assert.equal(text.includes(old), false, `"${old}" still on screen`)
    // req-192 test edit: the warm-up logs with "Done"; rpe 5 reads "Failure" (was "Max"), and
    // tapping it logs the set (no separate Complete).
    // req-212 test edit (DEC-119 §1) — the set screen offers no effort at all now (Failure is not
    // offered anywhere new; RPE_OPTIONS keeps 5 → "Failure" for reading old sets): the work set
    // logs with Done, rpe null, and both logged sets carry `loggedAt` (checked, then left out
    // of the pinned comparison). Was: tap "Failure" → rpe 5.
    await view.click(view.button('Done')) // the warm-up, as prefilled
    const effort5 = RPE_OPTIONS.find((o) => o.value === 5).label
    assert.equal(effort5, 'Failure')
    assert.equal(view.button(effort5), null, 'no Failure on the set screen')
    assert.equal(view.button('Max'), null)
    await view.click(view.button('Done'))
    await act(async () => captured.store.finishWorkout({}))
    const finished = captured.store.workouts[0]
    const logged = finished.sets
      .filter((s) => s.exerciseId === 'ex-leg-extension')
      .map(({ loggedAt, ...set }, i) => {
        if (i < 2) assert.ok(Number.isFinite(Date.parse(loggedAt)), 'loggedAt parses')
        else assert.equal(loggedAt, undefined, "Finish's skipped fill has no loggedAt")
        return set
      })
    assert.deepEqual(logged, EXPECTED_MAIN)
  })
})

// Pinned from main (7dc75ff): these same steps (the Effort segment picked by
// RPE_OPTIONS value 5, so label-agnostic) run on an export of origin/main printed exactly
// these four records — the warm-up, the "Couldn't finish" work set, and Finish's two skips.
const LEG = { routineItemId: 'si-sess-lower-2-ex-leg-extension', exerciseId: 'ex-leg-extension' }
const EXPECTED_MAIN = [
  { ...LEG, setType: 'wu', weight: 9, reps: '12', rpe: null, note: '', targetReps: '12', targetWeight: null },
  // req-178 (sanctioned edit) — the logged kg is main's (18: the routine now seeds it, and the
  // one-time fill set Leg Extension's routine kg to history's [18, 22, 25]); only the recorded
  // targetWeight (the routine kg) changed from [20, 24, 24] to that filled [18, 22, 25].
  // req-212 test edit — rpe 5 → null: Done logs no effort (DEC-119 §1).
  { ...LEG, setType: 'work', weight: 18, reps: '12', rpe: null, note: '', targetReps: '12', targetWeight: 18 },
  { ...LEG, setType: 'work', weight: 0, reps: 'skipped', rpe: null, note: 'skipped', targetReps: '12', targetWeight: 22 },
  { ...LEG, setType: 'work', weight: 0, reps: 'skipped', rpe: null, note: 'skipped', targetReps: '13', targetWeight: 25 },
]

describe('req-175 — an imported old (v8) backup displays with the new words', () => {
  // req-210 test edit: the "{n} kg lifted" half is now its absence (DEC-117 §4; workoutVolume removed).
  it('History: "Warm-up set" rows, "Failure" effort (req-192; "Max" in req-177), no "kg lifted"', async () => {
    const { captured, mount } = await harness(fixture(), { viaImport: true })
    const { HistoryDetail, HistoryWorkoutExercise } = await importJsx('./views/history/index.jsx', import.meta.url)
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
    assert.match(text, / · Failure\b/) // req-192 test edit: was " · Max"
    for (const old of OLD) assert.equal(text.includes(old), false, `"${old}" still on screen`)

    await mount(h(HistoryDetail, { workoutId: workout.id }))
    text = view.text()
    assert.equal(/lifted/i.test(text), false, text)
    for (const old of OLD) assert.equal(text.includes(old), false, `"${old}" still on screen`)
  })
})
