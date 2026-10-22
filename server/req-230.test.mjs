// req-230 — the server changes that came with the app's sync: the password rule (DEC-132 §4),
// the built app served on the same origin, the same-origin guard behind `tailscale serve`, and
// revision pruning. Temp dirs and port 0 only (BACKEND rules 2 and 8).
import { client, startTestServer, tempDir } from './test-helpers.mjs'
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fullState } from '../src/test-support/full-state.js'
import { PASSWORD_MIN, bootstrapUser, createInvite, findUser } from './auth.mjs'
import { serverConfig, REPO_ROOT } from './config.mjs'
import { PRUNE_DAYS, getState, getStateFor, listRevisions, putState } from './store.mjs'

const PASSWORD = 'sixsix'
let srv
let appDir
before(async () => {
  appDir = tempDir('workout-app-test-')
  mkdirSync(join(appDir, 'assets'))
  writeFileSync(join(appDir, 'index.html'), '<!doctype html><title>app</title>')
  writeFileSync(join(appDir, 'sw.js'), 'self.x = 1')
  writeFileSync(join(appDir, 'assets', 'index-abc.js'), 'console.log(1)')
  srv = await startTestServer({ appDir })
  await bootstrapUser(srv.db, { username: 'emilio', password: PASSWORD })
})
after(async () => {
  await srv.close()
  rmSync(appDir, { recursive: true, force: true })
})

test('DEC-132 §4 — a password of 6 characters is accepted, 5 is refused', async () => {
  assert.equal(PASSWORD_MIN, 6)
  const ok = await client(srv.base).post('/api/register', { code: createInvite(srv.db, srv.secret), username: 'six', password: '123456' })
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  const short = await client(srv.base).post('/api/register', { code: createInvite(srv.db, srv.secret), username: 'five', password: '12345' })
  assert.equal(short.status, 400)
  assert.equal(short.body.error, 'Password: at least 6 characters.')
  assert.equal(findUser(srv.db, 'five'), undefined)
})

test('the server serves the built app on its own origin: /, sw.js and hashed assets, with the right caching', async () => {
  const root = await fetch(`${srv.base}/`)
  assert.equal(root.status, 200)
  assert.match(root.headers.get('content-type'), /^text\/html/)
  assert.equal(root.headers.get('cache-control'), 'no-cache')
  assert.equal(await root.text(), '<!doctype html><title>app</title>')
  const sw = await fetch(`${srv.base}/sw.js`)
  assert.equal(sw.headers.get('cache-control'), 'no-cache', 'a new version is always seen')
  assert.match(sw.headers.get('content-type'), /^text\/javascript/)
  const asset = await fetch(`${srv.base}/assets/index-abc.js`)
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const head = await fetch(`${srv.base}/`, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})

test('…never a file outside the app folder, and the API is unchanged', async () => {
  for (const path of ['/../package.json', '/%2e%2e/package.json', '/assets/%2e%2e/%2e%2e/server/app.mjs', '/nope.js', '/%00', '/%E0%A4%A']) {
    const res = await fetch(`${srv.base}${path}`)
    assert.equal(res.status, 404, path)
  }
  assert.equal((await fetch(`${srv.base}/api/state`)).status, 401, 'data still needs a session')
  assert.equal((await fetch(`${srv.base}/api/nope`)).status, 404)
})

test('no app folder (not built) → 404 for the app, the API still works', async () => {
  const bare = await startTestServer()
  try {
    assert.equal((await fetch(`${bare.base}/`)).status, 404)
    assert.equal((await fetch(`${bare.base}/api/health`)).status, 200)
  } finally {
    await bare.close()
  }
})

test('config — WORKOUT_APP_DIR, default <repo>/dist-server', () => {
  assert.equal(serverConfig({ WORKOUT_DATA_DIR: '/tmp/x' }).appDir, join(REPO_ROOT, 'dist-server'))
  assert.equal(serverConfig({ WORKOUT_DATA_DIR: '/tmp/x', WORKOUT_APP_DIR: '/tmp/app' }).appDir, '/tmp/app')
})

test('same-origin guard behind `tailscale serve`: Host is the backend, X-Forwarded-Host + Origin are the tailnet name', async () => {
  const c = client(srv.base)
  assert.equal((await c.post('/api/login', { username: 'emilio', password: PASSWORD })).status, 200)
  const proxied = {
    host: '127.0.0.1:8100',
    'x-forwarded-host': 'mac.tailnet.ts.net:8446',
    origin: 'https://mac.tailnet.ts.net:8446',
    'sec-fetch-site': 'same-origin',
  }
  const ok = await c.put('/api/state', { baseRev: 0, state: fullState() }, proxied)
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  const elsewhere = await c.put('/api/state', { baseRev: 1, state: fullState() }, { ...proxied, origin: 'https://evil.example' })
  assert.equal(elsewhere.status, 403)
})

const DAY = 24 * 60 * 60 * 1000
const named = (name) => {
  const state = fullState()
  state.routines[0].name = name
  return state
}

test(`revision growth — revisions older than ${PRUNE_DAYS} days are pruned to one per day; conflicts and recent ones kept`, async () => {
  const res = await client(srv.base).post('/api/register', { code: createInvite(srv.db, srv.secret), username: 'pruned', password: PASSWORD })
  assert.equal(res.status, 201)
  const id = findUser(srv.db, 'pruned').id
  const now = new Date('2026-10-22T12:00:00.000Z')
  const at = (daysAgo, hour) => new Date(now.getTime() - daysAgo * DAY + hour * 60 * 60 * 1000)
  let rev = 0
  const push = (name, when, baseRev = rev) => {
    const out = putState(srv.db, id, { baseRev, state: named(name) }, when)
    rev = out.rev
    return out
  }
  push('a1', at(40, 0)) // 1
  push('a2', at(40, 1)) // 2
  push('a3', at(40, 2)) // 3  ← newest of that day
  push('b1', at(20, 0)) // 4
  const conflicted = push('b2-conflict', at(20, 1), 3) // 5: from base 3, both edited → conflict
  assert.equal(conflicted.conflicts.length, 1)
  push('b3', at(20, 2)) // 6  ← newest of that day
  push('c1', at(3, 0)) // 7  recent
  push('c2', at(3, 1)) // 8  recent
  push('d1', now) // 9  current; prunes
  assert.deepEqual(
    listRevisions(srv.db, id).map((r) => r.rev),
    [3, 5, 6, 7, 8, 9],
  )
  assert.equal(getState(srv.db, id).state.routines[0].name, 'd1', 'the current document is untouched')
})

test('a device whose base revision was pruned still syncs: merged without a base, every undecidable record listed', async () => {
  const id = findUser(srv.db, 'pruned').id
  // Rev 4 was pruned; a device still based on it renames the routine → stored, nothing lost.
  const out = putState(srv.db, id, { baseRev: 4, state: named('from an old device') }, new Date('2026-10-22T13:00:00.000Z'))
  assert.equal(out.rev, 10)
  // Review round 2: with no base, a differing record keeps the SERVER's value; the device's is listed.
  assert.equal(out.state.routines[0].name, 'd1')
  assert.equal(out.conflicts.length, 1, 'the device’s version is kept as the losing one')
  assert.equal(out.conflicts[0].kind, 'no-base-differs')
  assert.equal(out.conflicts[0].lost.name, 'from an old device')
})

// Review round 1 (#3) — the reviewer's case: with the base gone, falling back to an older base
// brought the other device's deletion back and undid this device's own deletion, with conflicts 0.
test('review #3 — a pruned base never drops or brings back a record without listing it', async () => {
  const res = await client(srv.base).post('/api/register', { code: createInvite(srv.db, srv.secret), username: 'nobase', password: PASSWORD })
  assert.equal(res.status, 201)
  const id = findUser(srv.db, 'nobase').id
  const routine = (rid, name) => ({ id: rid, name, focus: 'Machines', archivedAt: null, exercises: [] })
  const withRoutines = (...routines) => ({ ...fullState(), routines })
  let rev = 0
  const push = (state, baseRev = rev) => {
    const out = putState(srv.db, id, { baseRev, state })
    rev = out.rev
    return out
  }
  push(withRoutines(routine('A', 'a'), routine('B', 'b'), routine('C', 'c'))) // 1
  push(withRoutines(routine('A', 'a'), routine('B', 'b'), routine('C', 'c'), routine('D', 'd'))) // 2 ← stale device's base
  push(withRoutines(routine('B', 'b'), routine('C', 'c'), routine('D', 'd'))) // 3: other device deleted A
  push(withRoutines(routine('B', 'b on server'), routine('C', 'c'), routine('D', 'd'))) // 4: and edited B
  srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev = 2').run(id) // pruned
  // The stale device (base 2): deleted D, edited C.
  const out = putState(srv.db, id, { baseRev: 2, state: withRoutines(routine('A', 'a'), routine('B', 'b'), routine('C', 'c edited')) })
  const listed = new Map(out.conflicts.filter((c) => c.field === 'routines').map((c) => [c.id, c]))
  const names = Object.fromEntries(out.state.routines.map((r) => [r.id, r.name]))
  // A: on one side only (deleted on the server, or added here?) → kept and listed.
  assert.equal(names.A, 'a')
  assert.equal(listed.get('A')?.kind, 'no-base-one-side')
  // D: on one side only (this device's deletion, or the server's addition?) → kept and listed.
  assert.equal(names.D, 'd')
  assert.equal(listed.get('D')?.kind, 'no-base-one-side')
  // B and C differ → the server's version (review round 2), this device's listed as lost.
  assert.equal(names.B, 'b on server')
  assert.equal(listed.get('B')?.lost?.name, 'b')
  assert.equal(names.C, 'c')
  assert.equal(listed.get('C')?.lost?.name, 'c edited')
  // Every routine that either side had is in the result: nothing dropped.
  assert.deepEqual(Object.keys(names).sort(), ['A', 'B', 'C', 'D'])
})

// Review round 2 (#1) — rev ids: a reused rev number is told apart from the one a device holds.
test('round 2 — GET says whether a base is still this history; a PUT on a reused rev number merges without a base', async () => {
  const res = await client(srv.base).post('/api/register', { code: createInvite(srv.db, srv.secret), username: 'epoch', password: PASSWORD })
  assert.equal(res.status, 201)
  const id = findUser(srv.db, 'epoch').id
  const routine = (rid) => ({ id: rid, name: rid, focus: 'Machines', archivedAt: null, exercises: [] })
  const one = putState(srv.db, id, { baseRev: 0, state: { ...fullState(), routines: [routine('A')] } })
  const two = putState(srv.db, id, { baseRev: 1, baseId: one.revId, state: { ...fullState(), routines: [routine('A'), routine('B')] } })
  assert.equal(two.merged, false, 'a known base at the current rev is a fast-forward')
  assert.equal(typeof two.revId, 'string')
  const q = (rev, revId) => new URLSearchParams({ baseRev: String(rev), baseId: revId })
  assert.equal(getStateFor(srv.db, id, q(2, two.revId)).baseOk, true)
  srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev = 2').run(id) // restore → rev 1
  const reused = putState(srv.db, id, { baseRev: 1, baseId: one.revId, state: { ...fullState(), routines: [routine('A'), routine('C')] } })
  assert.equal(reused.rev, 2)
  assert.notEqual(reused.revId, two.revId, 'the same number, a different revision')
  assert.equal(getStateFor(srv.db, id, q(2, two.revId)).baseOk, false)
  // The device still holding the old rev 2 pushes: not a fast-forward.
  const stale = putState(srv.db, id, { baseRev: 2, baseId: two.revId, state: { ...fullState(), routines: [routine('A'), routine('B')] } })
  assert.equal(stale.merged, true)
  assert.deepEqual(stale.state.routines.map((r) => r.id).sort(), ['A', 'B', 'C'], 'C (only on the server) is not erased')
  assert.ok(stale.conflicts.some((c) => c.id === 'C' && c.kind === 'no-base-one-side'))
  assert.ok(stale.conflicts.some((c) => c.id === 'B' && c.kind === 'no-base-one-side'))
  // A base AHEAD of the server with an id (a restore removed it): merged too, not a 409.
  const ahead = putState(srv.db, id, { baseRev: 9, baseId: 'gone', state: { ...fullState(), routines: [routine('A')] } })
  assert.equal(ahead.merged, true)
  // Without a baseId (an older app), behaviour as before.
  assert.throws(() => putState(srv.db, id, { baseRev: 99, state: fullState() }), /ahead of the server/)
})
