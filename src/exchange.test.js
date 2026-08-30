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
    assert.throws(() => applyBackup({ kind: 'nope' }), /not a workout database backup/)
  })
})
