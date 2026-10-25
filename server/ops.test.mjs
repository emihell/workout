// req-231 — backups, the nightly rotation, restores (to a throwaway dir and into the data dir with
// the DEC-133 marker), the doctor's parsers, and the cookie-isolation mitigation. Temp dirs and
// port 0 only (BACKEND rules 2 and 8).
import { client, startTestServer, tempDir } from './test-helpers.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fullState } from '../src/test-support/full-state.js'
import { COOKIE, createHttpServer } from './app.mjs'
import { bootstrapUser, findUser } from './auth.mjs'
import { DB_FILE, NODE_FLOOR } from './config.mjs'
import { openDataDir } from './db.mjs'
import {
  NIGHTLY_KEEP,
  backupDb,
  counts,
  integrity,
  launchdNode,
  listBackups,
  listenAddresses,
  nightly,
  plistNode,
  restoreInto,
  restoreTo,
  serveState,
} from './ops.mjs'
import { dropRevisions, getState, listRevisions, putState } from './store.mjs'

const PASSWORD = 'sixsix'
const DAY = 24 * 60 * 60 * 1000
const routine = (id, name = id) => ({ id, name, focus: 'Machines', archivedAt: null, exercises: [] })
const withRoutines = (...routines) => ({ ...fullState(), routines })

// A data dir with one user and a few revisions (one pruned), the DB left OPEN like a running server's.
async function seeded() {
  const dataDir = tempDir('workout-ops-test-')
  const deps = openDataDir(dataDir)
  await bootstrapUser(deps.db, { username: 'drill', password: PASSWORD })
  const id = findUser(deps.db, 'drill').id
  let last = null
  for (const name of ['A', 'B', 'C']) {
    last = putState(deps.db, id, { baseRev: last?.rev ?? 0, ...(last ? { baseId: last.revId } : {}), state: withRoutines(routine(name)) })
  }
  dropRevisions(deps.db, id, [1])
  return { dataDir, ...deps, id, last, cleanup: () => (deps.db.isOpen && deps.db.close(), rmSync(dataDir, { recursive: true, force: true })) }
}

test('backup: an online, integrity-checked copy that holds rows still in the -wal file', async () => {
  const s = await seeded()
  try {
    assert.ok(existsSync(join(s.dataDir, `${DB_FILE}-wal`)), 'the DB is in WAL mode and open')
    const { file, bytes } = await backupDb(s.dataDir, 'before-import', { at: new Date(2026, 9, 22, 9, 5, 7) })
    assert.match(file, /backups\/workout-20261022-090507-before-import\.db$/)
    assert.ok(bytes > 0)
    assert.deepEqual(integrity(file), ['ok'])
    assert.deepEqual(counts(file), counts(join(s.dataDir, DB_FILE)), 'every row, including the un-checkpointed ones')
    assert.equal(counts(file).tables.pruned_revisions, 1)
    // A second backup in the same second gets its own name.
    const again = await backupDb(s.dataDir, 'before-import', { at: new Date(2026, 9, 22, 9, 5, 7) })
    assert.notEqual(again.file, file)
    await assert.rejects(backupDb(s.dataDir, 'Bad Reason'), /lower-case/)
    await assert.rejects(backupDb(s.dataDir, 'nightly'), /reserved/)
    await assert.rejects(backupDb(s.dataDir, 'nightly-3'), /reserved/, 'review nit: the rotation would delete it')
    // One self-contained file each: no .partial, and no -wal/-shm left beside it (seen in the live-shaped run).
    assert.deepEqual(readdirSync(join(s.dataDir, 'backups')).filter((f) => !f.endsWith('.db')), [])
    assert.equal(counts(file).tables.revisions, 2)
  } finally {
    s.cleanup()
  }
})

test('nightly: keeps the newest 7 nightlies; other backups are never rotated', async () => {
  const s = await seeded()
  try {
    const manual = await backupDb(s.dataDir, 'by-hand', { at: new Date(2026, 9, 1, 12) })
    let last
    for (let day = 1; day <= 10; day++) last = await nightly(s.dataDir, { at: new Date(2026, 9, day, 1) })
    assert.equal(NIGHTLY_KEEP, 7)
    assert.equal(last.kept, 7)
    const left = listBackups(s.dataDir)
    assert.deepEqual(
      left.filter((b) => b.reason === 'nightly').map((b) => b.stamp.slice(0, 8)),
      ['20261010', '20261009', '20261008', '20261007', '20261006', '20261005', '20261004'],
    )
    assert.ok(left.some((b) => b.file === manual.file), 'the hand-made backup stays')
  } finally {
    s.cleanup()
  }
})

test('restore --to: a throwaway data dir with the same counts (pruned_revisions included); a non-empty dir is refused', async () => {
  const s = await seeded()
  const to = join(tempDir('workout-ops-restore-'), 'instance')
  try {
    const { file } = await backupDb(s.dataDir, 'drill')
    const r = await restoreTo(file, to)
    assert.deepEqual(r.counts, counts(join(s.dataDir, DB_FILE)))
    assert.equal(r.counts.tables.pruned_revisions, 1)
    assert.deepEqual(r.counts.users.map((u) => [u.username, u.rev, u.routines]), [['drill', 3, 1]])
    await assert.rejects(restoreTo(file, to), /not empty/)
    // The throwaway instance starts on it and the account logs in (a new secret is made there).
    const deps = openDataDir(to)
    const server = createHttpServer({ ...deps })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const c = client(`http://127.0.0.1:${server.address().port}`)
      assert.equal((await c.post('/api/login', { username: 'drill', password: PASSWORD })).status, 200)
      const got = await c.get('/api/state')
      assert.equal(got.body.rev, 3)
      assert.deepEqual(got.body.state.routines.map((x) => x.id), ['C'])
    } finally {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
      deps.db.close()
    }
  } finally {
    s.cleanup()
    rmSync(join(to, '..'), { recursive: true, force: true })
  }
})

test('restore into the data dir: backs the current DB up first, writes a restores marker per user, and the next sync merges', async () => {
  const s = await seeded()
  try {
    const { file } = await backupDb(s.dataDir, 'drill') // at rev 3
    const four = putState(s.db, s.id, { baseRev: 3, baseId: s.last.revId, state: withRoutines(routine('C'), routine('D')) })
    s.db.close()
    const at = new Date('2026-10-22T10:00:00.000Z')
    const r = await restoreInto(file, s.dataDir, { at })
    assert.equal(r.before.users[0].rev, 4)
    assert.equal(r.after.users[0].rev, 3)
    assert.equal(r.marked, 1)
    assert.equal(r.after.tables.restores, 1)
    assert.equal(r.after.tables.pruned_revisions, 1, 'pruned_revisions survives the restore')
    assert.ok(r.safety && counts(r.safety).users[0].rev === 4, 'the replaced DB is kept as pre-restore')
    assert.deepEqual(integrity(join(s.dataDir, DB_FILE)), ['ok'])

    // The server on the restored dir; a device that synced rev 4 (now gone) pushes a change.
    const deps = openDataDir(s.dataDir)
    try {
      assert.deepEqual(deps.db.prepare('SELECT user_id, rev, at FROM restores').all().map((x) => ({ ...x })), [
        { user_id: s.id, rev: 3, at: at.toISOString() },
      ])
      const out = putState(deps.db, s.id, {
        baseRev: 4,
        baseId: four.revId,
        state: withRoutines(routine('C', 'C edited'), routine('D')),
      })
      assert.equal(out.merged, true, 'never a fast-forward over the restored copy')
      assert.equal(out.state.routines.find((x) => x.id === 'C').name, 'C', 'the restored copy is kept where they differ')
      assert.ok(out.conflicts.some((c) => c.id === 'C' && c.lost?.name === 'C edited'), 'the device’s version is listed')
      assert.ok(out.conflicts.some((c) => c.id === 'D' && c.kind === 'no-base-one-side'), 'D (only on the device) kept and listed')
      assert.equal(getState(deps.db, s.id).rev, 4)
    } finally {
      deps.db.close()
    }
  } finally {
    s.cleanup()
  }
})

// DEC-133 round 5 / req-231 — the reviewer's probe C, on the store: phone pushes after the restore,
// logs a 4th set, then a clean stale laptop (its base also lost to the restore) pushes.
test('probe C — after a restore the phone keeps its 4th set when a stale laptop pushes', async () => {
  const s = await seeded()
  try {
    const set = (n) => ({ id: `set-${n}`, exerciseId: 'ex-press', reps: 8, kg: 40 })
    const workout = (n) => ({ id: 'w-live', startedAt: '2026-10-22T09:00:00.000Z', sets: Array.from({ length: n }, (_, i) => set(i + 1)) })
    const st = (n) => ({ ...withRoutines(routine('C')), activeWorkout: workout(n) })
    let rev = s.last
    const push = (state, base = rev) => (rev = putState(s.db, s.id, { baseRev: base.rev, baseId: base.revId, state }))
    push(st(1)) // rev 4 ← the backup
    const { file } = await backupDb(s.dataDir, 'probe-c')
    const laptop = push(st(2)) // rev 5 — the laptop syncs here and stays clean
    const phoneBase = push(st(3)) // rev 6 — the phone
    s.db.close()
    await restoreInto(file, s.dataDir)

    const deps = openDataDir(s.dataDir)
    try {
      // 1. The phone pushes after the restore: its workout wins (DEC-133).
      const first = putState(deps.db, s.id, { baseRev: phoneBase.rev, baseId: phoneBase.revId, state: st(3) })
      assert.equal(first.state.activeWorkout.sets.length, 3)
      // 2. It logs a 4th set (a fast-forward on what it just got back).
      const fourth = putState(deps.db, s.id, { baseRev: first.rev, baseId: first.revId, state: st(4) })
      assert.equal(fourth.merged, false)
      // 3. The clean stale laptop pushes its 2-set copy.
      const stale = putState(deps.db, s.id, { baseRev: laptop.rev, baseId: laptop.revId, state: st(2) })
      assert.equal(stale.merged, true)
      assert.equal(stale.state.activeWorkout.sets.length, 4, 'the phone keeps 4 sets')
      assert.equal(getState(deps.db, s.id).state.activeWorkout.sets.length, 4)
      assert.ok(stale.conflicts.some((c) => c.field === 'activeWorkout' && c.lost?.sets?.length === 2), 'the laptop’s copy is listed')
    } finally {
      deps.db.close()
    }
  } finally {
    s.cleanup()
  }
})

// Review should-fix 1 — A→B→A: the restored copy had no workout; the phone's workout won the first
// push, then the phone discarded it (back to null, equal to the restored value). A stale laptop's
// copy of that workout must not win now: something changed since the restore.
const setOf = (n) => ({ id: `set-${n}`, exerciseId: 'ex-press', reps: 8, kg: 40 })
const wo = (id, n) => ({ id, startedAt: '2026-10-22T09:00:00.000Z', sets: Array.from({ length: n }, (_, i) => setOf(i + 1)) })
const withActive = (active) => ({ ...withRoutines(routine('C')), activeWorkout: active })

test('review #1 — A→B→A after a restore: a workout discarded since the restore does not come back from a stale laptop', async () => {
  const s = await seeded()
  try {
    let rev = s.last
    const push = (state, base = rev) => (rev = putState(s.db, s.id, { baseRev: base.rev, baseId: base.revId, state }))
    push(withActive(null)) // rev 4 ← the backup: no workout
    const { file } = await backupDb(s.dataDir, 'aba')
    const laptop = push(withActive(wo('w1', 1))) // rev 5 — the laptop syncs here, clean
    const phone = push(withActive(wo('w1', 2))) // rev 6 — the phone
    s.db.close()
    await restoreInto(file, s.dataDir)
    const deps = openDataDir(s.dataDir)
    try {
      const put = (base, state) => putState(deps.db, s.id, { baseRev: base.rev, baseId: base.revId, state })
      const first = put(phone, withActive(wo('w1', 2)))
      assert.equal(first.state.activeWorkout.sets.length, 2, 'DEC-133: the phone’s workout wins the first push')
      const discarded = put(first, withActive(null))
      assert.equal(discarded.merged, false)
      assert.equal(discarded.state.activeWorkout, null, 'the phone discarded it')
      const stale = put(laptop, withActive(wo('w1', 1)))
      assert.equal(getState(deps.db, s.id).state.activeWorkout, null, 'the discarded workout does not come back')
      assert.ok(stale.conflicts.some((c) => c.field === 'activeWorkout' && c.lost?.sets?.length === 1), 'the laptop’s copy is listed')
    } finally {
      deps.db.close()
    }
  } finally {
    s.cleanup()
  }
})

test('review #8 — no marker (a restore by hand copy): the device’s workout wins, as in req-230', async () => {
  const s = await seeded()
  try {
    let rev = s.last
    const push = (state, base = rev) => (rev = putState(s.db, s.id, { baseRev: base.rev, baseId: base.revId, state }))
    push(withActive(wo('w', 1))) // rev 4 ← the backup
    const { file } = await backupDb(s.dataDir, 'hand')
    const phone = push(withActive(wo('w', 3))) // rev 5
    s.db.close()
    await restoreInto(file, s.dataDir)
    const deps = openDataDir(s.dataDir)
    try {
      deps.db.exec('DELETE FROM restores') // as a hand copy leaves it
      const out = putState(deps.db, s.id, { baseRev: phone.rev, baseId: phone.revId, state: withActive(wo('w', 3)) })
      assert.equal(out.state.activeWorkout.sets.length, 3)
      assert.ok(out.conflicts.some((c) => c.kind === 'no-base-in-progress'))
    } finally {
      deps.db.close()
    }
  } finally {
    s.cleanup()
  }
})

test('review #8 — pruning keeps the marker’s revision; a revision pruned since the marker keeps the server’s workout', async () => {
  const s = await seeded()
  try {
    const t0 = new Date('2026-10-01T10:00:00.000Z')
    const at = (h) => new Date(t0.getTime() + h * 60 * 60 * 1000)
    let rev = s.last
    const push = (state, when, base = rev) => (rev = putState(s.db, s.id, { baseRev: base.rev, baseId: base.revId, state }, when))
    const backupRev = push(withActive(null), at(0)) // rev 4 ← the backup
    const { file } = await backupDb(s.dataDir, 'prune')
    const phone = push(withActive(wo('w-phone', 2)), at(0.5)) // rev 5 — lost to the restore
    s.db.close()
    await restoreInto(file, s.dataDir, { at: at(1) })
    const deps = openDataDir(s.dataDir)
    try {
      let r = { rev: backupRev.rev, revId: getState(deps.db, s.id).revId }
      const put = (state, when, base = r) => (r = putState(deps.db, s.id, { baseRev: base.rev, baseId: base.revId, state }, when))
      put(withActive(wo('w-new', 1)), at(2)) // rev 5' — a workout since the restore…
      put(withActive(null), at(3)) // rev 6' — …discarded; newest of that day
      put({ ...withActive(null), routines: [routine('C'), routine('D')] }, at(20 * 24)) // 20 days later: prunes what it can
      const revs = listRevisions(deps.db, s.id).map((x) => x.rev)
      assert.ok(revs.includes(backupRev.rev), `the marker’s rev ${backupRev.rev} is kept: ${revs}`)
      assert.ok(!revs.includes(5), `rev 5 (after the marker) was pruned: ${revs}`)
      // The phone (base lost to the restore) pushes its workout: a change since the restore can't be
      // ruled out (rev 5 is gone), so the server's copy (no workout) stays and the phone's is listed.
      const out = putState(deps.db, s.id, { baseRev: phone.rev, baseId: phone.revId, state: withActive(wo('w-phone', 2)) })
      assert.equal(out.state.activeWorkout, null)
      assert.ok(out.conflicts.some((c) => c.field === 'activeWorkout' && c.lost?.id === 'w-phone'))
    } finally {
      deps.db.close()
    }
  } finally {
    s.cleanup()
  }
})

// Review should-fix 2 — a corrupt DB is when a restore is needed most.
test('review #2 — restore into a data dir whose DB is corrupt: its files are kept as-is, the restore goes ahead', async () => {
  const s = await seeded()
  try {
    const { file } = await backupDb(s.dataDir, 'good')
    s.db.close()
    const dbFile = join(s.dataDir, DB_FILE)
    writeFileSync(dbFile, Buffer.alloc(8192, 7))
    writeFileSync(`${dbFile}-wal`, 'junk wal')
    const r = await restoreInto(file, s.dataDir)
    assert.equal(r.before, null)
    assert.match(r.unreadable, /not a database/)
    assert.match(r.safety, /pre-restore-corrupt\.db$/)
    assert.deepEqual(readFileSync(r.safety), Buffer.alloc(8192, 7), 'the corrupt file, byte for byte')
    assert.equal(readFileSync(`${r.safety}-wal`, 'utf8'), 'junk wal')
    assert.equal(r.after.users[0].rev, 3)
    assert.ok(!existsSync(`${dbFile}-wal`) || readFileSync(`${dbFile}-wal`, 'utf8') !== 'junk wal', 'the corrupt -wal is not left beside the restored DB')
    assert.deepEqual(integrity(dbFile), ['ok'])
  } finally {
    s.cleanup()
  }
})

test('doctor parsers: the :8446 mapping, funnel state, listen addresses', () => {
  const want = 'http://127.0.0.1:8100'
  const status = {
    TCP: { 443: { HTTPS: true }, 8446: { HTTPS: true } },
    Web: {
      'mac.tail.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:4173' } } },
      'mac.tail.ts.net:8446': { Handlers: { '/': { Proxy: want } } },
    },
  }
  assert.deepEqual(serveState(JSON.stringify(status), 8446, want), { mapped: true, proxy: want, host: 'mac.tail.ts.net', funnel: [] })
  assert.equal(serveState(JSON.stringify(status), 8447, want).mapped, false)
  const funnel = { ...status, AllowFunnel: { 'mac.tail.ts.net:8446': true } }
  assert.deepEqual(serveState(JSON.stringify(funnel), 8446, want).funnel, ['mac.tail.ts.net:8446'])
  assert.deepEqual(serveState('{}', 8446, want), { mapped: false, proxy: null, host: null, funnel: [] })
  const lsof = 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nnode 1 e 20u IPv4 0x1 0t0 TCP 127.0.0.1:8100 (LISTEN)\n'
  assert.deepEqual(listenAddresses(lsof), ['127.0.0.1:8100'])
  assert.deepEqual(listenAddresses(lsof + 'node 1 e 21u IPv6 0x2 0t0 TCP *:8100 (LISTEN)\n'), ['127.0.0.1:8100', '*:8100'])
})

// req-235 — a throwaway plist in a temp dir (never ~/Library/LaunchAgents, never the live agent),
// shaped like the one ./server/start writes.
const plistFor = (dir, node, name = 'com.workout.req235-test.plist') => {
  const file = join(dir, name)
  writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n  <key>Label</key><string>x</string>\n` +
      `  <key>ProgramArguments</key>\n  <array><string>${node}</string><string>/x/server/start.mjs</string></array>\n</dict>\n</plist>\n`,
  )
  return file
}
const fakeNode = (dir, version, name = 'node') => {
  const file = join(dir, name)
  writeFileSync(file, `#!/bin/sh\necho ${version}\n`)
  chmodSync(file, 0o755)
  return file
}

test('doctor: the launchd plist’s node — missing, not executable, below the floor, ok, nvm note', () => {
  const dir = tempDir('workout-plist-test-')
  const [major, minor] = NODE_FLOOR
  try {
    assert.equal(plistNode(readFileSync(plistFor(dir, '/a &amp; b/node'), 'utf8')), '/a & b/node')
    assert.equal(plistNode('<plist/>'), null)

    const gone = join(dir, 'v26.8.2', 'bin', 'node')
    const missing = launchdNode(plistFor(dir, gone))
    assert.equal(missing.ok, false)
    assert.equal(missing.text, `launchd node: ${gone} — MISSING`)

    const old = launchdNode(plistFor(dir, fakeNode(dir, `v${major}.${minor - 1}.1`)))
    assert.equal(old.ok, false)
    assert.match(old.text, new RegExp(`node — v${major}\\.${minor - 1}\\.1, below the floor ${NODE_FLOOR.join('\\.')}$`))

    const noexec = fakeNode(dir, `v${major}.${minor}.0`, 'noexec')
    chmodSync(noexec, 0o644)
    assert.equal(launchdNode(plistFor(dir, noexec)).text, `launchd node: ${noexec} — not executable`)

    const ok = launchdNode(plistFor(dir, process.execPath))
    assert.equal(ok.ok, true, ok.text)
    assert.match(ok.text, new RegExp(`v${process.versions.node.replaceAll('.', '\\.')}`))

    assert.equal(launchdNode(join(dir, 'none.plist')).ok, false)

    // An nvm path gets the note, failing or not; the home is the test's, not ~.
    const home = join(dir, 'home')
    const nvmNode = join(home, '.nvm', 'versions', 'node', 'v26.8.2', 'bin', 'node')
    const nvm = launchdNode(plistFor(dir, nvmNode), home)
    assert.equal(nvm.ok, false)
    assert.match(nvm.note, /nvm node — if that version is uninstalled, re-run server\/start$/)
    assert.equal(missing.note, null)
    assert.equal(launchdNode(plistFor(dir, process.execPath), home).note, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// The CLI end to end, on a throwaway label + agents dir: the doctor FAILs naming the path.
test('doctor CLI: a throwaway plist whose node is missing → FAIL naming the path', { skip: process.platform !== 'darwin' && 'launchd checks are macOS-only' }, () => {
  const dir = tempDir('workout-plist-test-')
  try {
    const label = 'com.workout.req235-test'
    const gone = join(dir, 'gone', 'node')
    plistFor(dir, gone, `${label}.plist`)
    const r = spawnSync(process.execPath, [fileURLToPath(new URL('./ops-cli.mjs', import.meta.url)), 'doctor'], {
      encoding: 'utf8',
      env: { ...process.env, WORKOUT_LABEL: label, WORKOUT_AGENTS_DIR: dir, WORKOUT_DATA_DIR: join(dir, 'data'), WORKOUT_PORT: '1', WORKOUT_LIVE_DIR: join(dir, 'live') },
    })
    assert.equal(r.status, 1)
    assert.match(r.stdout, new RegExp(`^FAIL  launchd node: ${gone.replaceAll('.', '\\.')} — MISSING$`, 'm'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// The latent check from req-229's review: every `tailscale serve` port on this Mac is one host to
// the browser, so another service there can set (and receives) a cookie with our name.
test('cookie isolation — __Host- name, every value read, a planted one can’t displace ours', async () => {
  const srv = await startTestServer()
  try {
    await bootstrapUser(srv.db, { username: 'emilio', password: PASSWORD })
    const res = await fetch(`${srv.base}/api/login`, {
      method: 'POST',
      headers: { 'x-workout-request': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'emilio', password: PASSWORD }),
    })
    const set = res.headers.get('set-cookie')
    assert.equal(COOKIE, '__Host-workout_session')
    assert.ok(set.startsWith(`${COOKIE}=`))
    // What a browser requires before it stores a __Host- cookie.
    assert.match(set, /; Secure(;|$)/)
    assert.match(set, /; Path=\/(;|$)/)
    assert.doesNotMatch(set, /domain=/i)
    const token = set.split(';')[0].slice(COOKIE.length + 1)
    const me = (cookie) => fetch(`${srv.base}/api/me`, { headers: { cookie } }).then((r) => r.status)
    assert.equal(await me(`${COOKIE}=${token}`), 200)
    // Another service's cookie of our name, sent first (a more specific path sorts first).
    assert.equal(await me(`${COOKIE}=planted; ${COOKIE}=${token}`), 200)
    assert.equal(await me(`${COOKIE}=${token}; ${COOKIE}=planted`), 200)
    // The old, un-prefixed name (any service on the host can set it) is not ours any more.
    assert.equal(await me(`workout_session=${token}`), 401)
    // Logout ends the real session even when a planted value comes first.
    const out = await fetch(`${srv.base}/api/logout`, {
      method: 'POST',
      headers: { 'x-workout-request': '1', 'content-type': 'application/json', cookie: `${COOKIE}=planted; ${COOKIE}=${token}` },
    })
    assert.equal(out.status, 200)
    assert.equal(await me(`${COOKIE}=${token}`), 401)
  } finally {
    await srv.close()
  }
})

// Keeps the helpers above honest about where they write.
test('the ops functions refuse the live data path under the test suite', async () => {
  await assert.rejects(backupDb(join(process.env.HOME, 'dev', 'workout', 'workout-data'), 'x'), /live data path/)
  const dir = tempDir('workout-ops-mtime-')
  try {
    mkdirSync(join(dir, 'backups'))
    const f = join(dir, 'backups', 'workout-20261001-010000-nightly.db')
    writeFileSync(f, '')
    utimesSync(f, new Date(Date.now() - 2 * DAY), new Date(Date.now() - 2 * DAY))
    assert.equal(listBackups(dir)[0].reason, 'nightly')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
