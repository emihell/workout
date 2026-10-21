// req-229 — the API end to end on a throwaway server (temp DB, free port). Acceptance criteria
// 1–8 are numbered in the test names.
import { client, startTestServer } from './test-helpers.mjs'
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyBackup, buildBackup } from '../src/exchange.js'
import { emptyState } from '../src/persistence.js'
import { bootstrapUser, createInvite } from './auth.mjs'

const dbJson = JSON.parse(readFileSync(new URL('../src/db.json', import.meta.url), 'utf8'))
const PASSWORD = 'correct horse battery'

let srv
before(async () => {
  srv = await startTestServer()
  await bootstrapUser(srv.db, { username: 'emilio', password: PASSWORD })
})
after(() => srv.close())

async function loggedIn(username = 'emilio', password = PASSWORD) {
  const c = client(srv.base)
  const res = await c.post('/api/login', { username, password })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return c
}

// A fresh account through an invite (keeps each test's data its own).
let n = 0
async function newUser() {
  const c = client(srv.base)
  const username = `user${++n}`
  const res = await c.post('/api/register', { code: createInvite(srv.db, srv.secret), username, password: PASSWORD })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return c
}

const count = (sql, ...args) => srv.db.prepare(sql).get(...args).n

test('1. bootstrap → login → GET /api/state on a new user is {rev:0, state: emptyState}', async () => {
  const c = await loggedIn()
  const res = await c.get('/api/state')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { rev: 0, state: emptyState() })
})

test('1. login cookie is HttpOnly; Secure; SameSite=Strict, and the session is stored hashed', async () => {
  const c = client(srv.base)
  const res = await c.post('/api/login', { username: 'emilio', password: PASSWORD })
  const setCookie = res.headers.get('set-cookie')
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /Secure/)
  assert.match(setCookie, /SameSite=Strict/)
  const token = c.cookie.split('=')[1]
  assert.equal(count('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?', token), 0)
  assert.ok(count('SELECT COUNT(*) AS n FROM sessions') >= 1)
})

test('1. wrong password and unknown user → the same 401, nothing else revealed', async () => {
  const c = client(srv.base)
  const wrong = await c.post('/api/login', { username: 'emilio', password: 'not the password' })
  const unknown = await c.post('/api/login', { username: 'nobody', password: 'not the password' })
  assert.equal(wrong.status, 401)
  assert.equal(unknown.status, 401)
  assert.deepEqual(wrong.body, { error: 'Wrong username or password.' })
  assert.deepEqual(unknown.body, wrong.body)
  assert.equal(wrong.headers.get('set-cookie'), null)
  assert.equal((await c.get('/api/state')).status, 401)
})

test('1. logout deletes the session', async () => {
  const c = await loggedIn()
  const old = c.cookie
  assert.equal((await c.post('/api/logout', {})).status, 200)
  assert.equal(c.cookie, null)
  c.cookie = old
  assert.equal((await c.get('/api/state')).status, 401)
})

test('2. PUT an Export of src/db.json → rev 1; GET returns it deep-equal after applyBackup', async () => {
  const c = await newUser()
  const backup = buildBackup(dbJson)
  const put = await c.put('/api/state', { baseRev: 0, state: backup.state })
  assert.equal(put.status, 200, JSON.stringify(put.body))
  assert.equal(put.body.rev, 1)
  const got = await c.get('/api/state')
  assert.equal(got.body.rev, 1)
  assert.deepEqual(got.body.state, applyBackup(backup).state)
  // The Export endpoint hands back the same file shape the app exports.
  const exp = await c.get('/api/export')
  assert.equal(exp.body.kind, 'workout-mvp-backup')
  assert.equal(exp.body.version, 1)
  assert.deepEqual(exp.body.state, got.body.state)
  assert.match(exp.headers.get('content-disposition'), /attachment; filename="workout-database-\d{4}-\d{2}-\d{2}\.json"/)
  assert.deepEqual(applyBackup(exp.body).state, got.body.state)
})

test('3. failure — a bad file → 400 with applyBackup’s message; rev unchanged; nothing stored', async () => {
  const c = await newUser()
  await c.put('/api/state', { baseRev: 0, state: buildBackup(dbJson).state })
  const before = count('SELECT COUNT(*) AS n FROM revisions')
  let expected
  try {
    applyBackup({ kind: 'workout-mvp-backup', version: 1, state: { workouts: 'x' } })
  } catch (error) {
    expected = error.message
  }
  const res = await c.put('/api/state', { baseRev: 1, state: { workouts: 'x' } })
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { error: expected })
  assert.equal(expected, 'Not a workout database backup.')
  assert.equal(count('SELECT COUNT(*) AS n FROM revisions'), before)
  assert.equal((await c.get('/api/state')).body.rev, 1)
})

test('3. a baseRev ahead of the server → 409, nothing stored', async () => {
  const c = await newUser()
  const res = await c.put('/api/state', { baseRev: 5, state: buildBackup(dbJson).state })
  assert.equal(res.status, 409)
  assert.equal((await c.get('/api/state')).body.rev, 0)
})

// Two devices of one user, both starting from rev 1.
async function twoDevices() {
  const a = await newUser()
  const put = await a.put('/api/state', { baseRev: 0, state: buildBackup(dbJson).state })
  const rev1 = put.body.state
  const b = client(srv.base)
  b.cookie = a.cookie // same account, a second device (shares the session for brevity)
  return { a, b, rev1 }
}

test('4. merge — A edits routine R, B (base 1) finishes workout W → the final state has both', async () => {
  const { a, b, rev1 } = await twoDevices()
  const stateA = structuredClone(rev1)
  stateA.routines[0].name = 'Edited on A'
  const stateB = structuredClone(rev1)
  const W = { ...structuredClone(rev1.workouts[0]), id: 'w-finished-on-b', performedOn: '2026-10-21' }
  stateB.workouts.push(W)

  const putA = await a.put('/api/state', { baseRev: 1, state: stateA })
  assert.equal(putA.body.rev, 2)
  assert.equal(putA.body.merged, false)
  const putB = await b.put('/api/state', { baseRev: 1, state: stateB })
  assert.equal(putB.status, 200)
  assert.equal(putB.body.rev, 3)
  assert.equal(putB.body.merged, true)
  assert.deepEqual(putB.body.conflicts, [])

  const final = (await a.get('/api/state')).body
  assert.equal(final.rev, 3)
  assert.equal(final.state.routines[0].name, 'Edited on A')
  assert.ok(final.state.workouts.some((w) => w.id === 'w-finished-on-b'))
  assert.equal(final.state.workouts.length, rev1.workouts.length + 1)
})

test('4. merge — both edit routine R → B (newest) wins; A’s version is in conflicts and still readable', async () => {
  const { a, b, rev1 } = await twoDevices()
  const stateA = structuredClone(rev1)
  stateA.routines[0].name = 'A’s name'
  const stateB = structuredClone(rev1)
  stateB.routines[0].name = 'B’s name'
  await a.put('/api/state', { baseRev: 1, state: stateA })
  const putB = await b.put('/api/state', { baseRev: 1, state: stateB })
  assert.equal(putB.body.rev, 3)
  assert.equal(putB.body.state.routines[0].name, 'B’s name')
  assert.equal(putB.body.conflicts.length, 1)
  const [conflict] = putB.body.conflicts
  assert.equal(conflict.field, 'routines')
  assert.equal(conflict.id, rev1.routines[0].id)
  assert.equal(conflict.kind, 'edited-on-both')
  assert.equal(conflict.lost.name, 'A’s name')

  // Still readable from storage: the merged revision carries it, and A's own revision is kept whole.
  const rev3 = (await a.get('/api/revisions/3')).body
  assert.equal(rev3.conflicts[0].lost.name, 'A’s name')
  const rev2 = (await a.get('/api/revisions/2')).body
  assert.equal(rev2.state.routines[0].name, 'A’s name')
  const list = (await a.get('/api/revisions')).body
  assert.deepEqual(
    list.map(({ rev, baseRev, merged, conflicts }) => ({ rev, baseRev, merged, conflicts })),
    [
      { rev: 1, baseRev: 0, merged: false, conflicts: 0 },
      { rev: 2, baseRev: 1, merged: false, conflicts: 0 },
      { rev: 3, baseRev: 1, merged: true, conflicts: 1 },
    ],
  )
})

const X = { id: 'ex-test-x', name: 'Test X', equipment: '', muscles: '', cues: '', type: 'machine', weightStep: '2.5', archivedAt: null }

async function devicesWithX() {
  const a = await newUser()
  const state0 = buildBackup(dbJson).state
  state0.exercises.push(structuredClone(X))
  const rev1 = (await a.put('/api/state', { baseRev: 0, state: state0 })).body.state
  assert.ok(rev1.exercises.some((e) => e.id === X.id))
  const b = client(srv.base)
  b.cookie = a.cookie
  return { a, b, rev1 }
}

test('5. delete vs untouched — A deletes exercise X, B leaves it → gone after B’s sync', async () => {
  const { a, b, rev1 } = await devicesWithX()
  const stateA = structuredClone(rev1)
  stateA.exercises = stateA.exercises.filter((e) => e.id !== X.id)
  await a.put('/api/state', { baseRev: 1, state: stateA })
  const stateB = structuredClone(rev1)
  stateB.routines[1].name = 'B touched something else'
  const putB = await b.put('/api/state', { baseRev: 1, state: stateB })
  assert.equal(putB.body.merged, true)
  assert.deepEqual(putB.body.conflicts, [])
  const final = (await b.get('/api/state')).body.state
  assert.equal(final.exercises.some((e) => e.id === X.id), false)
  assert.equal(final.routines[1].name, 'B touched something else')
})

test('5. delete vs edit — A deletes X, B edits X → B’s edit wins, A’s deletion listed as a conflict', async () => {
  const { a, b, rev1 } = await devicesWithX()
  const stateA = structuredClone(rev1)
  stateA.exercises = stateA.exercises.filter((e) => e.id !== X.id)
  await a.put('/api/state', { baseRev: 1, state: stateA })
  const stateB = structuredClone(rev1)
  stateB.exercises.find((e) => e.id === X.id).name = 'X edited on B'
  const putB = await b.put('/api/state', { baseRev: 1, state: stateB })
  assert.equal(putB.body.state.exercises.find((e) => e.id === X.id).name, 'X edited on B')
  assert.deepEqual(putB.body.conflicts, [{ field: 'exercises', id: X.id, kind: 'edited-vs-deleted', lost: null }])
})

test('re-sending the current state stores nothing new (unchanged)', async () => {
  const { a, rev1 } = await twoDevices()
  const res = await a.put('/api/state', { baseRev: 1, state: rev1 })
  assert.equal(res.body.rev, 1)
  assert.equal(res.body.unchanged, true)
  assert.equal((await a.get('/api/revisions')).body.length, 1)
})

test('6. isolation — user 2 can’t read or write user 1’s state, revisions or notes', async () => {
  const one = await newUser()
  await one.put('/api/state', { baseRev: 0, state: buildBackup(dbJson).state })
  await one.post('/api/notes', { route: '#/', timestamp: '2026-10-21T10:00:00Z', text: 'user one note', context: {} })
  const two = await newUser()

  // Every read of user 2 sees only user 2's (empty) data.
  assert.deepEqual((await two.get('/api/state')).body, { rev: 0, state: emptyState() })
  assert.deepEqual((await two.get('/api/revisions')).body, [])
  assert.equal((await two.get('/api/revisions/1')).status, 404)
  assert.deepEqual((await two.get('/api/notes')).body, [])
  assert.equal((await two.get('/api/export')).body.state.workouts.length, 0)

  // User 2's writes land on user 2 only.
  const before = (await one.get('/api/state')).body
  const twoState = structuredClone(before.state)
  twoState.routines = []
  assert.equal((await two.put('/api/state', { baseRev: 0, state: twoState })).body.rev, 1)
  await two.post('/api/notes', { route: '#/', timestamp: '2026-10-21T10:00:00Z', text: 'user two note', context: {} })
  assert.deepEqual((await one.get('/api/state')).body, before)
  assert.deepEqual(
    (await one.get('/api/notes')).body.map((note) => note.text),
    ['user one note'],
  )
  assert.equal((await one.get('/api/revisions')).body.length, 1)

  // No session at all → 401 on every per-user endpoint.
  const anon = client(srv.base)
  for (const path of ['/api/me', '/api/state', '/api/revisions', '/api/revisions/1', '/api/notes', '/api/export']) {
    assert.equal((await anon.get(path)).status, 401, path)
  }
})

test('7. failure — no session / bad CSRF header: every write → 401/403, nothing stored', async () => {
  const owner = await newUser()
  const writes = [
    ['PUT', '/api/state', { baseRev: 0, state: buildBackup(dbJson).state }],
    ['POST', '/api/notes', { route: '#/', timestamp: '2026-10-21T11:00:00Z', text: 'sneaky', context: {} }],
  ]
  const snapshot = () => [
    count('SELECT COUNT(*) AS n FROM revisions'),
    count('SELECT COUNT(*) AS n FROM notes'),
    count('SELECT COUNT(*) AS n FROM sessions'),
    count('SELECT COUNT(*) AS n FROM users'),
  ]
  const before = snapshot()

  const anon = client(srv.base)
  for (const [method, path, body] of writes) assert.equal((await anon.call(method, path, body)).status, 401, path)

  const noHeader = client(srv.base, { csrf: false })
  noHeader.cookie = owner.cookie
  for (const [method, path, body] of writes) assert.equal((await noHeader.call(method, path, body)).status, 403, path)
  // Login / register / logout are writes too: no header → 403 (no login CSRF).
  assert.equal((await noHeader.post('/api/login', { username: 'emilio', password: PASSWORD })).status, 403)
  assert.equal((await noHeader.post('/api/logout', {})).status, 403)
  const code = createInvite(srv.db, srv.secret)
  assert.equal((await noHeader.post('/api/register', { code, username: 'csrfuser', password: PASSWORD })).status, 403)

  // The header present but from another site → 403.
  const crossSite = client(srv.base)
  crossSite.cookie = owner.cookie
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }, { origin: 'null' }]) {
    for (const [method, path, body] of writes) {
      assert.equal((await crossSite.call(method, path, body, headers)).status, 403, `${path} ${JSON.stringify(headers)}`)
    }
  }
  // Not JSON → 415 (a form post can't carry the header anyway).
  assert.equal((await crossSite.call('POST', '/api/notes', undefined, { 'content-type': 'text/plain' })).status, 415)

  assert.deepEqual(snapshot(), before)
  // Same-origin with the header still works (the guard isn't blocking everything).
  const own = await owner.post('/api/notes', writes[1][2], { origin: srv.base, 'sec-fetch-site': 'same-origin' })
  assert.equal(own.status, 200)
})

test('8. notes — post 3, re-post one → 3 stored; GET returns them in order', async () => {
  const c = await newUser()
  const notes = [1, 2, 3].map((i) => ({
    route: `#/r${i}`,
    timestamp: `2026-10-21T10:0${i}:00.000Z`,
    text: `note ${i}`,
    context: { routeName: `r${i}` },
  }))
  for (const note of notes) assert.equal((await c.post('/api/notes', note)).body.added, 1)
  const again = await c.post('/api/notes', notes[1])
  assert.deepEqual(again.body, { added: 0, total: 3 })
  assert.deepEqual((await c.get('/api/notes')).body, notes)
  // A whole list re-sent (what a device will do) adds nothing either.
  assert.deepEqual((await c.post('/api/notes', { notes })).body, { added: 0, total: 3 })
  assert.equal((await c.post('/api/notes', { route: '#/', timestamp: 't', text: '  ' })).status, 400)
})

test('register — an invite works once; a bad or used code and a taken name are refused', async () => {
  const code = createInvite(srv.db, srv.secret)
  const first = await client(srv.base).post('/api/register', { code, username: 'once', password: PASSWORD })
  assert.equal(first.status, 201)
  const reuse = await client(srv.base).post('/api/register', { code, username: 'twice', password: PASSWORD })
  assert.equal(reuse.status, 403)
  const bogus = await client(srv.base).post('/api/register', { code: 'nope', username: 'bogus', password: PASSWORD })
  assert.equal(bogus.status, 403)
  const taken = await client(srv.base).post('/api/register', {
    code: createInvite(srv.db, srv.secret),
    username: 'emilio',
    password: PASSWORD,
  })
  assert.equal(taken.status, 409)
  const short = await client(srv.base).post('/api/register', {
    code: createInvite(srv.db, srv.secret),
    username: 'shorty',
    password: 'short',
  })
  assert.equal(short.status, 400)
  assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE username IN (?, ?, ?)', 'twice', 'bogus', 'shorty'), 0)
})

test('health — {ok, revisions} with no auth and no auth details', async () => {
  const res = await client(srv.base).get('/api/health')
  assert.equal(res.status, 200)
  assert.deepEqual(Object.keys(res.body).sort(), ['ok', 'revisions'])
  assert.equal(res.body.ok, true)
  assert.equal(res.body.revisions, count('SELECT COUNT(*) AS n FROM revisions'))
})

test('unknown route → 404; wrong method → 405', async () => {
  const c = client(srv.base)
  assert.equal((await c.get('/api/nothing')).status, 404)
  assert.equal((await c.call('DELETE', '/api/state')).status, 405)
})
