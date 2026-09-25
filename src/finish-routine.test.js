// req-112 / DEC-056 — Finish never rewrites the routine; the recommendation maths is
// per set. Exercised through the REAL reducers store.jsx delegates to
// (workout-log.finishedState for finishWorkout, model.recalculatedState for
// recalculateFuturePlans) — store.jsx itself can't be imported under `node --test`.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFinishProgression,
  buildPlannedWorkout,
  migrateState,
  planSnapshot,
  progressionForItem,
  recalculatedState,
} from './model.js'
import { recommendNextPrescription } from './progress.js'
import { finishedState, itemKey } from './workout-log.js'
import { autoFinishArgs } from './workout-note.js'

const EXERCISES = [
  { id: 'ex-p', name: 'Chest Press', equipment: 'Machine', type: 'machine', weightStep: '2.5' },
  { id: 'ex-b', name: 'Push-up', equipment: 'Bodyweight', type: 'bodyweight', weightStep: 'n/a' },
]

// The spec's routine: press 2 sets, targets 10/8, weights 30/35; push-ups 15/10.
function baseState() {
  const state = migrateState({
    schemaVersion: 9,
    exercises: EXERCISES,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        focus: '',
        exercises: [
          { id: 'ri-p', exerciseId: 'ex-p', role: 'main', restSec: 90, sets: 2, targets: ['10', '8'], suggestedWeights: [30, 35] },
          { id: 'ri-b', exerciseId: 'ex-b', role: 'main', restSec: 60, sets: 2, targets: ['15', '10'], suggestedWeights: [] },
        ],
      },
    ],
    schedule: { loopWeeks: 1, slots: [] },
    workouts: [],
    activeWorkout: null,
  })
  const plan = buildPlannedWorkout(state, { routineId: 'r1', date: '2026-09-23' })
  state.plannedWorkouts = [{ ...plan }]
  state.activeWorkout = {
    id: 'wo-live',
    routineId: 'r1',
    performedOn: '2026-09-23',
    occurrenceId: plan.occurrenceId,
    snapshot: planSnapshot(plan),
    startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: null,
    overallNote: 'felt strong',
    overallFeel: '',
    completedItemIds: [],
    restEndsAt: null,
    restPausedRemaining: null,
    sets: [],
    progression: null,
    seedOverrides: { 'ex-p:work': { weight: 35 } },
  }
  return state
}

const item = (state, i) => state.activeWorkout.snapshot.items[i]
const work = (it, weight, reps, rpe = 3) => ({
  routineItemId: itemKey(it),
  exerciseId: it.exerciseId,
  setType: 'work',
  weight,
  reps: String(reps),
  rpe,
  note: '',
})
const skipped = (it) => ({ routineItemId: itemKey(it), exerciseId: it.exerciseId, setType: 'work', weight: 0, reps: 'skipped', rpe: null })
const withSets = (state, sets) => ({ ...state, activeWorkout: { ...state.activeWorkout, sets } })
const pressOf = (routines) => routines[0].exercises[0]
const bwOf = (routines) => routines[0].exercises[1]

describe('req-112 Finish leaves the routine alone (DEC-056)', () => {
  // Easy press sets → the recommendation differs from the routine, so the test has teeth.
  const logged = (s) => withSets(s, [work(item(s, 0), 30, 10, 1), work(item(s, 0), 35, 8, 1), work(item(s, 1), 0, 12, 3)])

  it('manual Finish: routines deep-equal to before; no progression recorded (req-158)', () => {
    const s = logged(baseState())
    const before = structuredClone(s.routines)
    const progression = buildFinishProgression(s.exercises, s.activeWorkout)
    assert.notDeepEqual(progression[0].to, pressOf(before).suggestedWeights, 'the recommendation does differ')
    const next = finishedState(s, { overallNote: 'n', overallFeel: 'Good', progression }, '2026-09-23T11:00:00.000Z')
    assert.deepEqual(next.routines, before)
    assert.equal(next.routines, s.routines, 'same reference: Finish does not touch routines at all')
    // req-158 (DEC-085 §3) — was: history carries the progression record. Nothing read it;
    // the finished record no longer has the field at all (not even the start-time null).
    assert.equal(next.workouts.length, 1)
    assert.equal('progression' in next.workouts[0], false)
  })

  it('auto-complete Finish (autoFinishArgs): routines deep-equal to before', () => {
    const s = logged(baseState())
    const before = structuredClone(s.routines)
    const progression = buildFinishProgression(s.exercises, s.activeWorkout)
    const next = finishedState(s, autoFinishArgs(s.activeWorkout, progression))
    assert.deepEqual(next.routines, before)
    assert.equal('progression' in next.workouts[0], false, 'req-158 — was: deepEqual(progression)')
    assert.equal(next.workouts[0].overallNote, 'felt strong')
  })

  it('everything else Finish did is unchanged: plan removed, active cleared, seedOverrides dropped, unlogged → skipped', () => {
    const s = withSets(baseState(), [work(item(baseState(), 0), 30, 10)])
    const next = finishedState(s, { progression: [] }, '2026-09-23T11:00:00.000Z')
    assert.equal(next.activeWorkout, null)
    assert.deepEqual(next.plannedWorkouts, [])
    const finished = next.workouts[0]
    assert.equal(finished.finishedAt, '2026-09-23T11:00:00.000Z')
    assert.equal('seedOverrides' in finished, false)
    assert.equal(finished.sets.filter((set) => set.reps === 'skipped').length, 3)
  })

  it('no active workout → same state', () => {
    const s = { ...baseState(), activeWorkout: null }
    assert.equal(finishedState(s, { progression: [] }), s)
  })
})

describe('req-112 per-set recommendation (the spec table)', () => {
  it('(a) set 1 skipped, set 2 35×8 → [30, 35]: set 2 judged against ITS target 8 (held)', () => {
    const s = baseState()
    const p = item(s, 0)
    const core = progressionForItem(s.exercises, { sets: [skipped(p), work(p, 35, 8)] }, p)
    assert.deepEqual(core.to, [30, 35]) // was [32.5]
    assert.deepEqual(core.targetsTo, ['10', '8'])
    assert.equal(core.recommendation.action, 'keep')
  })

  it('(b) set 1 30×10, set 2 skipped → [30, 35]: the skipped set keeps its routine weight', () => {
    const s = baseState()
    const p = item(s, 0)
    const core = progressionForItem(s.exercises, { sets: [work(p, 30, 10), skipped(p)] }, p)
    assert.deepEqual(core.to, [30, 35]) // was [30]
  })

  it('(c) bodyweight, set 1 skipped, set 2 8 (target 10) → targets [15, 9]: set 2 steps down, set 1 untouched', () => {
    const s = baseState()
    const b = item(s, 1)
    const core = progressionForItem(s.exercises, { sets: [skipped(b), work(b, 0, 8)] }, b)
    assert.deepEqual(core.targetsTo, ['15', '9']) // was ['14', '10']
    assert.equal(core.recommendation.action, 'down')
  })

  it('a set that moves is judged per index: set 2 missing ITS target moves only set 2', () => {
    const r = recommendNextPrescription({
      targets: ['10', '8'],
      weights: [30, 35],
      sets: [{ weight: 30, reps: '10', rpe: 3 }, { weight: 35, reps: '6', rpe: 3 }],
      exercise: EXERCISES[0],
    })
    assert.deepEqual(r.weights, [30, 32.5])
    assert.equal(r.action, 'down')
  })

  it('never shrinks: an unlogged trailing set keeps the routine weight', () => {
    const r = recommendNextPrescription({
      targets: ['10', '8', '6'],
      weights: [30, 35, 40],
      sets: [{ weight: 30, reps: '10', rpe: 1 }],
      exercise: EXERCISES[0],
    })
    assert.deepEqual(r.weights, [32.5, 35, 40])
    assert.deepEqual(r.targets, ['10', '8', '6'])
  })

  it('no routine weight at a skipped hole reads 0 (no weight), and a trailing skip adds nothing', () => {
    const r = recommendNextPrescription({
      targets: ['10', '10', '10'],
      weights: [],
      sets: [{ reps: 'skipped' }, { weight: 40, reps: '10', rpe: 3 }, { reps: 'skipped' }],
      exercise: EXERCISES[0],
    })
    assert.deepEqual(r.weights, [0, 40])
  })
})

describe('req-112 recalc stays, and is the only path that writes the routine', () => {
  function finishWith(sets) {
    const s = withSets(baseState(), sets(baseState()))
    return finishedState(s, { progression: buildFinishProgression(s.exercises, s.activeWorkout) }, '2026-09-23T11:00:00.000Z')
  }

  it('failure case — all skipped: recalc leaves weights and targets unchanged', () => {
    const s = finishWith(() => [])
    assert.ok(s.workouts[0].sets.every((set) => set.reps === 'skipped'))
    const before = structuredClone(s.routines)
    assert.deepEqual(recalculatedState(s, 'wo-live').routines, before)
  })

  it('correct a workout, then recalc → the routine gets the per-set result', () => {
    let s = finishWith((b) => [work(item(b, 0), 30, 10), work(item(b, 0), 35, 8), work(item(b, 1), 0, 15), work(item(b, 1), 0, 10)])
    const before = structuredClone(s.routines)
    // the History correction (store.updateWorkout): set 1 was actually easy, set 2 of
    // push-ups was skipped
    const sets = s.workouts[0].sets.map((set, i) => {
      if (i === 0) return { ...set, rpe: 1 }
      if (i === 3) return { ...set, reps: 'skipped', weight: 0, rpe: null }
      return set
    })
    s = { ...s, workouts: s.workouts.map((w) => (w.id === 'wo-live' ? { ...w, sets } : w)) }
    assert.deepEqual(s.routines, before, 'Finish + correction alone change nothing')
    const next = recalculatedState(s, 'wo-live')
    assert.deepEqual(pressOf(next.routines).suggestedWeights, [32.5, 35])
    assert.deepEqual(pressOf(next.routines).targets, ['10', '8'])
    assert.deepEqual(bwOf(next.routines).targets, ['15', '10'])
    assert.equal(pressOf(next.routines).sets, 2)
  })

  it('unknown workout → same state', () => {
    const s = baseState()
    assert.equal(recalculatedState(s, 'nope'), s)
  })
})
