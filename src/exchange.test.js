import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKUP_KIND,
  applyBackup,
  buildBackup,
  unwrapBackup,
} from './exchange.js'

const base = {
  exercises: [
    { id: 'ex-row', name: 'Row', equipment: 'Rower', type: 'cardio', weightStep: 'n/a', muscles: '', cues: '' },
    { id: 'ex-press', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5', muscles: 'Chest', cues: '' },
  ],
  programs: [
    {
      id: 'prog-1',
      name: 'Gym',
      sessions: [
        {
          id: 'sess-1',
          name: 'Upper',
          focus: 'Machines',
          exercises: [
            { id: 'si-1', exerciseId: 'ex-row', role: 'warmup', restSec: 0, notes: '', warmup: null },
            { id: 'si-2', exerciseId: 'ex-press', role: 'main', restSec: 90, notes: '', warmup: { reps: 12 } },
          ],
        },
      ],
    },
  ],
  schedule: {
    loopWeeks: 1,
    slots: [{ id: 'slot-1', week: 0, weekday: 1, sessionId: 'sess-1' }],
  },
  workouts: [],
  plannedWorkouts: [],
}

describe('database backup', () => {
  it('roundtrips the full state including history', () => {
    const source = {
      ...base,
      workouts: [
        {
          id: 'wo-1',
          sessionId: 'sess-1',
          finishedAt: '2026-08-25T18:00:00.000Z',
          performedOn: '2026-08-25',
          sets: [{ exerciseId: 'ex-press', setType: 'work', weight: 30, reps: '10' }],
        },
      ],
    }
    const pack = buildBackup({ ...source, applyBackup() {} })
    assert.equal(pack.kind, BACKUP_KIND)
    assert.equal(pack.assistant, undefined)
    assert.equal(pack.state.applyBackup, undefined)
    assert.equal(pack.state.workouts[0].id, 'wo-1')
    const { state, summary } = applyBackup(pack)
    assert.equal(summary.workouts, 1)
    assert.equal(state.workouts[0].id, 'wo-1')
    assert.equal(state.routines[0].id, 'sess-1')
  })

  it('adds an assistant prompt when asked, without changing the database', () => {
    const pack = buildBackup(base, { includeAssistant: true })
    assert.equal(pack.kind, BACKUP_KIND)
    assert.match(pack.assistant.prompt, /Talk to the user first/)
    assert.match(pack.assistant.prompt, /reusable routines/)
    assert.match(pack.assistant.howTheAppWorks.routines, /state\.routines/)
    assert.match(pack.assistant.import.instructions, /workout-mvp-backup/)
    assert.equal(pack.state.programs[0].sessions[0].id, 'sess-1')
    const { state, summary } = applyBackup(pack)
    assert.equal(summary.routines, 1)
    assert.equal(state.routines[0].name, 'Upper')
    assert.equal(state.assistant, undefined)
  })

  it('accepts a raw database document like db.json', () => {
    const { state, summary } = applyBackup(base)
    assert.equal(summary.routines, 1)
    assert.equal(summary.exercises, 2)
    assert.equal(state.routines[0].name, 'Upper')
  })

  it('rejects files that are not backups', () => {
    assert.equal(unwrapBackup({ kind: 'workout-mvp-export' }), null)
    assert.throws(() => applyBackup({ kind: 'nope' }), /not a workout database backup/i)
  })
})

// req-39 (F-RISK-4) — a malformed backup whose collection fields aren't arrays used
// to reach migrateState and throw a raw "map is not a function" TypeError. unwrapBackup
// now rejects a present-but-non-array collection at the import boundary, so the user
// gets the friendly "Not a workout database backup." — without guarding migrateState
// (which must keep throwing on the load path so req-36's corrupt-v8 guard fires).
describe('req-39 malformed-backup validation', () => {
  it('the two measured repros throw the friendly message, not a TypeError', () => {
    // Before the fix these hit `(source.workouts || []).map` / `slots.map` and threw
    // a TypeError; now they reject cleanly with the intended message.
    assert.throws(
      () => applyBackup({ kind: BACKUP_KIND, version: 1, state: { workouts: 'oops' } }),
      (err) => err instanceof Error && err.message === 'Not a workout database backup.',
    )
    assert.throws(
      () => applyBackup({ kind: BACKUP_KIND, version: 1, state: { schedule: { slots: 'x' } } }),
      (err) => err instanceof Error && err.message === 'Not a workout database backup.',
    )
  })

  it('rejects every present-but-non-array collection field', () => {
    for (const field of ['exercises', 'routines', 'sessions', 'programs', 'plannedWorkouts', 'draftWorkouts']) {
      assert.equal(
        unwrapBackup({ kind: BACKUP_KIND, version: 1, state: { [field]: 'nope' } }),
        null,
        `present non-array ${field} should reject`,
      )
    }
  })

  it('rejects a non-array collection on a bare (unwrapped) document too', () => {
    // Bare path: exercises + one routine-family array are required, but workouts was
    // never checked before — a non-array workouts sailed through to the TypeError.
    assert.throws(
      () => applyBackup({ ...base, workouts: 'oops' }),
      (err) => err instanceof Error && err.message === 'Not a workout database backup.',
    )
  })

  it('a real buildBackup output still round-trips (no false-reject)', () => {
    const pack = buildBackup(base)
    const doc = unwrapBackup(pack)
    assert.notEqual(doc, null) // not falsely rejected
    const { state, summary } = applyBackup(pack)
    assert.equal(summary.routines, 1)
    assert.equal(state.routines[0].name, 'Upper')
  })

  it('a backup that omits collection fields still imports (absent is fine)', () => {
    // Only exercises + routines present; no workouts/plannedWorkouts/draftWorkouts/slots.
    const minimal = {
      kind: BACKUP_KIND,
      version: 1,
      state: {
        exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
        routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
        schedule: { loopWeeks: 1 }, // schedule present but no slots
      },
    }
    const { state, summary } = applyBackup(minimal)
    assert.equal(summary.routines, 1)
    assert.equal(summary.workouts, 0)
    assert.equal(state.workouts.length, 0)
    assert.equal(state.schedule.slots.length, 0)
  })
})
