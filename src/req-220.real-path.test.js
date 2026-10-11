// req-220 review round 1 (item 5) — the anti-staleness check against state the APP wrote, not a
// hand-copied fixture: exercises and a routine through the store's editor methods, a schedule
// slot and a one-date move, Start, sets logged by clicking the real live log screen (item.jsx
// completeSet: first-time setup on a no-history exercise, a cardio set with the stopwatch, level
// and distance), the exercise effort, then Finish. undocumentedFields must be [] both while the
// workout is live (firstTimeSetup, seedOverrides, stopwatch / setDraft) and after Finish. One
// StoreProvider for the whole test, the screen swapped inside it (L-051).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { undocumentedFields } from './exchange.js'
import { emptyState } from './storage.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'

const h = React.createElement
const KEY = 'workout-mvp-v9'
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const stored = () => JSON.parse(localStorage.getItem(KEY))

let view = null
afterEach(async () => {
  if (getPendingConfirm()) answerConfirm(false)
  if (view) await view.unmount()
  view = null
})

async function withClock(start, fn) {
  const realNow = Date.now
  const clock = { t: start }
  Date.now = () => clock.t
  try {
    await fn(clock)
  } finally {
    Date.now = realNow
  }
}

describe('req-220 item 5 — every field the app itself writes is described', () => {
  it('editors → schedule → Start → logged through item.jsx → effort → Finish: no undocumented field, live or finished', async () => {
    localStorage.clear()
    localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
    localStorage.setItem(KEY, JSON.stringify(emptyState()))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
    const captured = {}
    function Screen({ child }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return child
    }
    function Host() {
      const [child, setChild] = React.useState(null)
      // oxlint-disable-next-line react/immutability
      captured.setChild = setChild
      return h(StoreProvider, null, h(Screen, { child }), h(ConfirmSheet))
    }
    view = await render(h(Host))
    const store = () => captured.store

    // The editors' store methods (Exercises / Routine screens call these).
    let press, bike, routine
    await act(async () => {
      press = store().addExercise({ name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '2.5', muscles: 'Chest', cues: 'Sit tall', libraryId: 'Leverage_Chest_Press' })
    })
    await act(async () => store().updateExercise(press, { lightestWeight: 10 }))
    await act(async () => {
      bike = store().addExercise({ name: 'Bike', equipment: 'Bike', type: 'cardio' })
    })
    await act(async () => {
      routine = store().addRoutine({ name: 'Upper', focus: 'Machines' })
    })
    await act(async () => store().addRoutineExercise(routine, { exerciseId: bike, role: 'warmup', sets: 1, targets: ['5-8 min'] }))
    await act(async () => store().addRoutineExercise(routine, { exerciseId: press, sets: 2, targets: ['10', '10'], restSec: 90, warmup: { reps: 12 } }))
    let slot
    await act(async () => {
      slot = store().addSlot({ week: 0, weekday: 1, routineId: routine })
    })
    await act(async () => store().moveSlotOnDate({ slotId: slot, date: '2026-10-05', to: '2026-10-07' }))
    assert.deepEqual(undocumentedFields(stored()), [], 'setup as the editors wrote it')

    await act(async () => store().startWorkout(routine))
    const items = store().activeWorkout.snapshot.items
    const [bikeItem, pressItem] = items.map((item) => item.routineItemId)
    const open = (itemId) => act(async () => captured.setChild(h(WorkoutItemLog, { routineId: routine, itemId })))

    // Cardio: stopwatch running (a live `stopwatch`), then level + distance, Done.
    await open(bikeItem)
    await withClock(Date.now(), async (clock) => {
      await view.click(view.button('Start'))
      assert.ok(stored().activeWorkout.stopwatch, 'a live stopwatch (so the next check covers it)')
      assert.deepEqual(undocumentedFields(stored()), [], 'live, stopwatch running')
      clock.t += 125_000
      await view.type(view.input('Level'), '8')
      await view.type(view.input('Distance'), '1,5')
      await view.click(view.all('[role="radio"]').find((b) => b.textContent === 'km'))
      await flush()
      await view.click(view.button('Done'))
    })
    await flush()
    if (getPendingConfirm()) answerConfirm(false)

    // A no-history weighted exercise: first-time setup, the warm-up set, set 1, "How was that?".
    await open(pressItem)
    const logFirstVisible = async (kg, reps) => {
      if (kg != null) await view.type(view.input('kg'), kg)
      if (reps != null) await view.type(view.input('Reps'), reps)
      await view.click(view.button('Done'))
      await flush()
    }
    await logFirstVisible('10', '12') // the warm-up set
    await view.click(view.button('Set it up')) // the prompt shows on the first working set
    await logFirstVisible('20', '10') // set 1
    if (getPendingConfirm()?.title === 'How was that?' || view.button('Easy')) await view.click(view.button('Easy'))
    await flush()
    await view.type(view.input('kg'), '25') // a typed kg → the live set draft (written after DRAFT_WRITE_MS)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)))
    const live = stored()
    assert.deepEqual(undocumentedFields(live), [], 'live: firstTimeSetup, seedOverrides, setDraft…')
    // the nested live values were really there, so the check above covered them
    for (const field of ['firstTimeSetup', 'seedOverrides', 'setDraft']) assert.ok(live.activeWorkout[field], field)
    assert.ok(Object.values(live.activeWorkout.firstTimeSetup)[0].seed, 'firstTimeSetup.seed')
    await logFirstVisible(null, null) // set 2
    if (getPendingConfirm()) answerConfirm(false)
    await act(async () => store().setItemEffort(pressItem, 3))
    assert.deepEqual(undocumentedFields(stored()), [], 'live, after the effort')

    await act(async () => store().finishWorkout({ overallNote: 'Good', overallFeel: 'Strong' }))
    const done = stored()
    assert.deepEqual(undocumentedFields(done), [], 'finished')
    // The fields the check covered here, written by the app itself:
    const sets = done.workouts[0].sets
    const cardio = sets.find((set) => set.exerciseId === bike)
    assert.deepEqual([cardio.durationSec, cardio.level, cardio.distance, cardio.distanceUnit], [125, 8, 1.5, 'km'])
    assert.ok(sets.filter((set) => set.reps !== 'skipped').every((set) => typeof set.loggedAt === 'string'), 'loggedAt on every logged set')
    assert.ok(sets.some((set) => set.setType === 'wu'))
    assert.ok(sets.some((set) => set.rpe === 3))
    assert.equal(done.exercises.find((exercise) => exercise.id === press).libraryId, 'Leverage_Chest_Press')
    assert.equal(done.schedule.moves.length, 1)
    assert.deepEqual(done.routines[0].exercises[1].warmup, { reps: 12 })
  })
})
