// req-262 — four small model fixes: past one-date swaps pruned on write, a cardio item's Apply
// keeps its own plan, Back after a left-open Finish (finished in this tab) shows Done, and two
// key-less snapshot items no longer share their sets.
process.env.TZ = 'Europe/Stockholm'

import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { slotSwappedOnDateState } from './state-reducers.js'
import { doneEarlier } from './schedule.js'
import { progressionForItem, recalculatedState, migrateState } from './model.js'
import { finishedForPlan } from './current-workout.js'
import { finishTimeFor, setsForItem, withSkippedUnloggedSets } from './workout-log.js'

const h = React.createElement

// ---- AC1 swaps ---------------------------------------------------------------------------
// Today Wed 2026-10-28; this week's Monday 2026-10-26; last week's Sunday 2026-10-25.
const TODAY = '2026-10-28'
const swapState = () => ({
  routines: [{ id: 'A', name: 'A', exercises: [] }, { id: 'B', name: 'B', exercises: [] }],
  schedule: {
    loopWeeks: 1,
    anchor: '2026-10-26',
    slots: [{ id: 's1', week: 0, weekday: 2, routineId: 'A' }, { id: 's2', week: 0, weekday: 4, routineId: 'A' }],
    moves: [],
    swaps: [
      { id: 'w2020', slotId: 's1', date: '2020-01-06', routineId: 'B' },
      { id: 'wSun', slotId: 's1', date: '2026-10-25', routineId: 'B' },
      { id: 'wMon', slotId: 's1', date: '2026-10-26', routineId: 'B' },
      { id: 'wToday', slotId: 's1', date: TODAY, routineId: 'B' },
    ],
  },
  workouts: [],
})

describe('req-262 AC1 — past one-date swaps are pruned on write', () => {
  it('a new swap drops 2020 and last Sunday, keeps this Monday and today', () => {
    const next = slotSwappedOnDateState(swapState(), { id: 'new', slotId: 's2', date: '2026-10-30', routineId: 'B', today: TODAY })
    const dates = next.schedule.swaps.map((swap) => swap.date)
    console.log('AC1 swaps after one new swap:', JSON.stringify(dates))
    assert.deepEqual(dates, ['2026-10-26', TODAY, '2026-10-30'])
  })
  it('failure case: today absent → nothing pruned (as before)', () => {
    const next = slotSwappedOnDateState(swapState(), { id: 'new', slotId: 's2', date: '2026-10-30', routineId: 'B' })
    const dates = next.schedule.swaps.map((swap) => swap.date)
    console.log('AC1 no today:', JSON.stringify(dates))
    assert.deepEqual(dates, ['2020-01-06', '2026-10-25', '2026-10-26', TODAY, '2026-10-30'])
  })
  it('a no-op swap with stale entries still prunes; with none it is the same state', () => {
    const s = swapState()
    const same = slotSwappedOnDateState(s, { id: 'x', slotId: 's1', date: TODAY, routineId: 'B', today: TODAY })
    assert.deepEqual(same.schedule.swaps.map((swap) => swap.id), ['wMon', 'wToday'])
    assert.equal(slotSwappedOnDateState(same, { id: 'y', slotId: 's1', date: TODAY, routineId: 'B', today: TODAY }), same)
  })
  it("this week's doneEarlier is unchanged by the prune", () => {
    const s = swapState()
    // A workout of B finished Monday; the spot is s2's Thursday (no swap on it) — B swapped on s2 Thu below.
    s.schedule.swaps.push({ id: 'wThu', slotId: 's2', date: '2026-10-29', routineId: 'B' })
    s.workouts = [{ id: 'wk1', routineId: 'B', finishedAt: new Date(2026, 9, 26, 18).toISOString() }]
    const before = doneEarlier(s.workouts, 'B', '2026-10-29', 's2', s.schedule)
    const pruned = slotSwappedOnDateState(s, { id: 'n', slotId: 's2', date: '2026-10-30', routineId: 'B', today: TODAY })
    const after = doneEarlier(pruned.workouts, 'B', '2026-10-29', 's2', pruned.schedule)
    console.log('AC1 doneEarlier before/after:', before?.id ?? null, after?.id ?? null)
    assert.equal(before?.id, 'wk1')
    assert.equal(after?.id, before?.id)
  })
})

// ---- AC2 cardio Apply --------------------------------------------------------------------
const cardioState = () => ({
  exercises: [
    { id: 'row', name: 'Rowing', type: 'cardio' },
    { id: 'press', name: 'Press', type: 'machine', weightStep: 2.5 },
  ],
  routines: [
    {
      id: 'R',
      name: 'R',
      exercises: [
        { id: 'i1', exerciseId: 'row', sets: 1, targets: [], suggestedWeights: [] },
        { id: 'i2', exerciseId: 'press', sets: 2, targets: ['8', '8'], suggestedWeights: [40, 40] },
      ],
    },
  ],
  workouts: [
    {
      id: 'wk',
      routineId: 'R',
      finishedAt: '2026-10-26T17:00:00.000Z',
      snapshot: {
        items: [
          { routineItemId: 'i1', exerciseId: 'row', sets: 1, targets: [], suggestedWeights: [] },
          { routineItemId: 'i2', exerciseId: 'press', sets: 2, targets: ['8', '8'], suggestedWeights: [40, 40] },
        ],
      },
      sets: [
        { routineItemId: 'i1', exerciseId: 'row', setType: 'work', durationSec: 600, weight: 0, reps: '' },
        { routineItemId: 'i2', exerciseId: 'press', setType: 'work', weight: 40, reps: '8', rpe: null },
        { routineItemId: 'i2', exerciseId: 'press', setType: 'work', weight: 40, reps: '8', rpe: null },
      ],
    },
  ],
})

describe('req-262 AC2 — Apply on a cardio item keeps its own plan', () => {
  it('cardio item → to [] / targetsTo [] → routine item keeps [] / []', () => {
    const s = cardioState()
    const p = progressionForItem(s.exercises, s.workouts[0], s.workouts[0].snapshot.items[0])
    console.log('AC2 cardio to:', JSON.stringify(p.to), 'targetsTo:', JSON.stringify(p.targetsTo))
    assert.deepEqual(p.to, [])
    assert.deepEqual(p.targetsTo, [])
    const item = recalculatedState(s, 'wk').routines[0].exercises[0]
    console.log('AC2 cardio routine item after Apply:', JSON.stringify(item))
    assert.deepEqual(item.suggestedWeights, [])
    assert.deepEqual(item.targets, [])
  })
  it('a strength item\'s Apply is byte-identical to main', () => {
    const item = recalculatedState(cardioState(), 'wk').routines[0].exercises[1]
    const text = JSON.stringify(item)
    console.log('AC2 strength routine item after Apply:', text)
    // Recorded on main 8882329 with this same fixture.
    assert.equal(text, '{"id":"i2","exerciseId":"press","sets":2,"targets":["8","8"],"suggestedWeights":[40,40]}')
  })
})

// ---- AC3 Back guard ----------------------------------------------------------------------
const lastSet = new Date('2026-10-26T17:00:00.000Z') // Mon 18:00 Stockholm
const tue = (hh) => new Date(2026, 9, 27, hh) // Tue local
const leftOpenWorkout = () => {
  const active = { startedAt: new Date('2026-10-26T16:00:00.000Z').toISOString(), sets: [{ loggedAt: lastSet.toISOString(), setType: 'work', weight: 20, reps: '8' }] }
  const { finishedAt } = finishTimeFor(active, tue(6).getTime())
  return { id: 'wk-left', routineId: 'R', finishedAt, occurrenceId: 'adhoc-R@2026-10-26', sets: active.sets }
}
const adhocPlan = { routineId: 'R', date: '2026-10-27', occurrenceId: 'adhoc-R@2026-10-27', scheduleSlotId: null }

describe('req-262 AC3 — Back after a left-open Finish, finished in this tab', () => {
  it('finished here (saved Tue 06:00) → covers /workout/R at Tue 07:00', () => {
    const w = leftOpenWorkout()
    assert.equal(w.finishedAt, lastSet.toISOString())
    const done = finishedForPlan([w], adhocPlan, tue(7), { finishedHere: { id: 'wk-left', at: tue(6).getTime() } })
    console.log('AC3 finished here:', done?.id ?? null)
    assert.equal(done?.id, 'wk-left')
  })
  it('failure case: not finished in this tab → null, as main', () => {
    const w = leftOpenWorkout()
    const noOption = finishedForPlan([w], adhocPlan, tue(7))
    const other = finishedForPlan([w], adhocPlan, tue(7), { finishedHere: { id: 'someone-else', at: tue(6).getTime() } })
    console.log('AC3 not finished here:', noOption, other)
    assert.equal(noOption, null)
    assert.equal(other, null)
  })
  it('finished here more than 6 h ago → null', () => {
    const done = finishedForPlan([leftOpenWorkout()], adhocPlan, tue(13), { finishedHere: { id: 'wk-left', at: tue(6).getTime() } })
    assert.equal(done, null)
  })
  it('a scheduled plan is not affected by finishedHere', () => {
    const plan = { ...adhocPlan, scheduleSlotId: 's1', occurrenceId: 's1@2026-10-27' }
    assert.equal(finishedForPlan([leftOpenWorkout()], plan, tue(7), { finishedHere: { id: 'wk-left', at: tue(6).getTime() } }), null)
  })
})

describe('req-262 AC3 — the store keeps the finished-here id in memory only', () => {
  let view = null
  afterEach(async () => {
    if (view) await view.unmount()
    view = null
    mock.timers.reset()
  })
  it('finishWorkout → store.finishedHere = the saved workout; the persisted state has no new key', async () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 12, 15).getTime() })
    localStorage.clear()
    const fixture = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
    localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture, activeWorkout: null }))
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const captured = {}
    function Grab() {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return null
    }
    view = await render(h(StoreProvider, null, h(Grab)))
    assert.equal(captured.store.getFinishedHere(), null)
    await act(async () => captured.store.startWorkout('sess-lower'))
    const id = captured.store.activeWorkout.id
    const keysBefore = Object.keys(JSON.parse(localStorage.getItem('workout-mvp-v9'))).sort()
    await act(async () => captured.store.finishWorkout({}, ''))
    const stored = localStorage.getItem('workout-mvp-v9')
    const keysAfter = Object.keys(JSON.parse(stored)).sort()
    console.log('AC3 store.finishedHere:', JSON.stringify(captured.store.getFinishedHere()), 'id:', id)
    console.log('AC3 persisted keys unchanged:', JSON.stringify(keysAfter) === JSON.stringify(keysBefore), 'contains finishedHere:', stored.includes('finishedHere'))
    assert.equal(captured.store.getFinishedHere()?.id, id)
    assert.equal(captured.store.getFinishedHere()?.at, Date.now())
    assert.equal(JSON.parse(stored).workouts[0].id, id)
    assert.deepEqual(keysAfter, keysBefore)
    assert.equal(stored.includes('finishedHere'), false)
    assert.equal(JSON.stringify(JSON.parse(stored).workouts[0]).includes(String(Date.now())), false)
    // The export path (Settings → exportBackup(store) → buildBackup's dataOnly) drops it too.
    const { buildBackup } = await import('./exchange.js')
    const backupText = JSON.stringify(buildBackup(captured.store))
    console.log('AC3 backup contains finishedHere:', backupText.includes('finishedHere'))
    assert.equal(backupText.includes('finishedHere'), false)
  })
})

// ---- AC4 key-less items ------------------------------------------------------------------
const keylessState = () => ({
  exercises: [{ id: 'ex-x', name: 'X', type: 'machine' }, { id: 'ex-y', name: 'Y', type: 'machine' }],
  routines: [],
  workouts: [
    {
      id: 'wk',
      routineId: 'gone',
      finishedAt: '2026-10-26T17:00:00.000Z',
      snapshot: { routineName: 'Gone', items: [{ exerciseId: 'ex-x', sets: 3, targets: ['8', '8', '8'] }, { exerciseId: 'ex-y', sets: 2, targets: ['8', '8'] }] },
      sets: [],
    },
  ],
})

describe('req-262 AC4 — key-less items no longer share their skips', () => {
  it('repro 4 (through migrateState) → 5 skip records; setsForItem(Y) returns only Y\'s 2', () => {
    const migrated = migrateState(keylessState())
    const items = migrated.workouts[0].snapshot.items
    console.log('AC4 keys after migrateState:', JSON.stringify(items.map((i) => [i.routineItemId ?? null, i.id ?? null])))
    const finished = withSkippedUnloggedSets({ ...migrated.workouts[0], sets: [] })
    console.log('AC4 skip records written:', finished.sets.length)
    assert.equal(finished.sets.length, 5)
    const y = setsForItem(finished.sets, items[1])
    console.log('AC4 setsForItem(Y):', y.map((set) => set.exerciseId).join(','))
    assert.deepEqual(y.map((set) => set.exerciseId), ['ex-y', 'ex-y'])
    assert.deepEqual(setsForItem(finished.sets, items[0]).map((set) => set.exerciseId), ['ex-x', 'ex-x', 'ex-x'])
  })
  it('keyed items still match by key and by id', () => {
    const sets = [{ routineItemId: 'a', exerciseId: 'e' }, { routineItemId: 'b', exerciseId: 'e' }, { exerciseId: 'e' }]
    assert.equal(setsForItem(sets, { routineItemId: 'a', exerciseId: 'e' }).length, 2)
    assert.equal(setsForItem(sets, { id: 'b', exerciseId: 'e' }).length, 2)
  })
})
