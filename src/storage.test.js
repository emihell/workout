import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyState, historyPrescription, historySetPrefill, loadState, saveState } from './storage.js'

describe('blank device storage', () => {
  it('starts with no routines, exercises, or history', () => {
    const state = emptyState()
    assert.equal(state.routines.length, 0)
    assert.equal(state.exercises.length, 0)
    assert.equal(state.workouts.length, 0)
    assert.equal(state.schedule.slots.length, 0)
  })

  it('loadState is empty when this browser has no saved data', () => {
    const previous = globalThis.localStorage
    const map = new Map()
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value))
      },
    }
    try {
      const state = loadState()
      assert.equal(state.routines.length, 0)
      assert.equal(state.exercises.length, 0)
    } finally {
      globalThis.localStorage = previous
    }
  })

  it('keeps a saved database on this browser', () => {
    const previous = globalThis.localStorage
    const map = new Map()
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value))
      },
    }
    try {
      saveState({
        ...emptyState(),
        routines: [{ id: 'sess-1', name: 'Upper', focus: 'Machines', exercises: [] }],
      })
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
    } finally {
      globalThis.localStorage = previous
    }
  })

  it('flattens a v6 program backup onto routines and stores v8', () => {
    const previous = globalThis.localStorage
    const map = new Map()
    globalThis.localStorage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value))
      },
    }
    try {
      map.set(
        'workout-mvp-v6',
        JSON.stringify({
          schemaVersion: 6,
          exercises: [{ id: 'ex-1', name: 'Press', equipment: 'Machine', type: 'machine', weightStep: '5' }],
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
                    {
                      exerciseId: 'ex-1',
                      sets: 1,
                      targets: ['5-8 min'],
                      suggestedWeights: [],
                    },
                  ],
                },
              ],
            },
          ],
          schedule: { loopWeeks: 1, slots: [{ week: 0, weekday: 1, programId: 'prog-1', sessionId: 'sess-1' }] },
          workouts: [],
        }),
      )
      const state = loadState()
      assert.equal(state.routines[0].name, 'Upper')
      assert.equal(state.routines[0].exercises[0].sets, 1)
      assert.equal(state.programs, undefined)
      assert.equal(state.sessions, undefined)
      const stored = JSON.parse(map.get('workout-mvp-v8'))
      assert.equal(stored.routines[0].id, 'sess-1')
      assert.equal(stored.programs, undefined)
    } finally {
      globalThis.localStorage = previous
    }
  })
})

describe('historyPrescription', () => {
  it('is empty when this exercise has never been logged', () => {
    assert.equal(historyPrescription([], 'ex-press'), null)
  })

  it('uses the last completed working sets', () => {
    const next = historyPrescription(
      [
        {
          finishedAt: '2026-08-20T10:00:00.000Z',
          sets: [
            { exerciseId: 'ex-press', setType: 'work', weight: 20, reps: '12' },
          ],
        },
        {
          finishedAt: '2026-08-27T10:00:00.000Z',
          sets: [
            { exerciseId: 'ex-press', setType: 'wu', weight: 15, reps: '12' },
            { exerciseId: 'ex-press', setType: 'work', weight: 30, reps: '12' },
            { exerciseId: 'ex-press', setType: 'work', weight: 35, reps: '10' },
            { exerciseId: 'ex-press', setType: 'work', weight: 35, reps: '8' },
          ],
        },
      ],
      'ex-press',
    )
    assert.deepEqual(next, {
      sets: 3,
      targets: ['12', '10', '8'],
      suggestedWeights: [30, 35, 35],
      restSec: undefined,
      notes: '',
      warmup: { reps: '12' },
    })
  })

  it('prefills a logged set from history and leaves missing sets blank', () => {
    const last = {
      sets: [
        { setType: 'wu', weight: 15, reps: '12' },
        { setType: 'work', weight: 30, reps: '12' },
        { setType: 'work', weight: 35, reps: '10' },
      ],
    }
    assert.deepEqual(historySetPrefill(last, { setType: 'wu' }), { weight: '15', reps: '12' })
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 1 }), { weight: '35', reps: '10' })
    assert.deepEqual(historySetPrefill(last, { setType: 'work', workIndex: 2 }), { weight: '', reps: '' })
    assert.deepEqual(historySetPrefill(null, { setType: 'work', workIndex: 0 }), { weight: '', reps: '' })
  })
})
