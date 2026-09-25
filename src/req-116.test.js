// req-116 (audit E, DEC-058 §4) — Finish navigation: the persisted auto-finish dismissed
// flag (stripped at finish), the summary gate, the empty-workout guard, set counts, and
// the preview guard. Exercised through the REAL reducers/helpers (finishedState,
// skipItemPatch, migrateState, workoutSummaryStats, finishedForPlan).
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { buildPlannedWorkout, migrateState, planSnapshot } from './model.js'
import { finishedForPlan } from './current-workout.js'
import { emptyState, workoutSummaryStats } from './storage.js'
import {
  anythingLogged,
  autoCompleteArmed,
  finishedState,
  itemKey,
  loggedSetCount,
  skipItemPatch,
} from './workout-log.js'
import { autoFinishArgs } from './workout-note.js'

const EXERCISES = [{ id: 'ex-p', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '2.5' }]

function baseState() {
  const state = migrateState({
    ...emptyState(),
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        focus: '',
        exercises: [
          {
            id: 'ri-p',
            exerciseId: 'ex-p',
            role: 'main',
            restSec: 90,
            sets: 2,
            targets: ['10', '8'],
            suggestedWeights: [30, 35],
            warmup: { reps: 10 },
          },
        ],
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

const itemOf = (s) => s.activeWorkout.snapshot.items[0]
const set = (it, setType, weight, reps) => ({ routineItemId: itemKey(it), exerciseId: it.exerciseId, setType, weight, reps: String(reps) })
const skipped = (it) => ({ ...set(it, 'work', 0, 'skipped'), reps: 'skipped', note: 'skipped' })
const withActive = (s, patch) => ({ ...s, activeWorkout: { ...s.activeWorkout, ...patch } })
// 1 logged WU + 2 logged work sets → every exercise done.
const allLogged = (s) => {
  const it = itemOf(s)
  return withActive(s, { sets: [set(it, 'wu', 20, 10), set(it, 'work', 30, 10), set(it, 'work', 35, 8)] })
}

describe('req-116 dismissed flag is stripped at finish', () => {
  it('finishedState output has no autoFinishDismissed and no seedOverrides', () => {
    const s = withActive(allLogged(baseState()), { autoFinishDismissed: true, seedOverrides: { 'ex-p::work': { weight: 35 } } })
    const next = finishedState(s, { overallFeel: 'Hard', progression: [] }, '2026-09-23T11:00:00.000Z')
    const finished = next.workouts[0]
    assert.equal('autoFinishDismissed' in finished, false)
    assert.equal('seedOverrides' in finished, false)
    assert.equal(finished.overallFeel, 'Hard')
    assert.equal(next.activeWorkout, null)
  })

  it('the flag survives a reload (migrateState keeps it on the active workout)', () => {
    const s = withActive(allLogged(baseState()), { autoFinishDismissed: true })
    const reloaded = migrateState(JSON.parse(JSON.stringify(s)))
    assert.equal(reloaded.activeWorkout.autoFinishDismissed, true)
    assert.equal(autoCompleteArmed(reloaded.activeWorkout), false)
  })

  it('an older active workout WITHOUT the flag loads and reads as not dismissed', () => {
    const legacy = allLogged(baseState())
    assert.equal('autoFinishDismissed' in legacy.activeWorkout, false)
    const reloaded = migrateState(JSON.parse(JSON.stringify(legacy)))
    assert.ok(reloaded.activeWorkout)
    assert.equal(autoCompleteArmed(reloaded.activeWorkout), true)
  })
})

describe('req-116 summary gate (autoCompleteArmed)', () => {
  it('true only for all-done + something logged + not dismissed', () => {
    assert.equal(autoCompleteArmed(allLogged(baseState()).activeWorkout), true)
  })
  it('false when dismissed', () => {
    assert.equal(autoCompleteArmed({ ...allLogged(baseState()).activeWorkout, autoFinishDismissed: true }), false)
  })
  it('false while work is left', () => {
    const s = baseState()
    const it = itemOf(s)
    assert.equal(autoCompleteArmed(withActive(s, { sets: [set(it, 'wu', 20, 10), set(it, 'work', 30, 10)] }).activeWorkout), false)
  })
  it('false for an empty workout: Skip exercise on every item → no auto-finish', () => {
    const s = baseState()
    const patched = withActive(s, skipItemPatch(s.activeWorkout, itemKey(itemOf(s))))
    const active = patched.activeWorkout
    assert.equal(active.sets.length, 3, 'WU + 2 work recorded as skipped')
    assert.equal(anythingLogged(active), false)
    assert.equal(autoCompleteArmed(active), false)
  })
  it('a logged warm-up alone counts as logged (unconfirmed call)', () => {
    const s = baseState()
    const it = itemOf(s)
    const active = withActive(s, { sets: [set(it, 'wu', 20, 10), skipped(it), skipped(it)] }).activeWorkout
    assert.equal(anythingLogged(active), true)
    assert.equal(autoCompleteArmed(active), true)
  })
  it('null/undefined workout → false', () => {
    assert.equal(autoCompleteArmed(null), false)
    assert.equal(anythingLogged(undefined), false)
  })
})

describe('req-116 set counts ignore skipped sets', () => {
  it('1 logged WU + 2 logged work + 1 skipped → 3 on Finish and on the summary', () => {
    const s = baseState()
    const it = itemOf(s)
    const active = withActive(s, {
      sets: [set(it, 'wu', 20, 10), set(it, 'work', 30, 10), set(it, 'work', 35, 8), skipped(it)],
    }).activeWorkout
    assert.equal(active.sets.length, 4)
    assert.equal(loggedSetCount(active), 3) // finish.jsx setCount
    const stats = workoutSummaryStats(active, null, Date.parse('2026-09-23T10:30:00.000Z'))
    assert.equal(stats.sets, 3)
  })
  it('the summary delta compares logged sets on both sides', () => {
    const s = baseState()
    const it = itemOf(s)
    const active = withActive(s, { sets: [set(it, 'work', 30, 10), set(it, 'work', 35, 8)] }).activeWorkout
    const prior = {
      startedAt: '2026-09-20T10:00:00.000Z',
      finishedAt: '2026-09-20T10:30:00.000Z',
      sets: [set(it, 'work', 30, 10), skipped(it)],
    }
    assert.equal(workoutSummaryStats(active, prior, Date.parse('2026-09-23T10:30:00.000Z')).deltas.sets, 1)
  })
})

describe('req-116 Feel on the active workout reaches the saved record via auto-finish', () => {
  it('overallFeel set on the active workout → auto-finish record has it', () => {
    const s = withActive(allLogged(baseState()), { overallFeel: 'Hard' })
    const next = finishedState(s, autoFinishArgs(s.activeWorkout, []))
    assert.equal(next.workouts[0].overallFeel, 'Hard')
  })
})

describe('req-116 preview guard (finishedForPlan)', () => {
  const planSlot = { routineId: 'r1', date: '2026-09-23', scheduleSlotId: 'slot-a', occurrenceId: 'slot-a@2026-09-23' }
  const planAdhoc = { routineId: 'r1', date: '2026-09-23', scheduleSlotId: null, occurrenceId: 'adhoc-r1@2026-09-23' }
  const finishedSlot = {
    id: 'wo-1',
    routineId: 'r1',
    scheduleSlotId: 'slot-a',
    scheduledFor: '2026-09-23',
    occurrenceId: 'slot-a@2026-09-23',
    finishedAt: '2026-09-23T11:00:00.000Z',
  }

  it('the slot occurrence just finished → Done (that workout)', () => {
    assert.equal(finishedForPlan([finishedSlot], planSlot), finishedSlot)
  })
  it('the ad hoc preview Back lands on (/workout/R) after finishing today\'s slot → Done', () => {
    assert.equal(finishedForPlan([finishedSlot], planAdhoc), finishedSlot)
  })
  it('an ad hoc workout finished today covers the ad hoc preview', () => {
    const adhoc = { id: 'wo-2', routineId: 'r1', scheduleSlotId: null, scheduledFor: null, occurrenceId: 'adhoc-r1@2026-09-23', finishedAt: '2026-09-23T09:00:00.000Z' }
    assert.equal(finishedForPlan([adhoc], planAdhoc), adhoc)
  })
  it('nothing finished, another day, another routine, or unfinished → Start (null)', () => {
    assert.equal(finishedForPlan([], planSlot), null)
    assert.equal(finishedForPlan([{ ...finishedSlot, scheduledFor: '2026-09-16', occurrenceId: 'slot-a@2026-09-16', finishedAt: '2026-09-16T11:00:00.000Z' }], planSlot), null)
    assert.equal(finishedForPlan([{ ...finishedSlot, routineId: 'r2' }], planSlot), null)
    assert.equal(finishedForPlan([{ ...finishedSlot, finishedAt: null }], planSlot), null)
    assert.equal(finishedForPlan([finishedSlot], null), null)
  })
})

describe('req-116 review — cross-midnight finish covers the ad hoc preview (6 h window)', () => {
  // Slot S started Tue 23:50, finished Wed 00:10 (local, Europe/Stockholm = UTC+2).
  const crossMidnight = {
    id: 'wo-x',
    routineId: 'r1',
    scheduleSlotId: 'S',
    scheduledFor: '2026-09-23',
    occurrenceId: 'S@2026-09-23',
    startedAt: '2026-09-23T21:50:00.000Z',
    finishedAt: '2026-09-23T22:10:00.000Z',
  }
  const adhocWed = { routineId: 'r1', date: '2026-09-24', scheduleSlotId: null, occurrenceId: 'adhoc-r1@2026-09-24' }

  it('Back to the ad hoc preview dated Wed, 5 min after finishing → Done (that workout)', () => {
    assert.equal(finishedForPlan([crossMidnight], adhocWed, new Date('2026-09-23T22:15:00.000Z')), crossMidnight)
  })
  it('exactly 6 h after finishing still covers; after 6 h it does not (Start again)', () => {
    assert.equal(finishedForPlan([crossMidnight], adhocWed, new Date('2026-09-24T04:10:00.000Z')), crossMidnight)
    assert.equal(finishedForPlan([crossMidnight], adhocWed, new Date('2026-09-24T04:11:00.000Z')), null)
  })
  it('another routine finished recently does not cover it', () => {
    assert.equal(finishedForPlan([{ ...crossMidnight, routineId: 'r2' }], adhocWed, new Date('2026-09-23T22:15:00.000Z')), null)
  })
  it('a SLOT preview never uses the 6 h window (its own date test only)', () => {
    const slotWed = { routineId: 'r1', date: '2026-09-24', scheduleSlotId: 'S', occurrenceId: 'S@2026-09-24' }
    assert.equal(finishedForPlan([crossMidnight], slotWed, new Date('2026-09-23T22:15:00.000Z')), null)
  })
})

describe('req-116 review — History detail counts sets like Finish and the summary', () => {
  it('detail.jsx uses loggedSetCount, not sets.length', () => {
    const src = readFileSync(new URL('./views/history/detail.jsx', import.meta.url), 'utf8')
    assert.match(src, /`\$\{loggedSetCount\(workout\)\} \$\{loggedSetCount\(workout\) === 1 \? .set. : .sets.\}`/) // req-177: "1 set" / "N sets"
    assert.doesNotMatch(src, /`\$\{sets\.length\} sets`/)
  })
  it('the finished record of 1 WU + 2 work + 1 skipped counts 3', () => {
    const s = baseState()
    const it = itemOf(s)
    const withSets = withActive(s, { sets: [set(it, 'wu', 20, 10), set(it, 'work', 30, 10), set(it, 'work', 35, 8), skipped(it)] })
    const finished = finishedState(withSets, { progression: [] }, '2026-09-23T11:00:00.000Z').workouts[0]
    assert.equal(loggedSetCount(finished), 3)
  })
})
