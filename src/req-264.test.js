// req-264 — small UI fixes (DEC-155 §2):
//  (a) Change exercise to another plan kind with no history → that kind's starting plan
//      (pickerItem), id/notes/role/warmup kept; same kind / with history byte-identical to main.
//  (b) the import sheet: Keep my history is the filled primary, Replace the secondary.
//  (c) the Days row / delete confirm in a multi-week loop: every-week days bare.
//  (d) the picker's empty-search grouping: Burpee under Legs; nothing else moves.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from './test-support/render.js'
import { fullState } from './test-support/full-state.js'
import { loadExerciseCatalog } from './exerciseCatalog.js'
import { changedRoutineItem, changeTakesStartingPlan, routineItemExerciseChanged } from './routine-item-change.js'
import { MUSCLE_GROUPS } from './exerciseLibrary.js'
import { listable } from './exerciseCatalog.js'
import { pickerItem, planKind, staplesByMuscle } from './routine-picker.js'
import { IMPORT_CHOICES, importMode } from './import-backup.js'
import { askChoice, answerConfirm } from './ui/confirm.js'
import { routineScheduledDaysText } from './state-reducers.js'
import { daysRowText } from './schedule-days.js'

const catalog = await loadExerciseCatalog()
const h = React.createElement

// ---- (a) ----

const SQUAT = { id: 'squat', name: 'Squat', type: 'free', hasDuration: false }
const ROWER = { id: 'rower', name: 'Rower', type: 'cardio', hasDuration: false }
const PLANK = { id: 'plank', name: 'Plank', type: 'bodyweight', hasDuration: true, durationSec: 30 }
const WALLSIT = { id: 'wallsit', name: 'Wall Sit', type: 'bodyweight', hasDuration: true, durationSec: 45 }
const PRESS = { id: 'press', name: 'Machine Press', type: 'machine', hasDuration: false }
const LEGPRESS = { id: 'legpress', name: 'Leg Press', type: 'machine', hasDuration: false }
const EXERCISES = [SQUAT, ROWER, PLANK, WALLSIT, PRESS, LEGPRESS]

const squatItem = { id: 'i1', exerciseId: 'squat', sets: 3, targets: ['8', '8', '8'], suggestedWeights: [60, 60, 60], durations: [], restSec: 120, notes: 'n', role: 'main', warmup: { reps: 10 } }
const plankItem = { id: 'i2', exerciseId: 'plank', sets: 3, targets: [], durations: [30, 30, 30], suggestedWeights: [], restSec: 60, notes: 'core', role: 'finisher', warmup: null }

// main's rule, written out: no history → the item's plan, kg blank.
const mainNoHistory = (item, exerciseId) => ({ ...item, exerciseId, suggestedWeights: [] })

describe('req-264 (a) — changedRoutineItem across plan kinds (pure)', () => {
  it('planKind: cardio / timed / reps; machine, free and bodyweight are one kind', () => {
    assert.deepEqual(EXERCISES.map(planKind), ['reps', 'cardio', 'timed', 'timed', 'reps', 'reps'])
  })

  it('AC1 strength → cardio, no history: the starting plan (1 set, no reps, rest 0), id/notes/role/warmup kept', () => {
    const out = changedRoutineItem(squatItem, 'rower', [], EXERCISES)
    console.log('strength→cardio', JSON.stringify(out))
    const start = pickerItem([], ROWER).item
    assert.deepEqual(out, {
      ...squatItem,
      exerciseId: 'rower',
      sets: start.sets,
      targets: start.targets,
      durations: start.durations,
      restSec: start.restSec,
      suggestedWeights: [],
    })
    assert.deepEqual([out.sets, out.targets, out.durations, out.restSec], [1, [], [], 0])
    assert.notDeepEqual(out, mainNoHistory(squatItem, 'rower'), 'differs from main')
  })

  it('AC1 timed → reps, no history: 3 × 10, 90 s rest, no seconds; id/notes/role/warmup kept', () => {
    const out = changedRoutineItem(plankItem, 'press', [], EXERCISES)
    console.log('timed→reps', JSON.stringify(out))
    assert.deepEqual(out, {
      ...plankItem,
      exerciseId: 'press',
      sets: 3,
      targets: ['10', '10', '10'],
      durations: [],
      restSec: 90,
      suggestedWeights: [],
    })
  })

  it('reps → timed, no history: STARTING_SETS × the exercise\'s seconds', () => {
    const out = changedRoutineItem(squatItem, 'wallsit', [], EXERCISES)
    assert.deepEqual([out.sets, out.targets, out.durations, out.restSec, out.notes, out.warmup], [3, [], [45, 45, 45], 90, 'n', { reps: 10 }])
  })

  it('AC1 same kind (machine → machine, free → machine, timed → timed): byte-identical to main', () => {
    for (const [item, to] of [[squatItem, 'legpress'], [squatItem, 'press'], [plankItem, 'wallsit']]) {
      const out = changedRoutineItem(item, to, [], EXERCISES)
      assert.equal(JSON.stringify(out), JSON.stringify(mainNoHistory(item, to)), `${item.exerciseId}→${to}`)
    }
  })

  it('AC1 with history (any kind): history\'s plan, byte-identical with or without the records', () => {
    const s = fullState()
    const plank = s.routines.find((r) => r.id === 'rtn-a').exercises.find((i) => i.id === 'si-plank')
    // ex-plank (timed) → ex-press (reps, has history): the history branch, not the starting plan.
    const withRecords = changedRoutineItem(plank, 'ex-press', s.workouts, s.exercises)
    const without = changedRoutineItem(plank, 'ex-press', s.workouts)
    assert.equal(JSON.stringify(withRecords), JSON.stringify(without))
    assert.deepEqual([withRecords.sets, withRecords.targets, withRecords.suggestedWeights], [2, ['10', '9'], [20, 20]])
  })

  it('AC2 failure case: an exercise record is missing → as today (no throw, no reset)', () => {
    const missingNew = changedRoutineItem(squatItem, 'ghost', [], EXERCISES)
    assert.deepEqual(missingNew, mainNoHistory(squatItem, 'ghost'))
    const missingOld = changedRoutineItem({ ...squatItem, exerciseId: 'gone' }, 'rower', [], EXERCISES)
    assert.deepEqual(missingOld, mainNoHistory({ ...squatItem, exerciseId: 'gone' }, 'rower'))
    assert.deepEqual(changedRoutineItem(squatItem, 'rower', [], undefined), mainNoHistory(squatItem, 'rower'))
    assert.equal(changeTakesStartingPlan(null, ROWER), false)
  })

  it('the routine mutator passes the records through', () => {
    const routine = { id: 'r', exercises: [squatItem, plankItem] }
    const out = routineItemExerciseChanged(routine, 'i1', 'rower', [], EXERCISES)
    assert.equal(out.exercises[0].sets, 1)
    assert.equal(out.exercises[1], plankItem)
  })
})

// ---- (a) rendered: the picker row's label and the store write ----

const KEY = 'workout-mvp-v9'
const stored = () => JSON.parse(localStorage.getItem(KEY))
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
async function mountWith(payload, child) {
  localStorage.clear()
  localStorage.setItem(KEY, JSON.stringify(payload))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  view = await render(h(StoreProvider, null, child))
  await flush()
}
const box = (prefix) =>
  view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null
const itemOf = (state, itemId) => state.routines.find((r) => r.id === 'rtn-a').exercises.find((i) => i.id === itemId)

describe('req-264 (a) — Change exercise screen (rendered, real store)', () => {
  it('reps → cardio (never logged): the row shows the starting-plan label; the item becomes 1 set, rest 0, note kept', async () => {
    const payload = fullState()
    payload.workouts = []
    payload.activeWorkout = null
    const { RoutineExerciseChange } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mountWith(payload, h(RoutineExerciseChange, { routineId: 'rtn-a', itemId: 'si-press' }))
    await view.click(box('Bike'))
    const text = view.text()
    console.log('row', JSON.stringify(text.match(/Starting plan[^]*?time|Keeps[^]*?blank/)?.[0]))
    assert.match(text, /Starting plan: 1 set — change any time/)
    assert.doesNotMatch(text, /Keeps sets, reps and rest/)
    await view.click(view.button('Change'))
    const item = itemOf(stored(), 'si-press')
    console.log('stored', JSON.stringify(item))
    assert.deepEqual([item.exerciseId, item.sets, item.targets, item.restSec, item.notes, item.suggestedWeights], ['ex-bike', 1, [], 0, 'slow', []])
  })

  it('same kind (machine → machine, never logged): "Keeps sets, reps and rest — kg blank", plan kept', async () => {
    const payload = fullState()
    payload.workouts = []
    payload.activeWorkout = null
    const { RoutineExerciseChange } = await importJsx('./views/Routine.jsx', import.meta.url)
    await mountWith(payload, h(RoutineExerciseChange, { routineId: 'rtn-a', itemId: 'si-press' }))
    await view.click(box('Seated Row'))
    assert.match(view.text(), /Keeps sets, reps and rest — kg blank/)
    await view.click(view.button('Change'))
    const item = itemOf(stored(), 'si-press')
    assert.deepEqual([item.exerciseId, item.sets, item.targets, item.restSec, item.suggestedWeights], ['ex-row', 2, ['10', '10'], 90, []])
  })
})

// ---- (b) ----

describe('req-264 (b) — the import sheet highlights Keep my history', () => {
  it('Keep has the primary class, Replace the secondary (rendered ConfirmSheet)', async () => {
    const { ConfirmSheet } = await importJsx('./ui/index.jsx', import.meta.url)
    view = await render(h(ConfirmSheet))
    let answer
    await act(async () => {
      answer = askChoice('msg', { title: 'This file changes your logged history', choices: IMPORT_CHOICES })
    })
    const buttons = [...document.body.querySelectorAll('.ui-sheet__choices button')]
    const classes = buttons.map((b) => [b.textContent, b.className])
    console.log('sheet', JSON.stringify(classes))
    assert.deepEqual(buttons.map((b) => b.textContent), ['Keep my history', 'Replace everything'])
    assert.ok(buttons[0].classList.contains('ui-btn--primary'))
    assert.ok(!buttons[0].classList.contains('ui-btn--secondary'))
    assert.ok(buttons[1].classList.contains('ui-btn--secondary'))
    assert.ok(!buttons[1].classList.contains('ui-btn--primary'))
    await act(async () => answerConfirm(false))
    assert.equal(await answer, null, "Cancel → no answer (importMode → null)")
  })

  it('importMode answers unchanged', () => {
    const conflict = { conflict: true }
    assert.deepEqual(
      [true, 'keep', 'replace', false, null, 'other'].map((a) => importMode(a, conflict)),
      ['keep', 'keep', 'replace', null, null, null],
    )
    assert.deepEqual([true, 'keep', 'replace', false].map((a) => importMode(a, {})), ['replace', 'replace', 'replace', null])
    assert.ok(IMPORT_CHOICES.every((choice) => !choice.destructive), 'no destructive marking on the import choices')
  })
})

// ---- (c) ----

const MON = 1, WED = 3, THU = 4, FRI = 5
const stateWith = (loopWeeks, slots) => ({
  schedule: { loopWeeks, slots: slots.map(([week, weekday], i) => ({ id: `s${i}`, week, weekday, routineId: 'r' })) },
})
const everyWeek = (loop, days) => Array.from({ length: loop }, (_, w) => days.map((d) => [w, d])).flat()

describe('req-264 (c) — Days row in a multi-week loop', () => {
  it('4-wk loop, Mon/Wed/Fri every week → "Mon, Wed and Fri"', () => {
    const s = stateWith(4, everyWeek(4, [MON, WED, FRI]))
    console.log('4wk', routineScheduledDaysText(s, 'r'))
    assert.equal(routineScheduledDaysText(s, 'r'), 'Mon, Wed and Fri')
    assert.equal(daysRowText(s, 'r'), 'Mon, Wed and Fri')
  })
  it('2-wk loop, Mon both weeks + Thu wk 1 → "Mon and Thu (week 1)"', () => {
    const s = stateWith(2, [[0, MON], [1, MON], [0, THU]])
    assert.equal(routineScheduledDaysText(s, 'r'), 'Mon and Thu (week 1)')
  })
  it('test list 7: 4-wk Mon/Wed/Fri + Thu in week 2 only → "Mon, Wed, Thu (week 2) and Fri"', () => {
    const s = stateWith(4, [...everyWeek(4, [MON, WED, FRI]), [1, THU]])
    assert.equal(routineScheduledDaysText(s, 'r'), 'Mon, Wed, Thu (week 2) and Fri')
  })
  it('a day on in several but not all weeks keeps each week (Mon-first, then week)', () => {
    const s = stateWith(4, [[2, MON], [0, MON], [1, FRI]])
    assert.equal(routineScheduledDaysText(s, 'r'), 'Mon (week 1), Mon (week 3) and Fri (week 2)')
  })
  it('a 1-week loop and an unscheduled routine read as on main', () => {
    assert.equal(routineScheduledDaysText(stateWith(1, [[0, FRI], [0, MON], [0, 0]]), 'r'), 'Mon, Fri and Sun')
    assert.equal(routineScheduledDaysText(stateWith(1, [[0, WED]]), 'r'), 'Wed')
    assert.equal(routineScheduledDaysText(stateWith(undefined, [[0, MON], [0, THU]]), 'r'), 'Mon and Thu')
    assert.equal(routineScheduledDaysText(stateWith(4, []), 'r'), '')
    assert.equal(daysRowText(stateWith(4, []), 'r'), 'Not scheduled')
    assert.equal(routineScheduledDaysText({}, 'r'), '')
  })
})

// ---- (d) ----

// main's rule, written out independently: a listable staple under its first group in
// MUSCLE_GROUPS order.
function mainGrouping(list) {
  const groups = new Set(Object.keys(MUSCLE_GROUPS))
  const map = {}
  for (const item of list) {
    if (!item?.staple || !listable(item)) continue
    const group = (item.muscleGroups || []).find((name) => groups.has(name))
    if (group) map[item.id] = group
  }
  return map
}
const branchGrouping = (list) =>
  Object.fromEntries(staplesByMuscle(list).flatMap(({ group, items }) => items.map((item) => [item.id, group])))

describe('req-264 (d) — picker grouping: Burpee under Legs, nothing else moves', () => {
  it('the full staple → group map equals main\'s except own-burpee Chest → Legs', () => {
    const before = mainGrouping(catalog)
    const after = branchGrouping(catalog)
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort(), 'same staples listed')
    const moved = Object.keys(before).filter((id) => before[id] !== after[id]).map((id) => `${id}: ${before[id]} → ${after[id]}`)
    console.log('staples', Object.keys(after).length, 'moved', JSON.stringify(moved))
    assert.deepEqual(moved, ['own-burpee: Chest → Legs'])
  })
  it('within each group the order is still A→Z by shown name (Burpee among the Legs rows)', () => {
    const legs = staplesByMuscle(catalog).find((g) => g.group === 'Legs')
    const chest = staplesByMuscle(catalog).find((g) => g.group === 'Chest')
    assert.ok(legs.items.some((item) => item.id === 'own-burpee'))
    assert.ok(!chest.items.some((item) => item.id === 'own-burpee'))
  })
})
