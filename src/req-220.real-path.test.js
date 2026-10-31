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
import { emptyState } from './persistence.js'
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
    await view.click(view.button('Not sure what weight? Help me find it')) // req-239 test edit: the link replaces [Set it up]
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

// req-226 (req-220 review latent) — the paths the run above does not reach, each driven through
// its screen, then the stored state (what the export and the import preview read) checked for
// fields FIELDS does not describe. One StoreProvider per test, the screen swapped inside it (L-051).
describe('req-226 — the app paths the first run did not reach: no undocumented field', () => {
  async function app({ routine = true } = {}) {
    localStorage.clear()
    localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
    localStorage.setItem(KEY, JSON.stringify(emptyState()))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
    const captured = {}
    function Screen({ child }) {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return child
    }
    function Host() {
      const [screen, setScreen] = React.useState({ n: 0, child: null })
      // oxlint-disable-next-line react/immutability
      captured.setScreen = setScreen
      return h(StoreProvider, null, h(Screen, { key: screen.n, child: screen.child }), h(ConfirmSheet))
    }
    view = await render(h(Host))
    const store = () => captured.store
    const show = async (child) => {
      await act(async () => captured.setScreen((screen) => ({ n: screen.n + 1, child })))
      await flush()
    }
    const ids = {}
    await act(async () => {
      ids.press = store().addExercise({ name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' })
    })
    await act(async () => {
      ids.plank = store().addExercise({ name: 'Plank', equipment: 'Bodyweight', type: 'bodyweight', hasDuration: true, durationSec: 30 })
    })
    await act(async () => {
      ids.row = store().addExercise({ name: 'Seated Row', equipment: 'Machine', type: 'machine', weightStep: '5' })
    })
    if (routine) {
      await act(async () => {
        ids.routine = store().addRoutine({ name: 'Upper', focus: '' })
      })
      await act(async () => store().addRoutineExercise(ids.routine, { exerciseId: ids.press, sets: 2, targets: ['10', '10'], suggestedWeights: [40, 40] }))
      await act(async () => store().addRoutineExercise(ids.routine, { exerciseId: ids.plank, sets: 2, targets: ['', ''], durations: [30, 30] }))
    }
    return { store, show, ids }
  }
  const box = (prefix) =>
    view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null
  const rowMenu = (name) => view.all('button').find((b) => b.getAttribute('aria-label') === `Swap or skip ${name}`)
  const clean = (label) => assert.deepEqual(undocumentedFields(stored()), [], label)
  async function started(t) {
    await act(async () => t.store().startWorkout(t.ids.routine))
    const items = t.store().activeWorkout.snapshot.items
    const key = (exerciseId) => items.find((item) => item.exerciseId === exerciseId).routineItemId
    const views = await importJsx('./views/workout/item.jsx', import.meta.url)
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    return {
      press: key(t.ids.press),
      plank: key(t.ids.plank),
      log: (itemId) => h(views.WorkoutItemLog, { routineId: t.ids.routine, itemId }),
      review: (itemId) => h(views.WorkoutItemDone, { routineId: t.ids.routine, itemId }),
      overview: () => h(Workout, { routineId: t.ids.routine }),
    }
  }
  async function finish(t) {
    if (getPendingConfirm()) answerConfirm(false)
    await act(async () => t.store().finishWorkout({ overallNote: '', overallFeel: '' }))
    return stored().workouts[0]
  }

  it('Swap through the overview "⋯" sheet and the picker', async () => {
    const t = await app()
    const w = await started(t)
    await t.show(w.overview())
    await view.click(rowMenu('Chest Press'))
    answerConfirm('swap')
    await flush()
    const { WorkoutItemReplace } = await importJsx('./views/workout/replace.jsx', import.meta.url)
    await t.show(h(WorkoutItemReplace, { routineId: t.ids.routine, itemId: w.press }))
    await view.click(box('Seated Row'))
    await view.click(view.button('Swap'))
    await flush()
    assert.ok(stored().activeWorkout.snapshot.items.some((item) => item.exerciseId === t.ids.row && item.replacesItemId), 'the swapped-in item')
    clean('live, after Swap')
    await finish(t)
    clean('finished, after Swap')
  })

  it('Add exercise through the mid-workout picker (no-history step)', async () => {
    const t = await app()
    await started(t)
    const { WorkoutAdd } = await importJsx('./views/workout/add.jsx', import.meta.url)
    await t.show(h(WorkoutAdd, { routineId: t.ids.routine }))
    await view.click(box('Seated Row'))
    await view.click(view.button('Add 1'))
    await flush()
    if (view.button('Add 1')) await view.click(view.button('Add 1')) // the Sets / Rest step
    await flush()
    assert.ok(stored().activeWorkout.snapshot.items.some((item) => item.exerciseId === t.ids.row), 'the added item')
    clean('live, after Add exercise')
    await finish(t)
    clean('finished, after Add exercise')
  })

  it('Add set on the exercise review, then logged', async () => {
    const t = await app()
    const w = await started(t)
    await t.show(w.log(w.press))
    for (let i = 0; i < 2; i++) await view.click(view.button('Done'))
    if (getPendingConfirm()) answerConfirm(false)
    await t.show(w.review(w.press))
    await view.click(view.button('Add set'))
    await t.show(w.log(w.press))
    await view.click(view.button('Done'))
    if (getPendingConfirm()) answerConfirm(false)
    const work = stored().activeWorkout.sets.filter((set) => set.exerciseId === t.ids.press && set.setType === 'work')
    assert.equal(work.length, 3, '2 + the added set')
    clean('live, after Add set')
    await finish(t)
    clean('finished, after Add set')
  })

  it('a timed exercise logged on its screen; Skip set; Skip exercise from the "⋯" sheet', async () => {
    const t = await app()
    const w = await started(t)
    await t.show(w.log(w.plank))
    await view.type(view.input('Duration'), '45')
    await view.click(view.button('Done'))
    await view.click(view.button('Skip set'))
    await flush()
    const sets = stored().activeWorkout.sets.filter((set) => set.exerciseId === t.ids.plank)
    assert.deepEqual(sets.map((set) => [set.durationSec ?? null, set.reps === 'skipped']), [[45, false], [null, true]], 'a timed set, then a skipped one')
    clean('live, timed + Skip set')
    await t.show(w.overview())
    await view.click(rowMenu('Chest Press'))
    answerConfirm('skip')
    await flush()
    assert.ok(stored().activeWorkout.sets.some((set) => set.exerciseId === t.ids.press && set.reps === 'skipped'), 'Skip exercise')
    clean('live, after Skip exercise')
    await finish(t)
    clean('finished, timed + skips')
  })

  it('History: a set edited, the workout edited, the recalculation applied', async () => {
    const t = await app()
    const w = await started(t)
    await t.show(w.log(w.press))
    for (let i = 0; i < 2; i++) await view.click(view.button('Done'))
    if (getPendingConfirm()) answerConfirm(false)
    await t.show(w.review(w.press))
    await view.click(view.all('[role="radio"]').find((b) => b.textContent === 'Easy')) // an effort, so the recalculation moves the kg
    const workout = await finish(t)
    const index = workout.sets.findIndex((set) => set.exerciseId === t.ids.press && set.setType === 'work')
    const history = await importJsx('./views/history/edit.jsx', import.meta.url)
    const { HistoryRecalculate } = await importJsx('./views/history/recalc.jsx', import.meta.url)
    await t.show(h(history.HistorySet, { workoutId: workout.id, index }))
    await view.type(view.input('kg'), '42,5')
    await view.type(view.input('Reps'), '9')
    await view.click(view.button('Save'))
    await flush()
    const edited = stored().workouts[0].sets[index]
    assert.deepEqual([edited.weight, edited.reps], [42.5, '9']) // reps are stored as text (schema.md)
    clean('after a History set edit')
    await t.show(h(history.HistoryEdit, { workoutId: workout.id }))
    await view.click(view.all('[role="radio"]').find((b) => b.textContent === 'Hard'))
    await view.click(view.button('Save'))
    await flush()
    assert.equal(stored().workouts[0].overallFeel, 'Hard')
    clean('after a History workout edit')
    const before = JSON.stringify(stored().routines)
    await t.show(h(HistoryRecalculate, { workoutId: workout.id }))
    await view.click(view.button('Apply'))
    await flush()
    assert.notEqual(JSON.stringify(stored().routines), before, 'the recalculation wrote the routine')
    clean('after the History recalculation')
  })

  it('applyPlan: the machines-first flow, two days, A/B, Save', async () => {
    const t = await app({ routine: false })
    const { RoutineMachines } = await importJsx('./views/Plan.jsx', import.meta.url)
    window.location.hash = '#/routines/new/machines'
    await t.show(h(RoutineMachines))
    for (const name of ['Chest Press', 'Seated Row']) await view.click(box(`${name} — `))
    await view.click(view.button('Next (2)'))
    await flush()
    const segment = (text) => view.all('.ui-seg__item').find((node) => node.textContent.trim() === text)
    await view.click(segment('2'))
    const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const now = new Date().getDay()
    await view.click(segment(SHORT[now]))
    await view.click(segment(SHORT[(now + 3) % 7]))
    await view.click(view.all('label.ui-check').find((node) => node.textContent.trim() === 'Two workouts, A and B').querySelector('input'))
    await view.click(view.button('Save'))
    await flush()
    const after = stored()
    assert.equal(after.routines.length, 2, 'two workouts written')
    assert.equal(after.schedule.slots.length, 2, 'two days scheduled')
    clean('after applyPlan')
  })

  it('the exercise form: every field it passes to updateExercise', async () => {
    const t = await app({ routine: false })
    const { ExerciseEdit } = await importJsx('./views/Exercises.jsx', import.meta.url)
    await t.show(h(ExerciseEdit, { exerciseId: t.ids.row }))
    await view.type(view.input('Name'), 'Seated Cable Row')
    await view.type(view.input('Equipment'), 'Cable')
    await view.type(view.input('Weight step (kg)'), '2,5')
    await view.type(view.input('Lightest weight (kg)'), '5')
    await view.click(box('Timed'))
    await view.type(view.input('Default duration (s)'), '40')
    await view.type(view.input('Muscles'), 'Back')
    await view.type(view.all('textarea')[0], 'Chest up')
    await view.click(view.button('Save'))
    await flush()
    const ex = stored().exercises.find((exercise) => exercise.id === t.ids.row)
    assert.deepEqual([ex.name, ex.equipment, ex.muscles, ex.cues, ex.hasDuration, ex.durationSec], ['Seated Cable Row', 'Cable', 'Back', 'Chest up', true, 40])
    assert.equal(String(ex.weightStep), '2.5')
    assert.equal(ex.lightestWeight, 5)
    clean('after the exercise form')
  })
})
