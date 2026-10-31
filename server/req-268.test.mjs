// req-268 — a workout finished on one device can't come back as in progress after a three-way merge
// (audit 2026-10-30 F-SYNC-1). Real reducers, real merge, the server's own validator.
import { tempDir } from './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapUser, findUser } from './auth.mjs'
import { DB_FILE } from './config.mjs'
import { openDataDir } from './db.mjs'
import { mergeStates } from './merge.mjs'
import { duplicateWorkoutIds, readOnlyDb } from './ops.mjs'
import { putState, validState } from './store.mjs'
import { fullState } from '../src/test-support/full-state.js'
import { setLoggedState } from '../src/state-reducers.js'
import { finishedState } from '../src/workout-log.js'

let n = 0
const withSet = (s) =>
  setLoggedState(s, {
    routineItemId: 'si-press',
    exerciseId: 'ex-press',
    setType: 'work',
    weight: 25,
    reps: '8',
    rpe: null,
    note: `set-268-${++n}`,
    targetReps: '10',
    targetWeight: 25,
    loggedAt: `2026-10-09T17:${String(20 + n).padStart(2, '0')}:00.000Z`,
  })

// base: wo-2 in progress with sets logged (fullState). A finishes it; B (same base, not pulled) logs one more set.
function threeStates() {
  const base = withSet(fullState())
  const id = base.activeWorkout.id
  const A = finishedState(base, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z')
  const B = withSet(base)
  return { base, A, B, id }
}

test('criterion 1+4: finished on A, a set logged on B → merged activeWorkout null, one A record, B’s workout lost verbatim', () => {
  const { base, A, B, id } = threeStates()
  assert.equal(A.activeWorkout, null)
  assert.ok(A.workouts.some((w) => w.id === id), 'A has it in history')
  // putState: mergeStates(base, incoming = B, current = A) (server/store.mjs)
  const { state, conflicts } = mergeStates(base, B, A)
  assert.equal(state.activeWorkout, null, 'not in progress')
  const copies = state.workouts.filter((w) => w.id === id)
  assert.equal(copies.length, 1, 'one history entry')
  assert.equal(copies[0], A.workouts.find((w) => w.id === id), 'A’s finished record, verbatim (same object)')
  const dropped = conflicts.filter((c) => c.kind === 'finished-elsewhere')
  assert.equal(dropped.length, 1)
  assert.equal(dropped[0].field, 'activeWorkout')
  assert.equal(dropped[0].id, null)
  assert.deepEqual(dropped[0].lost, B.activeWorkout, 'the lost value is B’s in-progress workout')
  assert.equal(dropped[0].lost, B.activeWorkout, 'verbatim — the same object, not a rebuilt one')
  // The server re-validates the merged result: it still passes.
  assert.doesNotThrow(() => validState(state))
})

test('criterion 1: the other direction (A’s finish arrives on top of B’s set) gives the same null', () => {
  const { base, A, B, id } = threeStates()
  const { state, conflicts } = mergeStates(base, A, B)
  assert.equal(state.activeWorkout, null)
  assert.equal(state.workouts.filter((w) => w.id === id).length, 1)
  // Here A's `null` already wins the activeWorkout record (incoming); the guard has nothing to drop.
  assert.ok(!conflicts.some((c) => c.kind === 'finished-elsewhere'))
})

test('criterion 2: both devices still mid-workout, one logs a set → unchanged: incoming wins, edited-on-both, not null', () => {
  const base = withSet(fullState())
  const A = withSet(base)
  const B = withSet(base)
  const { state, conflicts } = mergeStates(base, B, A)
  assert.equal(state.activeWorkout, B.activeWorkout, 'incoming wins')
  assert.deepEqual(conflicts, [{ field: 'activeWorkout', id: null, kind: 'edited-on-both', lost: A.activeWorkout }])
})

test('a workout in progress whose id is not in history is never dropped, even when history changed on both sides', () => {
  const { base, A } = threeStates()
  // A finished wo-2; B started nothing new but its workout has another id (a fresh start on B).
  const B = { ...base, activeWorkout: { ...base.activeWorkout, id: 'wo-other' } }
  const { state, conflicts } = mergeStates(base, B, A)
  assert.equal(state.activeWorkout, B.activeWorkout)
  assert.ok(!conflicts.some((c) => c.kind === 'finished-elsewhere'))
})

// --- step 2: the read-only duplicate-id check (./server/ops duplicates [<db file>]) ---
async function dataDirWith(state) {
  const dataDir = tempDir('workout-req268-test-')
  const deps = openDataDir(dataDir)
  await bootstrapUser(deps.db, { username: 'emilio', password: 'sixsix' })
  putState(deps.db, findUser(deps.db, 'emilio').id, { baseRev: 0, state })
  deps.db.close()
  return { dataDir, dbFile: join(dataDir, DB_FILE), cleanup: () => rmSync(dataDir, { recursive: true, force: true }) }
}
const cli = (dataDir, dbFile) =>
  spawnSync(process.execPath, [fileURLToPath(new URL('./ops-cli.mjs', import.meta.url)), 'duplicates', dbFile], {
    encoding: 'utf8',
    env: { ...process.env, WORKOUT_DATA_DIR: dataDir },
  })

test('criterion 5: the check reports 0 on a clean DB and names the id on a seeded duplicate; it opens the DB read-only', async () => {
  const { A: finished, id } = threeStates() // wo-2 finished
  const clean = await dataDirWith(finished)
  // The duplicate is what finishing again stored before this fix: validState accepts it (store.mjs).
  const dup = await dataDirWith({ ...finished, workouts: [...finished.workouts, finished.workouts.find((w) => w.id === id)] })
  try {
    const before = readFileSync(clean.dbFile)
    const c = cli(clean.dataDir, clean.dbFile)
    assert.equal(c.status, 0, c.stderr)
    console.log(c.stdout)
    assert.match(c.stdout, /emilio: rev 1 · duplicate workout ids: none\n/)
    assert.match(c.stdout, /\n0 duplicate workout ids\n$/)
    assert.deepEqual(duplicateWorkoutIds(clean.dbFile), [{ username: 'emilio', rev: 1, duplicates: [], activeInHistory: null }])

    const d = cli(dup.dataDir, dup.dbFile)
    assert.equal(d.status, 0, d.stderr)
    console.log(d.stdout)
    assert.match(d.stdout, new RegExp(`emilio: rev 1 · duplicate workout ids: ${id} ×2\\n`))
    assert.match(d.stdout, /\n1 duplicate workout id\n$/)

    // Read-only: a write through the same handle is refused, and the check left the file as it was.
    const db = readOnlyDb(clean.dbFile)
    try {
      assert.throws(() => db.exec("UPDATE users SET username = 'x'"), /readonly/i)
    } finally {
      db.close()
    }
    assert.deepEqual(readFileSync(clean.dbFile), before, 'the DB file is byte-identical after the check')
  } finally {
    clean.cleanup()
    dup.cleanup()
  }
})

test('the check also names a workout in progress that is already in history (the state the merge fix stops producing)', async () => {
  const { base, A } = threeStates()
  const s = await dataDirWith({ ...A, activeWorkout: base.activeWorkout })
  try {
    const out = cli(s.dataDir, s.dbFile)
    assert.equal(out.status, 0, out.stderr)
    assert.match(out.stdout, new RegExp(`workout in progress ${base.activeWorkout.id} is also in history`))
    assert.match(out.stdout, /\n0 duplicate workout ids\n$/)
  } finally {
    s.cleanup()
  }
})
