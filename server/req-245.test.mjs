// req-245 (DEC-141) — `ops plan preview|apply|revert`: the coach's plan into the DB as a new revision,
// Keep-my-history rules, backups first, `source`/`note` on the revision, kept by pruning.
// Temp data dirs only (BACKEND rules 2 and 8); the CLI runs with WORKOUT_DATA_DIR set to one.
import { client, startTestServer, tempDir } from './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { buildBackup } from '../src/exchange.js'
import { fullState } from '../src/test-support/full-state.js'
import { bootstrapUser, findUser } from './auth.mjs'
import { DB_FILE } from './config.mjs'
import { openDataDir, openDb } from './db.mjs'
import { listBackups, liveBuildCheck } from './ops.mjs'
import { PlanRefused, applyPlan, planChange, previewPlan, readPlanFile, revertPlan } from './plan.mjs'
import { ClientError, getRevision, getState, listRevisions, putState, validState } from './store.mjs'

const CLI = fileURLToPath(new URL('./ops-cli.mjs', import.meta.url))
const OPS = fileURLToPath(new URL('./ops', import.meta.url))
const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-10-20T10:00:00.000Z')

// The phone's state: full setup, two finished workouts, no workout in progress.
const phoneState = () => ({ ...fullState(), activeWorkout: null })

// The coach's output: the app's Export of the phone's state with the plan changed — rtn-a's focus
// edited, a new exercise and routine, a second slot.
function coachState(from = phoneState()) {
  const s = structuredClone(from)
  s.exercises.push({ id: 'ex-curl', name: 'Curl', equipment: 'Machine', muscles: 'Biceps', cues: '', type: 'machine', weightStep: '5', archivedAt: null, hasDuration: false, durationSec: 30 })
  s.routines[0] = { ...s.routines[0], focus: 'Push' }
  s.routines.push({
    id: 'rtn-b',
    name: 'Arms',
    focus: 'Arms',
    archivedAt: null,
    exercises: [{ id: 'si-curl', exerciseId: 'ex-curl', role: 'main', sets: 3, targets: ['12', '12', '12'], suggestedWeights: [], durations: [], restSec: 60, notes: '', warmup: null }],
  })
  s.schedule = { ...s.schedule, slots: [...s.schedule.slots, { id: 'slot-b', week: 0, weekday: 4, routineId: 'rtn-b' }] }
  return s
}

// A data dir with one user and the phone's state as rev 1; the DB left open (like a running server).
async function seeded({ state = phoneState(), at = T0 } = {}) {
  const dataDir = tempDir('workout-req245-')
  const deps = openDataDir(dataDir)
  await bootstrapUser(deps.db, { username: 'emilio', password: 'sixsix' })
  const id = findUser(deps.db, 'emilio').id
  const first = putState(deps.db, id, { baseRev: 0, state }, at)
  return {
    dataDir,
    db: deps.db,
    id,
    first,
    dbFile: join(dataDir, DB_FILE),
    cleanup: () => (deps.db.isOpen && deps.db.close(), rmSync(dataDir, { recursive: true, force: true })),
  }
}

const cli = (dataDir, ...args) =>
  spawnSync(process.execPath, [CLI, 'plan', ...args], { encoding: 'utf8', env: { ...process.env, WORKOUT_DATA_DIR: dataDir } })
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const writeJson = (dir, name, value) => {
  const file = join(dir, name)
  writeFileSync(file, JSON.stringify(value, null, 2))
  return file
}

test('readPlanFile: the app’s Export, or a bare state; anything else → 400 (validState)', () => {
  const s = coachState()
  assert.deepEqual(readPlanFile(buildBackup(s)), validState(s))
  assert.deepEqual(readPlanFile(s), validState(s))
  // validState alone takes `{}` as an empty state; a plan file must carry the setup arrays.
  assert.deepEqual(validState({ hello: 'world' }).routines, [])
  assert.throws(() => readPlanFile({ hello: 'world' }), (e) => e instanceof ClientError && /Not a workout plan/.test(e.message))
  assert.throws(() => readPlanFile({ kind: 'workout-mvp-backup', version: 1, state: {} }), /Not a workout plan/)
  assert.throws(() => readPlanFile({ kind: 'workout-mvp-backup', version: 1, state: { exercises: 'nope', routines: [] } }), /Not a workout plan/)
  assert.throws(() => readPlanFile({ exercises: [{ id: 1 }], routines: [{ exercises: 'x' }] }), /Not a workout database backup/)
  assert.throws(() => readPlanFile({ ...buildBackup(s), version: 2 }), /v1 document/)
  assert.throws(() => readPlanFile(null), ClientError)
})

test('AC1 — preview prints the import lines and counts; the DB is byte-unchanged', async () => {
  const s = await seeded()
  const dir = tempDir('workout-req245-file-')
  try {
    s.db.close() // a closed DB: its bytes are the whole state (no -wal to fold in later)
    const before = { sha: sha(s.dbFile), files: readdirSync(s.dataDir).sort() }
    const file = writeJson(dir, 'plan.json', buildBackup(coachState()))
    const r = cli(s.dataDir, 'preview', file)
    console.log(r.stdout)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /against rev 1$/m)
    assert.match(r.stdout, /^ {2}Workouts: 1 added, 1 changed$/m)
    assert.match(r.stdout, /^ {2}Exercises: 1 added$/m)
    assert.match(r.stdout, /^ {2}Schedule: changed$/m)
    assert.match(r.stdout, /^ {2}Logged history: unchanged$/m)
    assert.match(r.stdout, /^ {2}routines: 1 added, 1 changed, 0 removed, 0 archived$/m)
    assert.match(r.stdout, /^ {2}exercises: 1 added, 0 changed, 0 removed$/m)
    assert.match(r.stdout, /^ {2}schedule slots: 1 → 2$/m)
    assert.match(r.stdout, /^ {2}logged workouts: 2 · identical after: yes$/m)
    assert.match(r.stdout, /^Nothing written \(preview\)\.$/m)
    assert.equal(sha(s.dbFile), before.sha, 'workout.db byte-unchanged')
    // A read-only open of a WAL-mode DB leaves SQLite's empty -wal/-shm sidecars (the running server
    // has them anyway); workout.db itself is byte-identical and nothing else appears.
    const sidecars = ['workout.db-shm', 'workout.db-wal']
    assert.deepEqual(readdirSync(s.dataDir).filter((f) => !sidecars.includes(f)).sort(), before.files, 'no backup, no new file')
    if (existsSync(join(s.dataDir, 'workout.db-wal'))) assert.equal(readFileSync(join(s.dataDir, 'workout.db-wal')).length, 0, 'an empty WAL: no write')
    // apply without --yes is the same preview, exit 2, nothing written.
    const dry = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'week 3')
    assert.equal(dry.status, 2, dry.stderr)
    assert.match(dry.stdout, /Nothing written\. With --yes: a backup \(before-plan-coach\), then one new revision\./)
    assert.match(dry.stdout, /^To write it: plan apply .* --source coach --note "…" --yes --expect-rev 1$/m)
    assert.equal(sha(s.dbFile), before.sha)
    assert.deepEqual(readdirSync(s.dataDir).filter((f) => !sidecars.includes(f)).sort(), before.files)
  } finally {
    s.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('AC2 — apply --yes: one backup, rev+1 with source/note, workouts identical, routines and schedule as the file’s', async () => {
  const s = await seeded()
  const dir = tempDir('workout-req245-file-')
  try {
    const before = getState(s.db, s.id)
    const coach = coachState()
    const file = writeJson(dir, 'plan.json', buildBackup(coach))
    const r = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'week 3: arms day', '--yes', '--expect-rev', '1')
    console.log(r.stdout)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^wrote rev 2 \(source coach\)/m)
    const backups = listBackups(s.dataDir)
    assert.equal(backups.length, 1)
    assert.equal(backups[0].reason, 'before-plan-coach')
    assert.equal(new DatabaseSync(backups[0].file, { readOnly: true }).prepare('SELECT MAX(rev) AS rev FROM revisions').get().rev, 1, 'the backup is the state before')
    const after = getState(s.db, s.id)
    assert.equal(after.rev, before.rev + 1)
    assert.deepEqual(after.state.workouts, before.state.workouts, 'workouts deep-equal')
    assert.deepEqual(after.state.draftWorkouts, before.state.draftWorkouts)
    assert.equal(after.state.activeWorkout, null)
    const want = validState(coach)
    assert.deepEqual(after.state.routines, want.routines)
    assert.deepEqual(after.state.exercises, want.exercises)
    assert.deepEqual(after.state.schedule, want.schedule)
    const listed = listRevisions(s.db, s.id).at(-1)
    assert.deepEqual({ rev: listed.rev, source: listed.source, note: listed.note, merged: listed.merged }, { rev: 2, source: 'coach', note: 'week 3: arms day', merged: false })
    assert.deepEqual(listRevisions(s.db, s.id)[0].source, null, 'a device push: null')
    // The same file again: nothing to change → nothing written, no backup.
    const again = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'again', '--yes', '--expect-rev', '2')
    assert.equal(again.status, 0, again.stderr)
    assert.match(again.stdout, /Nothing to change/)
    assert.equal(listBackups(s.dataDir).length, 1)
    assert.equal(getState(s.db, s.id).rev, 2)
  } finally {
    s.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('apply keeps history-used setup the file dropped, archived (Keep my history), and says so', async () => {
  const s = await seeded()
  try {
    const coach = coachState()
    coach.routines = coach.routines.filter((r) => r.id !== 'rtn-a') // the workouts used rtn-a
    coach.schedule = { ...coach.schedule, slots: coach.schedule.slots.filter((x) => x.routineId !== 'rtn-a'), moves: [] }
    const at = new Date(T0.getTime() + 1000)
    const out = await applyPlan(s.db, s.dataDir, s.id, validState(coach), { source: 'coach', note: 'drop upper', at })
    assert.equal(out.written, true)
    assert.equal(out.counts.routines.archived, 1)
    assert.ok(out.lines.some((l) => /With Keep my history: 1 workout kept as archived/.test(l)), out.lines.join('\n'))
    const rtnA = getState(s.db, s.id).state.routines.find((r) => r.id === 'rtn-a')
    assert.equal(rtnA.archivedAt, at.toISOString())
  } finally {
    s.cleanup()
  }
})

test('AC3 — refused, nothing written, no backup: history differs; a workout in progress; an invalid file', async () => {
  const dir = tempDir('workout-req245-file-')
  // (a) the file's logged history differs from the server's
  const s = await seeded()
  try {
    const coach = coachState()
    coach.workouts[0] = { ...coach.workouts[0], overallNote: 'edited by the coach' }
    const file = writeJson(dir, 'history.json', buildBackup(coach))
    const r = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'x', '--yes', '--expect-rev', '1')
    console.log(r.stdout)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /REFUSED: The file’s logged history differs from the server’s: 1 record\(s\) — wo-1 \(differs from the server’s\)/)
    assert.match(r.stdout, /Nothing written, no backup taken\./)
    assert.equal(getState(s.db, s.id).rev, 1)
    assert.deepEqual(listBackups(s.dataDir), [])
    // A workout the file has and the server doesn't: refused too.
    const extra = coachState()
    extra.workouts.push({ ...extra.workouts[0], id: 'wo-invented' })
    await assert.rejects(applyPlan(s.db, s.dataDir, s.id, validState(extra), { source: 'coach', note: 'x' }), (e) => e instanceof PlanRefused && /wo-invented \(not on the server\)/.test(e.message))
    // Workouts only the server has (logged after the export) are not a mismatch.
    const older = coachState()
    older.workouts = older.workouts.filter((w) => w.id !== 'wo-1')
    assert.deepEqual(previewPlan(s.db, s.id, validState(older)).refusals, [])
    assert.deepEqual(listBackups(s.dataDir), [])
  } finally {
    s.cleanup()
  }
  // (b) a workout in progress on the server
  const live = await seeded({ state: fullState() })
  try {
    assert.ok(getState(live.db, live.id).state.activeWorkout)
    const file = writeJson(dir, 'plan.json', buildBackup(coachState()))
    const r = cli(live.dataDir, 'apply', file, '--source', 'coach', '--note', 'x', '--yes', '--expect-rev', '1')
    assert.equal(r.status, 1)
    assert.match(r.stdout, /^ {2}workout in progress: YES$/m)
    assert.match(r.stdout, /REFUSED: A workout is in progress/)
    assert.equal(getState(live.db, live.id).rev, 1)
    assert.deepEqual(listBackups(live.dataDir), [])
    // revert is refused the same way
    await assert.rejects(revertPlan(live.db, live.dataDir, live.id, 1), PlanRefused)
    assert.deepEqual(listBackups(live.dataDir), [])
  } finally {
    live.cleanup()
  }
  // (c) an invalid file
  const bad = await seeded()
  try {
    const file = writeJson(dir, 'bad.json', { kind: 'workout-mvp-backup', version: 1, state: { exercises: 'nope', routines: [] } })
    const r = cli(bad.dataDir, 'apply', file, '--source', 'coach', '--note', 'x', '--yes', '--expect-rev', '1')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /Not a workout plan/)
    writeFileSync(join(dir, 'garbage.json'), '{not json')
    const g = cli(bad.dataDir, 'preview', join(dir, 'garbage.json'))
    assert.equal(g.status, 1)
    assert.match(g.stderr, /is not JSON/)
    assert.equal(getState(bad.db, bad.id).rev, 1)
    assert.deepEqual(listBackups(bad.dataDir), [])
    // bad --source / missing --note: refused before anything
    await assert.rejects(applyPlan(bad.db, bad.dataDir, bad.id, validState(coachState()), { source: 'Bad Name', note: 'x' }), /--source/)
    await assert.rejects(applyPlan(bad.db, bad.dataDir, bad.id, validState(coachState()), { source: 'coach', note: ' ' }), /--note/)
    await assert.rejects(applyPlan(bad.db, bad.dataDir, bad.id, validState(coachState()), { source: 'revert', note: 'x' }), /revert command/)
    assert.deepEqual(listBackups(bad.dataDir), [])
  } finally {
    bad.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a device push between preview and write: putState refuses (fastForwardOnly), nothing written', async () => {
  const s = await seeded()
  try {
    const plan = previewPlan(s.db, s.id, validState(coachState()))
    // the phone logs something first
    const phone = { ...phoneState(), plannedWorkouts: [] }
    phone.workouts = [...phone.workouts, { ...phone.workouts[0], id: 'wo-race' }]
    putState(s.db, s.id, { baseRev: 1, baseId: s.first.revId, state: phone })
    assert.throws(
      () => putState(s.db, s.id, { baseRev: plan.rev, baseId: plan.revId, state: plan.result }, new Date(), { source: 'coach', note: 'x', fastForwardOnly: true }),
      (e) => e.status === 409 && /moved to rev 2 since rev 1/.test(e.message),
    )
    assert.equal(getState(s.db, s.id).rev, 2)
    // Through applyPlan: the push lands while the backup runs (applyPlan is suspended in backupDb) →
    // 409, and the backup just taken is removed — none left claiming a write.
    const cur = getState(s.db, s.id)
    const pending = applyPlan(s.db, s.dataDir, s.id, validState(coachState(validState(phone))), { source: 'coach', note: 'x' })
    putState(s.db, s.id, { baseRev: cur.rev, baseId: cur.revId, state: { ...cur.state, workouts: [{ ...cur.state.workouts[0], id: 'wo-race-2' }, ...cur.state.workouts] } })
    await assert.rejects(pending, (e) => e.status === 409)
    assert.equal(getState(s.db, s.id).rev, 3)
    assert.deepEqual(listBackups(s.dataDir), [])
  } finally {
    s.cleanup()
  }
})

test('AC4 — a device push based on the rev before the apply merges three-way: the device’s new workout and the applied plan both stay', async () => {
  const s = await seeded()
  try {
    const applied = await applyPlan(s.db, s.dataDir, s.id, validState(coachState()), { source: 'coach', note: 'plan', at: new Date(T0.getTime() + 1000) })
    assert.equal(applied.rev, 2)
    // The phone, still at rev 1, finishes a workout and pushes.
    const phone = phoneState()
    const logged = { ...phone.workouts[0], id: 'wo-new', performedOn: '2026-10-21', sets: [{ ...phone.workouts[0].sets[0], weight: 25, reps: '8' }] }
    phone.workouts = [logged, ...phone.workouts]
    const out = putState(s.db, s.id, { baseRev: 1, baseId: s.first.revId, state: phone })
    assert.equal(out.merged, true)
    assert.equal(out.rev, 3)
    assert.deepEqual(out.conflicts, [])
    const now = getState(s.db, s.id).state
    assert.deepEqual(now.workouts.find((w) => w.id === 'wo-new'), validState(phone).workouts[0], 'the device’s new sets')
    const want = validState(coachState())
    assert.deepEqual(now.routines, want.routines, 'the applied plan')
    assert.deepEqual(now.schedule, want.schedule)
    assert.deepEqual(now.exercises, want.exercises)
  } finally {
    s.cleanup()
  }
})

test('AC5 — revert <rev>: that revision’s routines/schedule back; workouts logged after it remain', async () => {
  const s = await seeded()
  try {
    const t = (ms) => new Date(T0.getTime() + ms)
    await applyPlan(s.db, s.dataDir, s.id, validState(coachState()), { source: 'coach', note: 'plan', at: t(1000) })
    // a workout logged on the new plan (rev 3)
    const cur = getState(s.db, s.id)
    const logged = { ...cur.state.workouts[0], id: 'wo-after', performedOn: '2026-10-22' }
    putState(s.db, s.id, { baseRev: cur.rev, baseId: cur.revId, state: { ...cur.state, workouts: [logged, ...cur.state.workouts] } }, t(2000))
    const before = getState(s.db, s.id)
    assert.equal(before.rev, 3)
    const out = await revertPlan(s.db, s.dataDir, s.id, 1, { at: t(3000) })
    assert.equal(out.rev, 4)
    const now = getState(s.db, s.id).state
    const rev1 = getRevision(s.db, s.id, 1).state
    assert.deepEqual(now.routines, rev1.routines)
    assert.deepEqual(now.schedule, rev1.schedule)
    assert.deepEqual(now.exercises, rev1.exercises)
    assert.deepEqual(now.workouts, before.state.workouts, 'history since rev 1 stays')
    assert.ok(now.workouts.some((w) => w.id === 'wo-after'))
    const listed = listRevisions(s.db, s.id).at(-1)
    assert.deepEqual([listed.source, listed.note], ['revert', 'revert to rev 1'])
    assert.deepEqual(listBackups(s.dataDir).map((b) => b.reason).sort(), ['before-plan-coach', 'before-plan-revert'])
    await assert.rejects(revertPlan(s.db, s.dataDir, s.id, 99), /not kept/)
    // the CLI form, without --yes: a preview, exit 2
    const r = cli(s.dataDir, 'revert', '2')
    console.log(r.stdout)
    assert.equal(r.status, 2, r.stderr)
    assert.match(r.stdout, /plan revert: rev 2’s setup for emilio, against rev 4/)
    assert.match(r.stdout, /before-plan-revert/)
  } finally {
    s.cleanup()
  }
})

test('AC6 — pruning never drops a plan-apply (or revert) revision: a clock 30 days on', async () => {
  const s = await seeded()
  try {
    const t = (ms) => new Date(T0.getTime() + ms)
    await applyPlan(s.db, s.dataDir, s.id, validState(coachState()), { source: 'coach', note: 'plan', at: t(1000) })
    // two device pushes the same day: rev 2 (the apply) is no longer that day's last
    let cur = getState(s.db, s.id)
    for (const [i, ms] of [[3, 2000], [4, 3000]].entries()) {
      const st = { ...cur.state, workouts: [{ ...cur.state.workouts[0], id: `wo-day-${i}` }, ...cur.state.workouts] }
      putState(s.db, s.id, { baseRev: cur.rev, baseId: cur.revId, state: st }, t(ms[1]))
      cur = getState(s.db, s.id)
    }
    // 30 days on
    const st = { ...cur.state, workouts: [{ ...cur.state.workouts[0], id: 'wo-later' }, ...cur.state.workouts] }
    putState(s.db, s.id, { baseRev: cur.rev, baseId: cur.revId, state: st }, t(30 * DAY))
    const kept = listRevisions(s.db, s.id).map((r) => `${r.rev}:${r.source ?? '-'}`)
    console.log('kept after 30 days:', kept.join(' '))
    // rev 1 and 3 pruned (older than 14 days, not their day's last); rev 2 (coach) kept; 4 = last of the day; 5 = current
    assert.deepEqual(kept, ['2:coach', '4:-', '5:-'])
  } finally {
    s.cleanup()
  }
})

test('schema: a revisions table from before req-245 gains source/note on open; old rows read null', () => {
  const dir = tempDir('workout-req245-schema-')
  const file = join(dir, DB_FILE)
  try {
    const old = new DatabaseSync(file)
    old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE revisions (user_id INTEGER NOT NULL REFERENCES users(id), rev INTEGER NOT NULL, state TEXT NOT NULL, base_rev INTEGER NOT NULL,
        merged INTEGER NOT NULL DEFAULT 0, conflicts TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, PRIMARY KEY (user_id, rev));
      PRAGMA user_version = 1;`)
    old.prepare('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)').run('emilio', 'x', T0.toISOString())
    old.prepare('INSERT INTO revisions (user_id, rev, state, base_rev, created_at) VALUES (1, 1, ?, 0, ?)').run(JSON.stringify(validState(phoneState())), T0.toISOString())
    // read-only, before the columns exist: getState / getRevision still read (SELECT *)
    assert.equal(getState(old, 1).rev, 1)
    assert.equal(getRevision(old, 1, 1).source, null)
    old.close()
    const db = openDb(file)
    const cols = db.prepare('PRAGMA table_info(revisions)').all().map((c) => c.name)
    assert.deepEqual(cols.slice(-2), ['source', 'note'])
    assert.deepEqual(listRevisions(db, 1).map((r) => [r.source, r.note]), [[null, null]])
    db.close()
    // opening again is a no-op (no duplicate ALTER)
    openDb(file).close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('API: GET /api/revisions lists source/note; a device push leaves them null', async () => {
  const srv = await startTestServer()
  try {
    await bootstrapUser(srv.db, { username: 'emilio', password: 'sixsix' })
    const a = client(srv.base)
    assert.equal((await a.post('/api/login', { username: 'emilio', password: 'sixsix' })).status, 200)
    const pushed = await a.put('/api/state', { baseRev: 0, state: phoneState() })
    assert.equal(pushed.status, 200)
    const id = findUser(srv.db, 'emilio').id
    await applyPlan(srv.db, srv.dataDir, id, validState(coachState()), { source: 'coach', note: 'week 3' })
    const list = (await a.get('/api/revisions')).body
    assert.deepEqual(list.map((r) => [r.rev, r.source, r.note]), [[1, null, null], [2, 'coach', 'week 3']])
    const rev2 = (await a.get('/api/revisions/2')).body
    assert.deepEqual([rev2.source, rev2.note], ['coach', 'week 3'])
    // the phone's next sync picks it up
    const got = (await a.get('/api/state')).body
    assert.equal(got.rev, 2)
    assert.equal(got.state.routines.length, 2)
  } finally {
    await srv.close()
  }
})

test('./server/ops runs the ops CLI (plan preview through the shell script)', async () => {
  const s = await seeded()
  const dir = tempDir('workout-req245-file-')
  try {
    s.db.close()
    const file = writeJson(dir, 'plan.json', coachState()) // a bare state
    const r = spawnSync(OPS, ['plan', 'preview', file, '--user', 'emilio'], { encoding: 'utf8', env: { ...process.env, WORKOUT_DATA_DIR: s.dataDir } })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /plan preview: .* for emilio, against rev 1/)
    const nobody = cli(s.dataDir, 'preview', file, '--user', 'nobody')
    assert.equal(nobody.status, 1)
    assert.match(nobody.stderr, /No user "nobody"\. Users: emilio\./)
    assert.ok(!existsSync(join(s.dataDir, 'backups')))
  } finally {
    s.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('planChange is pure: the result keeps the current history objects as they are', () => {
  const current = validState(phoneState())
  const out = planChange(current, validState(coachState()), { archivedAt: T0.toISOString() })
  assert.deepEqual(out.result.workouts, current.workouts)
  assert.equal(out.counts.workoutsIdentical, true)
  assert.deepEqual(out.refusals, [])
  assert.equal(planChange(current, current).unchanged, true)
})

// ---- review fixes ----

test('review 1 — --yes needs --expect-rev, and a different current rev is refused: exit 1, nothing written, no backup', async () => {
  const s = await seeded()
  const dir = tempDir('workout-req245-file-')
  try {
    const file = writeJson(dir, 'plan.json', buildBackup(coachState()))
    const missing = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'x', '--yes')
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /--yes needs --expect-rev <n>/)
    // the phone syncs after the preview (rev 1 → 2): the yes was for rev 1
    const cur = getState(s.db, s.id)
    putState(s.db, s.id, { baseRev: 1, baseId: cur.revId, state: { ...cur.state, workouts: [{ ...cur.state.workouts[0], id: 'wo-since' }, ...cur.state.workouts] } })
    const stale = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'x', '--yes', '--expect-rev', '1')
    console.log(stale.stdout)
    assert.equal(stale.status, 1)
    assert.match(stale.stdout, /REFUSED: The server is at rev 2, not the previewed rev 1\./)
    assert.match(stale.stdout, /Nothing written, no backup taken\./)
    const rv = cli(s.dataDir, 'revert', '1', '--yes', '--expect-rev', '1')
    assert.equal(rv.status, 1)
    assert.match(rv.stdout, /REFUSED: The server is at rev 2, not the previewed rev 1\./)
    assert.equal(getState(s.db, s.id).rev, 2)
    assert.deepEqual(listBackups(s.dataDir), [])
    // with the current rev it writes
    const ok = cli(s.dataDir, 'apply', file, '--source', 'coach', '--note', 'x', '--yes', '--expect-rev', '2')
    assert.equal(ok.status, 0, ok.stderr)
    assert.match(ok.stdout, /^wrote rev 3 \(source coach\)/m)
  } finally {
    s.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review 2 — a plan file whose schedule has no anchor keeps the server’s anchor', async () => {
  const s = await seeded()
  try {
    assert.equal(getState(s.db, s.id).state.schedule.anchor, '2026-09-28')
    const coach = coachState()
    delete coach.schedule.anchor
    const incoming = readPlanFile(buildBackup(coach))
    assert.equal(incoming.schedule.anchor, undefined, 'validState leaves a missing anchor missing')
    await applyPlan(s.db, s.dataDir, s.id, incoming, { source: 'coach', note: 'no anchor', expectRev: 1 })
    const now = getState(s.db, s.id).state.schedule
    assert.equal(now.anchor, '2026-09-28')
    assert.equal(now.slots.length, 2)
    // a file WITH an anchor sets it
    const moved = { ...coachState(), schedule: { ...coachState().schedule, anchor: '2026-10-05' } }
    await applyPlan(s.db, s.dataDir, s.id, readPlanFile(moved), { source: 'coach', note: 'new anchor', expectRev: 2 })
    assert.equal(getState(s.db, s.id).state.schedule.anchor, '2026-10-05')
  } finally {
    s.cleanup()
  }
})

test('review 3 — liveBuildCheck: the DEPLOYED sha must hold server/plan.mjs', () => {
  const dir = tempDir('workout-req245-git-')
  try {
    const repo = join(dir, 'repo')
    const live = join(dir, 'live')
    const git = (...args) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
    spawnSync('git', ['init', '-q', repo])
    git('config', 'user.email', 't@example.com')
    git('config', 'user.name', 't')
    writeFileSync(join(repo, 'README'), 'x')
    git('add', '.')
    git('commit', '-qm', 'before req-245')
    const before = git('rev-parse', '--short', 'HEAD').stdout.trim()
    mkdirSync(join(repo, 'server'))
    mkdirSync(live)
    writeFileSync(join(repo, 'server', 'plan.mjs'), '// plan')
    git('add', '.')
    git('commit', '-qm', 'req-245')
    const after = git('rev-parse', '--short', 'HEAD').stdout.trim()
    assert.equal(liveBuildCheck(live, [repo]).ok, false, 'no DEPLOYED file')
    writeFileSync(join(live, 'DEPLOYED'), `main ${before} 2026-10-26 10:00:00\n`)
    const old = liveBuildCheck(live, [repo])
    assert.equal(old.ok, false)
    assert.match(old.text, /has no server\/plan\.mjs/)
    writeFileSync(join(live, 'DEPLOYED'), `main ${after} 2026-10-26 11:00:00\n`)
    assert.equal(liveBuildCheck(live, [repo]).ok, true)
    assert.equal(liveBuildCheck(live, [dir]).ok, false, 'a sha no repo knows is a no')
    writeFileSync(join(live, 'DEPLOYED'), 'garbage\n')
    assert.match(liveBuildCheck(live, [repo]).text, /names no commit/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review 5–7 — preview exits 1 on REFUSED; dry runs check --source/--note; a plan with zero routines is refused', async () => {
  const s = await seeded({ state: fullState() }) // a workout in progress → refused
  const dir = tempDir('workout-req245-file-')
  try {
    const file = writeJson(dir, 'plan.json', buildBackup(coachState()))
    const r = cli(s.dataDir, 'preview', file)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /REFUSED: A workout is in progress/)
    const noSource = cli(s.dataDir, 'apply', file, '--note', 'x')
    assert.equal(noSource.status, 1)
    assert.match(noSource.stderr, /--source/)
    const noNote = cli(s.dataDir, 'apply', file, '--source', 'coach')
    assert.equal(noNote.status, 1)
    assert.match(noNote.stderr, /--note/)
    assert.throws(() => readPlanFile({ ...coachState(), routines: [] }), /no routines/)
    assert.deepEqual(listBackups(s.dataDir), [])
  } finally {
    s.cleanup()
    rmSync(dir, { recursive: true, force: true })
  }
})
