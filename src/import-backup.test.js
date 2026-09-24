import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { importWithBackup } from './import-backup.js'
import { applyBackup as applyBackupFn } from './exchange.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'
import { applyScreen, emptyAnalytics } from './analytics.js'

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
  it('backs up the PRE-import state before applying, then replaces state', async () => {
    const store = makeStore(oldState())
    const captured = []
    const result = await importWithBackup({
      store,
      payload: validIncoming,
      ask: () => true,
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

  // req-24 — validate BEFORE asking (was: ask, back up, then throw). A wrong file (e.g.
  // the analytics export) surfaces its error and never shows the replace question, so
  // no safety backup is downloaded for it either.
  it('a malformed / non-backup payload is rejected before the question: nothing asked, downloaded or replaced', async () => {
    const store = makeStore(oldState())
    const before = store.exercises
    let downloads = 0
    let asked = 0

    await assert.rejects(
      importWithBackup({
        store,
        payload: { kind: 'nope' }, // rejected by applyBackup (exchange.test.js:86-88)
        ask: () => {
          asked += 1
          return true
        },
        download: () => {
          downloads += 1
        },
      }),
      /Not a workout database backup\./,
    )

    assert.equal(asked, 0)
    assert.equal(downloads, 0)
    assert.equal(store.exercises, before)
    assert.equal(store.exercises[0].id, 'ex-old')
  })

  it('cancelling the confirm applies nothing and downloads nothing', async () => {
    const store = makeStore(oldState())
    let downloads = 0
    const result = await importWithBackup({
      store,
      payload: validIncoming,
      ask: () => false,
      download: () => {
        downloads += 1
      },
    })
    assert.equal(result, null)
    assert.equal(downloads, 0)
    assert.equal(store.exercises[0].id, 'ex-old')
  })

  // req-24 — through the real in-app sheet (the default `ask`): a valid backup opens the
  // sheet with the same question; Cancel leaves data unchanged, Replace replaces.
  it('a valid backup opens the confirm sheet; Cancel keeps data', async () => {
    const store = makeStore(oldState())
    let downloads = 0
    const done = importWithBackup({ store, payload: validIncoming, download: () => (downloads += 1) })
    const pending = getPendingConfirm()
    assert.equal(pending.message, 'Replace all data on this device?')
    assert.equal(pending.confirmLabel, 'Replace')
    answerConfirm(false)
    assert.equal(await done, null)
    assert.equal(downloads, 0)
    assert.equal(store.exercises[0].id, 'ex-old')
  })

  it('a valid backup opens the confirm sheet; Replace replaces', async () => {
    const store = makeStore(oldState())
    let downloads = 0
    const done = importWithBackup({ store, payload: validIncoming, download: () => (downloads += 1) })
    answerConfirm(true)
    const result = await done
    assert.equal(downloads, 1)
    assert.equal(store.exercises[0].id, 'ex-new')
    assert.ok(result.summary)
  })

  it('a non-backup file (the analytics export) never opens the sheet', async () => {
    const store = makeStore(oldState())
    await assert.rejects(importWithBackup({ store, payload: applyScreen(emptyAnalytics(), 'today') }))
    assert.equal(getPendingConfirm(), null)
  })
})
