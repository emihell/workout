import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { importWithBackup } from './import-backup.js'
import { applyBackup as applyBackupFn } from './exchange.js'

// A stand-in for the real store: its applyBackup mirrors store.jsx — it runs the
// exchange applyBackup (which throws on a malformed payload) and only then
// replaces its own data fields, so we can assert "current state unchanged" after a
// throw. buildBackup(store) filters out this function via dataOnly().
function makeStore(initial) {
  const store = { ...initial }
  store.applyBackup = (payload) => {
    const result = applyBackupFn(payload) // throws before any replace on bad input
    Object.assign(store, result.state)
    return result
  }
  return store
}

const oldState = () => ({
  exercises: [{ id: 'ex-old', name: 'Old', equipment: 'Machine', type: 'machine', weightStep: '5' }],
  routines: [{ id: 'rtn-old', name: 'Old routine', focus: 'Machines', exercises: [] }],
  workouts: [],
})

const validIncoming = {
  exercises: [{ id: 'ex-new', name: 'New', equipment: 'Barbell', type: 'free', weightStep: '2.5' }],
  routines: [],
}

describe('importWithBackup (req-07 / DEC-004)', () => {
  it('backs up the PRE-import state before applying, then replaces state', () => {
    const store = makeStore(oldState())
    const captured = []
    const result = importWithBackup({
      store,
      payload: validIncoming,
      confirm: () => true,
      download: (filename, data) => captured.push({ filename, data }),
    })

    // Exactly one backup, and it captured the OLD data (not the imported data).
    assert.equal(captured.length, 1)
    assert.match(captured[0].filename, /^workout-database-.*\.json$/)
    assert.equal(captured[0].data.state.exercises[0].id, 'ex-old')
    assert.equal(captured[0].data.state.routines[0].id, 'rtn-old')

    // The store then holds the imported data.
    assert.equal(store.exercises[0].id, 'ex-new')
    assert.ok(result && result.summary)
  })

  it('a malformed / non-backup payload does not replace state and surfaces the same error', () => {
    const store = makeStore(oldState())
    const before = store.exercises
    let downloads = 0

    assert.throws(
      () =>
        importWithBackup({
          store,
          payload: { kind: 'nope' }, // rejected by applyBackup (exchange.test.js:86-88)
          confirm: () => true,
          download: () => {
            downloads += 1
          },
        }),
      /Not a workout database backup\./,
    )

    // Current state is untouched by the failed import…
    assert.equal(store.exercises, before)
    assert.equal(store.exercises[0].id, 'ex-old')
    // …and the safety backup that was made is of that untouched pre-import state.
    assert.equal(downloads, 1)
  })

  it('cancelling the confirm applies nothing and downloads nothing', () => {
    const store = makeStore(oldState())
    let downloads = 0
    const result = importWithBackup({
      store,
      payload: validIncoming,
      confirm: () => false,
      download: () => {
        downloads += 1
      },
    })
    assert.equal(result, null)
    assert.equal(downloads, 0)
    assert.equal(store.exercises[0].id, 'ex-old')
  })
})
