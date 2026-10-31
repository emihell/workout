// req-273 — sync hardening: the no-base merge after a restore keeps the server's live workout
// (criteria 4–5), and `./server/ops duplicates` leaves no -wal/-shm beside a closed WAL DB while
// still reading the WAL when a writer has it open (criterion 6). Temp DBs only (BACKEND rule 8).
import { tempDir } from './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { bootstrapUser, findUser } from './auth.mjs'
import { DB_FILE } from './config.mjs'
import { openDataDir } from './db.mjs'
import { mergeWithoutBase } from './merge.mjs'
import { duplicateWorkoutIds } from './ops.mjs'
import { putState, validState } from './store.mjs'
import { fullState } from '../src/test-support/full-state.js'
import { setLoggedState } from '../src/state-reducers.js'
import { finishedState } from '../src/workout-finish.js'

const withSet = (s) =>
  setLoggedState(s, {
    routineItemId: 'si-press',
    exerciseId: 'ex-press',
    setType: 'work',
    weight: 25,
    reps: '8',
    rpe: null,
    note: 'set-273',
    targetReps: '10',
    targetWeight: 25,
    loggedAt: '2026-10-09T17:30:00.000Z',
  })

// The probe: the device holds a stale wo-2 in progress AND wo-2 finished in history (a backup made
// after the finish); the server holds the same history with wo-new live (started after the restore).
function probe() {
  const base = withSet(fullState())
  const finished = finishedState(base, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z')
  const stale = base.activeWorkout
  const device = { ...finished, activeWorkout: stale }
  const live = { ...stale, id: 'wo-new', sets: [] }
  const server = { ...finished, activeWorkout: live }
  return { device, server, stale, live, finished }
}

test('criterion 4: restored=true → the server’s live wo-new is kept; conflicts exactly [no-base-finished: wo-2]', () => {
  const { device, server, stale, live } = probe()
  const { state, conflicts } = mergeWithoutBase(device, server, { restored: true })
  console.log('restored=true  active:', state.activeWorkout?.id ?? null, conflicts.map((c) => `${c.kind}:${c.lost?.id}`))
  assert.equal(state.activeWorkout, live, 'wo-new kept, verbatim (same object)')
  assert.deepEqual(conflicts, [{ field: 'activeWorkout', id: null, kind: 'no-base-finished', lost: stale }])
  assert.equal(conflicts[0].lost, stale, 'the dropped stale copy, verbatim')
  assert.doesNotThrow(() => validState(state))
})

test('criterion 4: restored=false → unchanged (server’s wo-new wins, the device’s wo-2 listed as no-base-differs)', () => {
  const { device, server, stale, live } = probe()
  const { state, conflicts } = mergeWithoutBase(device, server, { restored: false })
  console.log('restored=false active:', state.activeWorkout?.id ?? null, conflicts.map((c) => `${c.kind}:${c.lost?.id}`))
  assert.equal(state.activeWorkout, live)
  assert.deepEqual(conflicts, [{ field: 'activeWorkout', id: null, kind: 'no-base-differs', lost: stale }])
})

test('criterion 5: the other side’s workout is in the merged history too → null, as before', () => {
  const { device, server, stale, live, finished } = probe()
  // The server's live workout id is also a finished workout in its history (the merged history keeps it).
  const finishedNew = { ...finished.workouts.find((w) => w.id === stale.id), id: live.id }
  const serverWithIt = { ...server, workouts: [...server.workouts, finishedNew] }
  const { state, conflicts } = mergeWithoutBase(device, serverWithIt, { restored: true })
  assert.equal(state.activeWorkout, null)
  assert.ok(state.workouts.some((w) => w.id === live.id), 'wo-new is in the merged history')
  const active = conflicts.filter((c) => c.field === 'activeWorkout')
  assert.deepEqual(active, [
    { field: 'activeWorkout', id: null, kind: 'no-base-in-progress', lost: live },
    { field: 'activeWorkout', id: null, kind: 'no-base-finished', lost: stale },
  ])
})

// Review should-fix 1 — on a PRUNED base (restored=false) nothing changes: the server's workout wo-X is
// already in its own history (an F-SYNC-1 leftover); a stale laptop's live wo-L must not win (DEC-133
// round 5 #1). Main's result: null, the laptop's wo-L listed as no-base-differs, wo-X as no-base-finished.
test('review 1: pruned base, server’s workout already in history → null with main’s conflicts, never the laptop’s wo-L', () => {
  const { finished, stale } = probe()
  const doneX = { ...finished.workouts.find((w) => w.id === stale.id), id: 'wo-X' }
  const liveX = { ...stale, id: 'wo-X' }
  const laptopL = { ...stale, id: 'wo-L', sets: [] }
  const cases = {
    'A: wo-X only in the server’s history': [{ ...finished, activeWorkout: laptopL }, { ...finished, workouts: [...finished.workouts, doneX], activeWorkout: liveX }],
    'B: wo-X in both histories': [
      { ...finished, workouts: [...finished.workouts, doneX], activeWorkout: laptopL },
      { ...finished, workouts: [...finished.workouts, doneX], activeWorkout: liveX },
    ],
  }
  for (const [label, [laptop, srv]] of Object.entries(cases)) {
    const { state, conflicts } = mergeWithoutBase(laptop, srv, { restored: false })
    console.log(label, '→ active:', state.activeWorkout?.id ?? null, conflicts.filter((c) => c.field === 'activeWorkout').map((c) => `${c.kind}:${c.lost?.id}`))
    assert.equal(state.activeWorkout, null, label)
    assert.deepEqual(conflicts.filter((c) => c.field === 'activeWorkout'), [
      { field: 'activeWorkout', id: null, kind: 'no-base-differs', lost: laptopL },
      { field: 'activeWorkout', id: null, kind: 'no-base-finished', lost: liveX },
    ], label)
  }
})

// --- criterion 6: ./server/ops duplicates on a WAL database ---
async function dataDirWith(state) {
  const dataDir = tempDir('workout-req273-test-')
  const deps = openDataDir(dataDir)
  await bootstrapUser(deps.db, { username: 'emilio', password: 'sixsix' })
  putState(deps.db, findUser(deps.db, 'emilio').id, { baseRev: 0, state })
  return { dataDir, deps, dbFile: join(dataDir, DB_FILE), cleanup: () => rmSync(dataDir, { recursive: true, force: true }) }
}
const files = (dir) => readdirSync(dir).filter((f) => f.startsWith(DB_FILE)).sort()

test('criterion 6: closed WAL DB → no -wal/-shm left beside it, and the count is right', async () => {
  const { finished } = probe()
  const id = finished.workouts[finished.workouts.length - 1].id
  const s = await dataDirWith({ ...finished, workouts: [...finished.workouts, finished.workouts.find((w) => w.id === id)] })
  try {
    s.deps.db.close()
    assert.deepEqual(files(s.dataDir), [DB_FILE], 'closed: only the DB file')
    assert.deepEqual(duplicateWorkoutIds(s.dbFile), [{ username: 'emilio', rev: 1, duplicates: [{ id, count: 2 }], activeInHistory: null }])
    console.log('after duplicates on a closed DB:', files(s.dataDir).join(' '))
    assert.deepEqual(files(s.dataDir), [DB_FILE], 'no sidecars')
  } finally {
    s.cleanup()
  }
})

test('criterion 6: writer open (WAL present) → reads the newest revision from the WAL', async () => {
  const { finished } = probe()
  const s = await dataDirWith(finished) // rev 1, writer still open
  try {
    const uid = findUser(s.deps.db, 'emilio').id
    s.deps.db.exec('PRAGMA wal_checkpoint(TRUNCATE)') // rev 1 in the main file; the WAL is empty
    const dupId = finished.workouts[0].id
    putState(s.deps.db, uid, { baseRev: 1, state: { ...finished, workouts: [...finished.workouts, finished.workouts[0]] } }) // rev 2
    assert.ok(existsSync(`${s.dbFile}-wal`), 'the writer has a -wal')
    // Proof rev 2 is only in the WAL: an immutable read (which ignores the WAL) still sees rev 1.
    const imm = new DatabaseSync(`${pathToFileURL(s.dbFile).href}?immutable=1`, { readOnly: true })
    try {
      assert.equal(imm.prepare('SELECT MAX(rev) AS rev FROM revisions').get().rev, 1, 'rev 2 is not in the main file yet')
    } finally {
      imm.close()
    }
    const out = duplicateWorkoutIds(s.dbFile)
    console.log('writer open:', JSON.stringify(out))
    assert.deepEqual(out, [{ username: 'emilio', rev: 2, duplicates: [{ id: dupId, count: 2 }], activeInHistory: null }])
  } finally {
    s.deps.db.close()
    s.cleanup()
  }
})
