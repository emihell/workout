// req-188 (DEC-103 §2) — Swap / Skip exercise move to the workout list, "Add exercise" from
// the list, the whole-library picker. Pure parts: the add reducer (itemsAddedState →
// appendItemPatch), the swap taking the picker's prescription (replaceItemInState's 5th
// argument → replacementItem), the pill rule after both, the reload / Finish+recalc safety of
// an added item, and the sheet's askChoice. Plus the overview / log screen rendered.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { buildPlannedWorkout, migrateState, planSnapshot, recalculatedState } from './model.js'
import { itemsAddedState, replaceItemInState } from './state-reducers.js'
import {
  appendItemPatch,
  currentWorkoutItem,
  finishedState,
  isAddedMidWorkout,
  itemAllSkipped,
  itemIsMarkedDone,
  itemKey,
  replacementItem,
  skipItemPatch,
} from './workout-log.js'
import { pickerItem } from './routine-picker.js'
import { needsSetup, noHistoryItem, resolvePicks } from './mid-workout-pick.js'
import { autoCompleteArmed } from './workout-log.js'
import { routineUpdateOffer } from './routine-update-offer.js'
import { answerConfirm, askChoice, askConfirm, getPendingConfirm } from './ui/confirm.js'
import { parseRoute } from './route.js'
import { act, importJsx, render } from './test-support/render.js'

const EXERCISES = [
  { id: 'ex-a', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-c', name: 'Shoulder Press', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-n', name: 'Pec Fly', equipment: 'Machine', type: 'machine', weightStep: '5' },
  { id: 'ex-h', name: 'Row', equipment: 'Machine', type: 'machine', weightStep: '5' },
]

// ex-h has history: 3 sets 8/8/6 @ 50/50/55, from a workout whose snapshot rest was 75.
const HISTORY = [
  {
    id: 'wo-old',
    routineId: 'r-old',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: '2026-09-20T11:00:00.000Z',
    snapshot: { items: [{ id: 'ri-h', routineItemId: 'ri-h', exerciseId: 'ex-h', restSec: 75, notes: 'old note' }] },
    sets: [
      { routineItemId: 'ri-h', exerciseId: 'ex-h', setType: 'work', weight: 50, reps: '8', rpe: 3, note: '' },
      { routineItemId: 'ri-h', exerciseId: 'ex-h', setType: 'work', weight: 50, reps: '8', rpe: 3, note: '' },
      { routineItemId: 'ri-h', exerciseId: 'ex-h', setType: 'work', weight: 55, reps: '6', rpe: 4, note: '' },
    ],
  },
]

// Routine r1 = A (ex-a, 3 sets, warm-up, rest 120) then C (ex-c, 2 sets); started the real way.
function baseState() {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        focus: 'Machines',
        exercises: [
          { id: 'ri-a', exerciseId: 'ex-a', role: 'main', restSec: 120, warmup: { reps: 10 }, sets: 3, targets: ['10', '8', '6'], suggestedWeights: [40, 45, 50] },
          { id: 'ri-c', exerciseId: 'ex-c', role: 'main', restSec: 90, sets: 2, targets: ['12', '12'], suggestedWeights: [30, 30] },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: HISTORY,
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    scheduledFor: null,
    performedOn: '2026-09-23',
    scheduleSlotId: null,
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    overallNote: '',
    overallFeel: '',
    completedItemIds: [],
    restEndsAt: null,
    restPausedRemaining: null,
    sets: [],
    progression: null,
    seedOverrides: {},
  }
  return state
}

const items = (state) => state.activeWorkout.snapshot.items
const ex = (id) => EXERCISES.find((e) => e.id === id)
const reload = (state) => migrateState(JSON.parse(JSON.stringify(state)))
const realSet = (item, weight = 40, reps = '10') => ({
  routineItemId: itemKey(item),
  exerciseId: item.exerciseId,
  setType: 'work',
  weight,
  reps,
  rpe: 3,
  note: '',
  targetReps: '',
  targetWeight: null,
})
const withSets = (state, sets) => ({ ...state, activeWorkout: { ...state.activeWorkout, sets: [...state.activeWorkout.sets, ...sets] } })

describe('req-188 add reducer (itemsAddedState / appendItemPatch)', () => {
  it('appends each pick at the END, in order, addedMidWorkout, with the picker prescription', () => {
    const state = baseState()
    const nItem = noHistoryItem({ sets: '3', rest: '90' }).item // no history → the step's typed values (DEC-104)
    const hItem = pickerItem(state.workouts, ex('ex-h')).item // history
    const next = itemsAddedState(state, [
      { id: 'mid-1', exerciseId: 'ex-n', item: nItem },
      { id: 'mid-2', exerciseId: 'ex-h', item: hItem },
    ])
    assert.deepEqual(items(next).map((item) => item.exerciseId), ['ex-a', 'ex-c', 'ex-n', 'ex-h'])
    const [, , n, hh] = items(next)
    assert.equal(isAddedMidWorkout(n), true)
    assert.equal(isAddedMidWorkout(hh), true)
    assert.equal(n.id, 'mid-1')
    assert.equal(n.routineItemId, 'mid-1')
    // DEC-104: the typed sets and rest; reps and kg blank — no 3 × 10 starting plan
    assert.deepEqual([n.sets, n.targets, n.suggestedWeights, n.restSec], [3, [], [], 90])
    // history: the whole prescription — 3 × 8/8/6 @ 50/50/55, rest 75
    assert.deepEqual([hh.sets, hh.targets, hh.suggestedWeights, hh.restSec], [3, ['8', '8', '6'], [50, 50, 55], 75])
    assert.equal(hh.role, 'main')
    assert.equal(hh.warmup, null)
    assert.equal(hh.notes, '') // notes are not carried (never a copy)
    // this workout only: the routine and the sets are untouched
    assert.equal(next.routines, state.routines)
    assert.equal(next.activeWorkout.sets, state.activeWorkout.sets)
  })

  it('failure case — unknown exercise → state unchanged (same reference); no active → unchanged', () => {
    const state = baseState()
    assert.equal(itemsAddedState(state, [{ id: 'mid-x', exerciseId: 'ex-missing', item: { sets: 3 } }]), state)
    assert.equal(itemsAddedState(state, []), state)
    const idle = { ...state, activeWorkout: null }
    assert.equal(itemsAddedState(idle, [{ id: 'mid-x', exerciseId: 'ex-n', item: { sets: 3 } }]), idle)
    // one unknown among known ones: the known one is added, the unknown passed over
    const mixed = itemsAddedState(state, [
      { id: 'mid-x', exerciseId: 'ex-missing', item: { sets: 3 } },
      { id: 'mid-y', exerciseId: 'ex-n', item: { sets: 2 } },
    ])
    assert.deepEqual(items(mixed).map((item) => item.id).slice(2), ['mid-y'])
  })

  it('a key already in the snapshot is never appended twice', () => {
    const state = itemsAddedState(baseState(), [{ id: 'mid-1', exerciseId: 'ex-n', item: { sets: 1 } }])
    assert.equal(itemsAddedState(state, [{ id: 'mid-1', exerciseId: 'ex-n', item: { sets: 1 } }]), state)
    assert.equal(appendItemPatch(state.activeWorkout, items(state)[2]), null)
  })

  it('survives reload exactly, and Finish + recalc leave the routine as it was', () => {
    let state = itemsAddedState(baseState(), [{ id: 'mid-1', exerciseId: 'ex-c', item: noHistoryItem({ sets: '2', rest: '45' }).item }])
    const added = items(state)[2]
    const reloaded = reload(state)
    assert.deepEqual(items(reloaded)[2], added) // not backfilled from the routine's ex-c item
    assert.deepEqual(reload(reloaded).activeWorkout, reloaded.activeWorkout)
    state = withSets(reloaded, [realSet(added, 60, '7')])
    const finished = finishedState(state, {}, '2026-09-23T11:00:00.000Z')
    assert.equal(finished.routines, state.routines)
    const routines = recalculatedState(finished, state.activeWorkout.id).routines
    assert.deepEqual(
      routines[0].exercises.map((item) => item.exerciseId),
      ['ex-a', 'ex-c'],
      'the added item never reaches the routine',
    )
  })

  it('the req-187 routine-kg offer stays null for an added item', () => {
    const state = itemsAddedState(baseState(), [{ id: 'mid-1', exerciseId: 'ex-h', item: pickerItem(HISTORY, ex('ex-h')).item }])
    const added = items(state)[2]
    const active = withSets(state, [realSet(added, 70, '8')]).activeWorkout
    assert.equal(routineUpdateOffer(active, state.routines, added), null)
  })
})

describe('req-188 swap takes the picker prescription (replaceItemInState 5th argument)', () => {
  it('no history (DEC-104) → the typed sets, blank rest = 0, reps and kg blank; original reads skipped', () => {
    const state = baseState()
    const prescription = noHistoryItem({ sets: '4', rest: '' }).item
    const next = replaceItemInState(state, 'ri-a', 'ex-n', 'mid-s', prescription)
    assert.deepEqual(items(next).map((item) => item.exerciseId), ['ex-a', 'ex-n', 'ex-c'])
    const rep = items(next)[1]
    assert.deepEqual([rep.sets, rep.targets, rep.suggestedWeights, rep.restSec], [4, [], [], 0])
    assert.equal(isAddedMidWorkout(rep), true)
    assert.equal(rep.role, 'main')
    assert.equal(rep.replacesItemId, 'ri-a')
    assert.equal(itemAllSkipped(next.activeWorkout, items(next)[0]), true)
    assert.equal(itemIsMarkedDone(next.activeWorkout, items(next)[0]), true)
    assert.equal(next.routines, state.routines)
  })

  it('history → its whole prescription (sets, reps, kg, rest)', () => {
    const state = baseState()
    const next = replaceItemInState(state, 'ri-a', 'ex-h', 'mid-s', pickerItem(state.workouts, ex('ex-h')).item)
    const rep = items(next)[1]
    assert.deepEqual([rep.sets, rep.targets, rep.suggestedWeights, rep.restSec], [3, ['8', '8', '6'], [50, 50, 55], 75])
  })

  it('without a prescription it is the req-109/req-178 blank item still (1 set, first kg)', () => {
    const state = baseState()
    const rep = items(replaceItemInState(state, 'ri-a', 'ex-h', 'mid-s'))[1]
    assert.deepEqual([rep.sets, rep.targets, rep.suggestedWeights, rep.restSec], [1, [], [50], 75])
  })

  it('keeps the original role (a warm-up slot stays a warm-up) even with a prescription', () => {
    const rep = replacementItem({ id: 'x', original: { role: 'warmup' }, exercise: ex('ex-n'), prescription: { sets: 2, role: 'main' } })
    assert.equal(rep.role, 'warmup')
    assert.equal(rep.sets, 2)
  })
})

describe('req-188 the workout pill (currentWorkoutItem) after a Swap and an Add', () => {
  it('Swap after a logged set → the pill points at the replacement (3 sets, not done)', () => {
    let state = baseState()
    const a = items(state)[0]
    state = withSets(state, [{ ...realSet(a, 20, '10'), setType: 'wu', rpe: null }, realSet(a)])
    assert.equal(itemKey(currentWorkoutItem(state.activeWorkout)), 'ri-a')
    state = replaceItemInState(state, 'ri-a', 'ex-n', 'mid-s', noHistoryItem({ sets: '3' }).item)
    const current = currentWorkoutItem(state.activeWorkout)
    assert.equal(itemKey(current), 'mid-s')
    assert.equal(current.sets, 3)
  })

  it('Add: the appended item becomes current once everything before it is done; logging on it keeps it', () => {
    let state = baseState()
    const [a, c] = items(state)
    state = withSets(state, [realSet(a)])
    state = { ...state, activeWorkout: { ...state.activeWorkout, ...skipItemPatch(state.activeWorkout, 'ri-a') } }
    state = { ...state, activeWorkout: { ...state.activeWorkout, ...skipItemPatch(state.activeWorkout, itemKey(c)) } }
    assert.equal(currentWorkoutItem(state.activeWorkout), null, 'all done → no pill')
    state = itemsAddedState(state, [{ id: 'mid-1', exerciseId: 'ex-n', item: noHistoryItem({ sets: '3' }).item }])
    assert.equal(itemKey(currentWorkoutItem(state.activeWorkout)), 'mid-1')
    state = withSets(state, [realSet(items(state)[2])])
    assert.equal(itemKey(currentWorkoutItem(state.activeWorkout)), 'mid-1')
  })

  it('Add while A is in progress → the pill stays on A', () => {
    let state = baseState()
    state = withSets(state, [realSet(items(state)[0])])
    state = itemsAddedState(state, [{ id: 'mid-1', exerciseId: 'ex-n', item: { sets: 2 } }])
    assert.equal(itemKey(currentWorkoutItem(state.activeWorkout)), 'ri-a')
  })
})

describe('req-188 / DEC-104 no-history step (mid-workout-pick.js)', () => {
  it('Sets required, a positive whole number; Rest optional (blank = 0, no timer); reps and kg blank', () => {
    assert.deepEqual(noHistoryItem({ sets: '3', rest: '' }).item, {
      role: 'main', warmup: null, notes: '', sets: 3, targets: [], suggestedWeights: [], durations: [], restSec: 0,
    })
    assert.equal(noHistoryItem({ sets: ' 5 ', rest: '75' }).item.restSec, 75)
    for (const sets of ['', '0', '2.5', '-1', 'three']) assert.ok(noHistoryItem({ sets, rest: '' }).errors.sets, `sets "${sets}"`)
    for (const rest of ['1.5', '-30', 'abc']) assert.ok(noHistoryItem({ sets: '3', rest }).errors.rest, `rest "${rest}"`)
    assert.ok(noHistoryItem().errors.sets, 'the step starts empty, so Save without typing is refused')
  })

  it('a history pick needs no step; resolvePicks keeps its item and fills only no-history picks', () => {
    const hist = { kind: 'own', exerciseId: 'ex-h', source: 'history', item: pickerItem(HISTORY, ex('ex-h')).item }
    const fresh = { kind: 'library', data: { name: 'New' }, source: 'starting', item: pickerItem([], ex('ex-n')).item }
    assert.equal(needsSetup(hist), false)
    assert.equal(needsSetup(fresh), true)
    const ok = resolvePicks([hist, fresh], [{}, { sets: '2', rest: '' }])
    assert.equal(ok.picks[0].item, hist.item)
    assert.deepEqual([ok.picks[1].item.sets, ok.picks[1].item.targets, ok.picks[1].item.restSec], [2, [], 0])
    assert.deepEqual(Object.keys(resolvePicks([hist, fresh], [{}, { sets: '' }]).errors), ['1'])
  })
})

describe('req-188 review fixes', () => {
  it('B repro: A, C, then Add N; log a set of A, Skip C → the pill stays on A (not the appended N)', () => {
    let state = baseState()
    state = itemsAddedState(state, [{ id: 'mid-n', exerciseId: 'ex-n', item: noHistoryItem({ sets: '2' }).item }])
    state = withSets(state, [{ ...realSet(items(state)[0], 20, '10'), setType: 'wu', rpe: null }, realSet(items(state)[0])])
    state = { ...state, activeWorkout: { ...state.activeWorkout, ...skipItemPatch(state.activeWorkout, 'ri-c') } }
    assert.equal(itemKey(currentWorkoutItem(state.activeWorkout)), 'ri-a')
  })

  it('B: replacesItemId only on a Swap item, and it survives a reload', () => {
    let state = replaceItemInState(baseState(), 'ri-a', 'ex-n', 'mid-s', noHistoryItem({ sets: '3' }).item)
    state = itemsAddedState(state, [{ id: 'mid-n', exerciseId: 'ex-h', item: pickerItem(HISTORY, ex('ex-h')).item }])
    const reloaded = reload(state)
    const byId = (s, id) => items(s).find((item) => item.id === id)
    assert.equal(byId(reloaded, 'mid-s').replacesItemId, 'ri-a')
    assert.equal('replacesItemId' in byId(reloaded, 'mid-n'), false)
    assert.deepEqual(reloaded.activeWorkout.snapshot.items, state.activeWorkout.snapshot.items)
  })

  it('C: an add clears autoFinishDismissed, so the summary arms again once the added item is done', () => {
    let state = baseState()
    const [a, c] = items(state)
    state = withSets(state, [realSet(a)])
    state = { ...state, activeWorkout: { ...state.activeWorkout, ...skipItemPatch(state.activeWorkout, itemKey(a)) } }
    state = { ...state, activeWorkout: { ...state.activeWorkout, ...skipItemPatch(state.activeWorkout, itemKey(c)), autoFinishDismissed: true } }
    assert.equal(autoCompleteArmed(state.activeWorkout), false, 'cancelled summary')
    state = itemsAddedState(state, [{ id: 'mid-n', exerciseId: 'ex-n', item: noHistoryItem({ sets: '1' }).item }])
    assert.equal('autoFinishDismissed' in state.activeWorkout, false)
    state = withSets(state, [realSet(items(state)[2])])
    assert.equal(autoCompleteArmed(state.activeWorkout), true)
    // nothing added → nothing cleared (same reference)
    const dismissed = { ...state, activeWorkout: { ...state.activeWorkout, autoFinishDismissed: true } }
    assert.equal(itemsAddedState(dismissed, [{ id: 'x', exerciseId: 'ex-missing', item: {} }]), dismissed)
  })
})

describe('req-188 askChoice (the row sheet) and the add route', () => {
  it('resolves the chosen value; Cancel → null; a plain askConfirm after it is still boolean', async () => {
    const choices = [
      { value: 'swap', label: 'Swap exercise' },
      { value: 'skip', label: 'Skip exercise' },
    ]
    const first = askChoice('', { title: 'Chest Press', choices })
    assert.deepEqual(getPendingConfirm().choices, choices)
    answerConfirm('skip')
    assert.equal(await first, 'skip')
    const second = askChoice('', { choices })
    answerConfirm(false) // Cancel / backdrop / Escape / navigation
    assert.equal(await second, null)
    const third = askChoice('', { choices })
    const replaced = askConfirm('Abandon?', { confirmLabel: 'Abandon' }) // a new ask cancels the open one
    assert.equal(await third, null)
    answerConfirm(true)
    assert.equal(await replaced, true)
  })

  it('/workout/<id>/add is the Add exercise route', () => {
    assert.deepEqual(parseRoute('/workout/r1/add'), { name: 'workout-add', routineId: 'r1' })
  })
})

// --- rendered: the overview's "⋯" and the log screen ---
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

describe('req-188 rendered', () => {
  it('overview: a "⋯" per not-done row (none on a done row), Skip in the sheet is one tap, "Add exercise" link', async () => {
    const { captured, mount } = await harness()
    const { Workout } = await importJsx('./views/workout/overview.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-upper'))
    await mount(h(Workout, { routineId: 'sess-upper' }))
    const list = captured.store.activeWorkout.snapshot.items
    const menus = () => view.all('button.ui-row-menu')
    assert.equal(menus().length, list.length)
    assert.ok(view.all('a').some((a) => a.textContent.includes('Add exercise') && a.getAttribute('href')?.endsWith('/workout/sess-upper/add')))
    // the "⋯" is outside the row link
    assert.equal(menus()[0].closest('a'), null)
    await act(async () => menus()[0].click())
    assert.deepEqual(getPendingConfirm().choices.map((c) => c.label), ['Swap exercise', 'Skip exercise'])
    await act(async () => answerConfirm('skip'))
    const first = captured.store.activeWorkout.snapshot.items[0]
    assert.ok(captured.store.activeWorkout.completedItemIds.includes(itemKey(first)))
    assert.match(view.text(), / · skipped/)
    assert.equal(menus().length, list.length - 1, 'the skipped (done) row has no "⋯"')
  })

  it('log screen: one Skip control ("Skip set"), no Swap / Skip exercise', async () => {
    const { captured, mount } = await harness()
    const { WorkoutItemLog } = await importJsx('./views/workout/item.jsx', import.meta.url)
    await act(async () => captured.store.startWorkout('sess-upper'))
    const first = captured.store.activeWorkout.snapshot.items[0]
    await mount(h(WorkoutItemLog, { routineId: 'sess-upper', itemId: itemKey(first) }))
    const skips = view.all('button, a').filter((el) => /skip/i.test(el.textContent))
    assert.deepEqual(skips.map((el) => el.textContent.trim()), ['Skip set'])
    assert.doesNotMatch(view.text(), /Swap exercise|Skip exercise/)
  })
})
