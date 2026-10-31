// req-230 — the sync engine end to end against a THROWAWAY req-229 server (temp DB, free port;
// BACKEND rules 2 and 8 — test-helpers turns the live-path guard on before anything opens).
// Each "device" has its own storage, its own cookie and its own timers, and changes its state
// the way the store does (a reducer, then saveState → the save listener). Acceptance criteria
// are numbered in the test names.
import { startTestServer } from '../../server/test-helpers.mjs'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createInvite, registerUser, findUser } from '../../server/auth.mjs'
import { dropRevisions, getRevision, getState, listRevisions, getNotes } from '../../server/store.mjs'
import { MAX_BODY } from '../../server/app.mjs'
import { buildBackup, commitBackup } from '../exchange.js'
import { emptyState } from '../persistence.js'
import { setLoggedState } from '../state-reducers.js'
import { finishedState } from '../workout-log.js'
import { fullState } from '../test-support/full-state.js'
import { DEBOUNCE_MS, LOGIN_UNREADABLE, MAX_BYTES, META_KEY, RETRY_MS, createSync } from './engine.js'
import { NOT_SYNCED, syncLine } from './status.js'

const KEY = 'workout-mvp-v9'
const PASSWORD = 'sixsix'

let srv
before(async () => {
  srv = await startTestServer()
})
after(() => srv.close())

let n = 0
async function newAccount() {
  const username = `u${++n}`
  await registerUser(srv.db, srv.secret, { code: createInvite(srv.db, srv.secret), username, password: PASSWORD })
  return username
}
const userId = (username) => findUser(srv.db, username).id
const server = (username) => getState(srv.db, userId(username))
// Review round 4 (#2): prune one revision the way pruneRevisions does (its id recorded), not a raw DELETE.
const prune = (username, rev) => dropRevisions(srv.db, userId(username), [rev])

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

function fakeTimers() {
  let id = 0
  const queue = new Map()
  return {
    setTimer: (fn, ms) => (queue.set(++id, { fn, ms }), id),
    clearTimer: (i) => queue.delete(i),
    delays: () => [...queue.values()].map((t) => t.ms),
    fire() {
      const due = [...queue.values()]
      queue.clear()
      for (const t of due) t.fn()
    },
  }
}

// A browser-ish fetch for one device: its own cookie jar; `offline` makes it reject like a
// dropped connection; `hold` parks PUT responses until released; every call is logged.
function deviceFetch() {
  let cookie = null
  const f = async (path, init = {}) => {
    const entry = { method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined }
    f.log.push(entry)
    if (f.offline) throw new TypeError('fetch failed')
    if (f.respond) {
      const fake = f.respond(entry)
      if (fake) return fake
    }
    const headers = { ...init.headers }
    if (cookie) headers.cookie = cookie
    const res = await fetch(srv.base + path, { method: init.method, headers, body: init.body })
    const set = res.headers.get('set-cookie')
    if (set) {
      const value = set.split(';')[0]
      cookie = value.endsWith('=') ? null : value
    }
    if (f.hold && init.method === 'PUT') await f.hold
    return res
  }
  f.log = []
  f.offline = false
  f.hold = null
  f.respond = null
  f.dropCookie = () => (cookie = null)
  return f
}

// Review round 1: `storage` / `fetch` can be shared (a reload of the same browser, a second tab);
// `failSaves` makes the state write fail like a full storage (the listener hears `saved: false`);
// `adopt: 'async'` applies the store update later, as React does; `adopt: 'never'` never applies
// it (the tab closed first).
function device(state = fullState(), { storage = null, fetch: sharedFetch = null, adopt = 'sync' } = {}) {
  const shared = storage !== null
  storage ??= memoryStorage()
  const timers = fakeTimers()
  const fetchFn = sharedFetch ?? deviceFetch()
  const listeners = new Set()
  const notes = []
  let unreadable = false
  let current = state
  let detach = null
  if (!shared) storage.setItem(KEY, JSON.stringify(state))
  const save = (s) => {
    if (unreadable) return false
    const ok = !d.failSaves
    if (ok) storage.setItem(KEY, JSON.stringify(s))
    for (const l of listeners) l(s, ok)
    return ok
  }
  const engine = createSync({
    fetch: fetchFn,
    storage,
    isUnreadable: () => unreadable,
    loadLocal: () => JSON.parse(storage.getItem(KEY)),
    saveLocal: save,
    subscribeSaved: (l) => (listeners.add(l), () => listeners.delete(l)),
    loadNotes: () => notes,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  })
  const d = {
    failSaves: false,
    pendingAdopts: [],
    engine,
    storage,
    timers,
    fetch: fetchFn,
    notes,
    get state() {
      return current
    },
    // What store.jsx setState does: reduce, save (→ the save listener).
    change(fn) {
      current = fn(current)
      save(current)
    },
    // The app mounting: it opens from local data (loadState), then the store attaches.
    mount() {
      current = JSON.parse(storage.getItem(KEY))
      const apply = (fn) => d.change(fn)
      detach = engine.attach({
        state: current,
        adopt: adopt === 'sync' ? apply : adopt === 'async' ? (fn) => d.pendingAdopts.push(() => apply(fn)) : () => {},
      })
    },
    unmount() {
      detach?.()
      detach = null
    },
    applyAdopts() {
      for (const f of d.pendingAdopts.splice(0)) f()
    },
    async login(username) {
      const result = await engine.login(username, PASSWORD)
      assert.deepEqual(result, { ok: true })
      d.mount()
      await engine.idle()
    },
    // What the debounce timer would do, now.
    async settle() {
      timers.fire()
      await engine.idle()
    },
    stored: () => JSON.parse(storage.getItem(KEY)),
    setUnreadable: (v) => (unreadable = v),
  }
  return d
}

let setNo = 0
function withSet(s, reps = '8') {
  setNo += 1
  return setLoggedState(s, {
    routineItemId: 'si-press',
    exerciseId: 'ex-press',
    setType: 'work',
    weight: 25,
    reps,
    rpe: null,
    note: `set-${setNo}`,
    targetReps: '10',
    targetWeight: 25,
    loggedAt: `2026-10-09T17:${String(10 + (setNo % 40)).padStart(2, '0')}:00.000Z`,
  })
}
const setNotes = (s) => (s.activeWorkout?.sets ?? []).map((set) => set.note).filter((note) => note.startsWith('set-'))
const renamed = (s, routineId, name) => ({ ...s, routines: s.routines.map((r) => (r.id === routineId ? { ...r, name } : r)) })
const puts = (d) => d.fetch.log.filter((e) => e.method === 'PUT')

describe('req-230 — sync against a throwaway server', () => {
  it('2. log a set → after the debounce the server’s rev rises and holds the set', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    const rev = server(user).rev
    assert.equal(rev, 1, 'first login on an empty account sends the device’s data')
    d.change((s) => withSet(s))
    assert.deepEqual(d.timers.delays(), [DEBOUNCE_MS], 'the push waits for the ~2 s debounce')
    assert.equal(puts(d).length, 1, 'nothing sent before the debounce')
    await d.settle()
    const after = server(user)
    assert.equal(after.rev, rev + 1)
    assert.deepEqual(setNotes(after.state), setNotes(d.state))
    assert.equal(setNotes(after.state).length, 1)
    assert.equal(d.engine.getStatus().dirty, false)
    assert.match(syncLine(d.engine.getStatus()), /^Synced · just now$/)
  })

  it('3. failure — offline: 3 sets stay on the device ("Not synced yet"), then ONE sync carries all 3', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.fetch.offline = true
    for (let i = 0; i < 3; i++) {
      d.change((s) => withSet(s))
      await d.settle()
    }
    assert.equal(setNotes(d.stored()).length, 3, 'all 3 in local storage')
    assert.equal(syncLine(d.engine.getStatus()), NOT_SYNCED)
    assert.equal(server(user).rev, 1, 'the server has none of them')
    // Bounded timer retries while offline (opening the app / online / a save still retry).
    for (let i = 0; i < 10; i++) await d.settle()
    assert.deepEqual(d.timers.delays(), [], 'no endless retry timer')
    d.fetch.offline = false
    const before = d.fetch.log.length
    await d.engine.trigger() // the browser's `online` event
    const sent = d.fetch.log.slice(before)
    assert.deepEqual(sent.map((e) => e.method), ['PUT'], 'one sync')
    const after = server(user)
    assert.equal(after.rev, 2)
    assert.equal(setNotes(after.state).length, 3, 'all 3, none doubled')
    assert.deepEqual(setNotes(after.state), setNotes(d.state))
    assert.equal(d.engine.getStatus().dirty, false)
  })

  it('3b. network errors retry on a bounded timer (5 s, 20 s, 60 s), then stop', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.fetch.offline = true
    d.change((s) => withSet(s))
    const seen = []
    for (let i = 0; i < 8; i++) {
      seen.push(...d.timers.delays())
      await d.settle()
    }
    assert.deepEqual(seen, [DEBOUNCE_MS, ...RETRY_MS])
    assert.equal(puts(d).length, 1 + 1 + RETRY_MS.length, 'login push + first try + 3 retries')
  })

  it('4. failure — unreadable local data: no request leaves the app, whatever triggers it', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.unmount()
    d.fetch.log.length = 0
    d.setUnreadable(true)
    d.mount() // opening the app
    d.change((s) => withSet(s)) // saveState refuses → no listener
    await d.settle()
    await d.engine.trigger() // online / visible
    d.engine.noteSaved()
    await d.settle()
    assert.deepEqual(await d.engine.login(user, PASSWORD), { error: LOGIN_UNREADABLE })
    d.engine.logout()
    await new Promise((r) => setTimeout(r, 20))
    assert.deepEqual(d.fetch.log, [], 'fetch was never called')
    assert.equal(server(user).rev, 1)
  })

  it('5. merge round trip — A edits a routine, B finishes a workout offline → both end with both', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    const b = device(emptyState())
    await b.login(user)
    assert.deepEqual(b.state, server(user).state, 'B took the server’s copy')
    a.change((s) => renamed(s, 'rtn-a', 'Upper (A)'))
    await a.settle()
    b.fetch.offline = true
    b.change((s) => finishedState(s, { overallNote: 'B finished', overallFeel: '' }, '2026-10-09T18:00:00.000Z'))
    await b.settle()
    b.fetch.offline = false
    await b.engine.trigger()
    await a.engine.trigger()
    for (const d of [a, b]) {
      assert.equal(d.state.routines.find((r) => r.id === 'rtn-a').name, 'Upper (A)')
      assert.ok(d.state.workouts.some((w) => w.id === 'wo-2' && w.overallNote === 'B finished'))
      assert.equal(d.state.activeWorkout, null)
      assert.deepEqual(d.stored(), d.state, 'and it is what the device stored')
    }
    assert.deepEqual(a.state, b.state)
    assert.deepEqual(a.state, server(user).state)
  })

  it('5b. same routine edited on both → the newest wins, the other is kept on the server, no conflict in the status', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    const b = device(emptyState())
    await b.login(user)
    a.change((s) => renamed(s, 'rtn-a', 'From A'))
    await a.settle()
    b.change((s) => renamed(s, 'rtn-a', 'From B (newest)'))
    await b.settle()
    await a.engine.trigger()
    for (const d of [a, b]) assert.equal(d.state.routines.find((r) => r.id === 'rtn-a').name, 'From B (newest)')
    const id = userId(user)
    const conflicted = listRevisions(srv.db, id).filter((r) => r.conflicts > 0)
    assert.equal(conflicted.length, 1)
    const lost = getRevision(srv.db, id, conflicted[0].rev).conflicts[0]
    assert.equal(lost.field, 'routines')
    assert.equal(lost.lost.name, 'From A', 'the losing version is still on the server')
    assert.deepEqual(Object.keys(a.engine.getStatus()).sort(), ['dirty', 'error', 'expired', 'rev', 'syncedAt', 'syncedUser', 'syncing', 'user'])
    assert.equal(a.engine.getStatus().error, null)
  })

  it('6. failure — session expired: 401 → login prompt; local data byte-identical', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.change((s) => withSet(s))
    const before = d.storage.getItem(KEY)
    srv.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId(user))
    await d.settle()
    assert.equal(d.engine.getStatus().expired, true, 'the login prompt shows')
    assert.equal(d.engine.getStatus().user, user, 'still this device’s user: the app stays open')
    assert.equal(d.storage.getItem(KEY), before, 'byte-identical')
    await d.engine.trigger()
    assert.equal(puts(d).at(-1).body.state.activeWorkout.sets.length, d.state.activeWorkout.sets.length)
    const count = d.fetch.log.length
    await d.settle()
    assert.equal(d.fetch.log.length, count, 'no more requests until logged in again')
    // Logging in again (same user) sends the waiting set.
    d.unmount()
    await d.login(user)
    assert.equal(d.engine.getStatus().expired, false)
    assert.deepEqual(setNotes(server(user).state), setNotes(d.state))
  })

  it('7. logout offline → data stays → login online → the set reaches the server', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.fetch.offline = true
    d.change((s) => withSet(s))
    await d.settle()
    d.engine.logout() // allowed offline
    d.unmount()
    assert.equal(d.engine.getStatus().user, null)
    assert.equal(setNotes(d.stored()).length, 1, 'the set is still on the device')
    d.fetch.offline = false
    const before = d.fetch.log.length
    await d.login(user)
    const sent = d.fetch.log.slice(before).map((e) => `${e.method} ${e.path}`)
    assert.deepEqual(sent, ['POST /api/login', 'PUT /api/state'], 'a normal sync: not a first login')
    assert.deepEqual(setNotes(server(user).state), setNotes(d.state))
    assert.equal(setNotes(server(user).state).length, 1)
  })

  for (const keepHistory of [false, true]) {
    it(`7. Import (${keepHistory ? 'Keep my history' : 'Replace everything'}) → the server’s rev rises and holds the imported data`, async () => {
      const user = await newAccount()
      const d = device()
      await d.login(user)
      const rev = server(user).rev
      const file = fullState()
      file.routines = [...file.routines, { id: 'rtn-imported', name: 'Imported plan', focus: 'Machines', archivedAt: null, exercises: [] }]
      file.workouts = []
      commitBackup(buildBackup(file), (fn) => d.change(fn), { keepHistory, current: d.state })
      await d.settle()
      const after = server(user)
      assert.equal(after.rev, rev + 1)
      assert.ok(after.state.routines.some((r) => r.id === 'rtn-imported'))
      assert.deepEqual(after.state, JSON.parse(JSON.stringify(d.state)))
      // Keep my history keeps the device's finished workouts; Replace takes the file's (none).
      assert.equal(after.state.workouts.some((w) => w.id === 'wo-1'), keepHistory)
    })
  }

  it('the running cardio stopwatch survives a sync (log a set, sync, adopt the server’s copy)', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    const stopwatch = d.state.activeWorkout.stopwatch
    assert.ok(stopwatch?.startedAt, 'fixture: a stopwatch is running')
    d.change((s) => withSet(s))
    await d.settle()
    // Another device's change, so this one TAKES a new server copy on its next sync.
    const other = device(emptyState())
    await other.login(user)
    other.change((s) => renamed(s, 'rtn-a', 'Elsewhere'))
    await other.settle()
    await d.engine.trigger()
    assert.equal(d.state.routines.find((r) => r.id === 'rtn-a').name, 'Elsewhere', 'the server copy was taken')
    assert.deepEqual(d.state.activeWorkout.stopwatch, stopwatch, 'still running, same start')
    assert.deepEqual(d.stored().activeWorkout.stopwatch, stopwatch)
    assert.deepEqual(server(user).state.activeWorkout.stopwatch, stopwatch)
  })

  it('first login onto an account with data takes the server’s copy — never a baseRev-0 push', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    a.change((s) => withSet(s))
    await a.settle()
    const b = device(emptyState()) // a phone with other data
    b.change((s) => renamed({ ...s, routines: [{ id: 'rtn-phone', name: 'Phone only', focus: 'Machines', archivedAt: null, exercises: [] }] }, 'x', 'y'))
    await b.login(user)
    // Login, the state read, then the app opening (its own on-open check). No PUT at all.
    // (round 2: the open check carries its base, `?baseRev=&baseId=`.)
    assert.deepEqual(b.fetch.log.map((e) => `${e.method} ${e.path.split('?')[0]}`), ['POST /api/login', 'GET /api/state', 'GET /api/state'])
    assert.deepEqual(b.state, server(user).state)
    assert.deepEqual(b.stored(), server(user).state)
    assert.ok(listRevisions(srv.db, userId(user)).every((r) => !(r.baseRev === 0 && r.merged)), 'the baseRev-0 merge path was never taken')
  })

  it('one push at a time: add R then delete R while the first push is in flight → R stays deleted', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    let release
    d.fetch.hold = new Promise((r) => (release = r))
    const R = { id: 'rtn-R', name: 'R', focus: 'Machines', archivedAt: null, exercises: [] }
    d.change((s) => ({ ...s, routines: [...s.routines, R] }))
    const first = d.engine.flush()
    await new Promise((r) => setTimeout(r, 30)) // the PUT is at the server, its answer held
    d.change((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== 'rtn-R') }))
    d.engine.flush() // asked while in flight → waits
    assert.equal(puts(d).length, 2, 'login push + the held one; the second has not left')
    d.fetch.hold = null
    release()
    await first
    await d.engine.idle()
    const sent = puts(d).slice(1)
    assert.equal(sent.length, 2)
    assert.equal(sent[1].body.baseRev, sent[0].body.baseRev + 1, 'the second push is based on the rev the first returned')
    assert.ok(!server(user).state.routines.some((r) => r.id === 'rtn-R'))
    assert.ok(!d.state.routines.some((r) => r.id === 'rtn-R'))
  })

  it('a change made while a sync is in flight is never overwritten (rebased, then sent)', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    let release
    d.fetch.hold = new Promise((r) => (release = r))
    d.change((s) => withSet(s))
    const first = d.engine.flush()
    await new Promise((r) => setTimeout(r, 30))
    d.change((s) => withSet(s)) // logged while the first push is out
    d.fetch.hold = null
    release()
    await first
    assert.equal(setNotes(d.state).length, 2, 'the second set is still there after the reply')
    await d.settle()
    assert.deepEqual(setNotes(server(user).state), setNotes(d.state))
  })

  it('oversized upload: refused before sending, a clear failure, no retry loop; a 413 reads the same', async () => {
    assert.equal(MAX_BYTES, MAX_BODY, 'the app’s cap is the server’s')
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.change((s) => ({ ...s, activeWorkout: { ...s.activeWorkout, overallNote: 'x'.repeat(MAX_BYTES) } }))
    await d.settle()
    assert.equal(puts(d).length, 1, 'only the login push: nothing over the cap was sent')
    assert.equal(d.engine.getStatus().error.kind, 'too-large')
    assert.match(syncLine(d.engine.getStatus()), /^Not synced — too much data to send \(20\.0 MB; the server takes 20 MB\)/)
    assert.deepEqual(d.timers.delays(), [], 'no retry timer')
    // A 413 from the server (a body just under our estimate, say) is the same failure.
    d.change((s) => ({ ...s, activeWorkout: { ...s.activeWorkout, overallNote: 'small' } }))
    d.fetch.respond = (e) => (e.method === 'PUT' ? new Response(JSON.stringify({ error: 'Request too large.' }), { status: 413 }) : null)
    await d.settle()
    assert.equal(d.engine.getStatus().error.kind, 'too-large')
    assert.deepEqual(d.timers.delays(), [])
    d.fetch.respond = null
    d.change((s) => ({ ...s, activeWorkout: { ...s.activeWorkout, overallNote: 'smaller' } }))
    await d.settle()
    assert.equal(d.engine.getStatus().error, null, 'the next change that fits clears it')
    assert.equal(server(user).state.activeWorkout.overallNote, 'smaller')
  })

  it('9. feedback notes go to the server when saved; queued while offline', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.fetch.offline = true
    d.notes.push({ route: '#/', timestamp: '2026-10-09T17:00:00.000Z', text: 'first note', context: {} })
    d.engine.noteSaved()
    await d.settle()
    assert.equal(getNotes(srv.db, userId(user)).length, 0)
    d.fetch.offline = false
    d.notes.push({ route: '#/history', timestamp: '2026-10-09T17:05:00.000Z', text: 'second note', context: { routeName: 'history' } })
    d.engine.noteSaved()
    await d.settle()
    assert.deepEqual(getNotes(srv.db, userId(user)).map((x) => x.text), ['first note', 'second note'])
    assert.equal(d.notes.length, 2, 'the on-device list stays')
  })

  it('open with nothing changed → a GET only; a newer server copy is taken', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    a.unmount()
    const b = device(emptyState())
    await b.login(user)
    b.change((s) => renamed(s, 'rtn-a', 'From B'))
    await b.settle()
    const before = a.fetch.log.length
    a.mount() // the app opened again
    await a.engine.idle()
    assert.deepEqual(a.fetch.log.slice(before).map((e) => e.method), ['GET'])
    assert.equal(a.state.routines.find((r) => r.id === 'rtn-a').name, 'From B')
    assert.equal(JSON.parse(a.storage.getItem(META_KEY)).rev, server(user).rev)
  })

  it('wrong password → the server’s message, nothing stored', async () => {
    const user = await newAccount()
    const d = device()
    assert.deepEqual(await d.engine.login(user, 'wrong!'), { error: 'Wrong username or password.' })
    assert.equal(d.engine.getStatus().user, null)
    assert.equal(server(user).rev, 0)
  })
})

// ---------------------------------------------------------------------------------------------
// Review round 1 — each test fails without its fix (receipts in reports/req-230.md).

describe('req-230 review round 1', () => {
  it('#1 a save lost to a full storage: after a reload the server’s copy (with the set) is taken, never erased', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    a.failSaves = true
    a.change((s) => withSet(s))
    await a.settle()
    assert.equal(setNotes(server(user).state).length, 1, 'the set reached the server')
    assert.equal(setNotes(a.stored()).length, 0, 'but not this phone’s storage')
    a.unmount()
    // Reload: storage freed up, the app opens from the stale copy; the user edits right away.
    const b = device(undefined, { storage: a.storage, fetch: a.fetch })
    b.mount()
    b.change((s) => renamed(s, 'rtn-a', 'edited after reload'))
    await b.engine.idle()
    await b.settle()
    const after = server(user).state
    assert.equal(setNotes(after).length, 1, 'the server’s only copy of the set survives')
    assert.equal(after.routines.find((r) => r.id === 'rtn-a').name, 'edited after reload')
    assert.equal(setNotes(b.stored()).length, 1, 'and this phone has it again')
  })

  it('#1 same rev, nothing marked changed, but the local copy differs → the server’s copy is taken', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    a.change((s) => withSet(s))
    await a.settle()
    a.unmount()
    // The stored copy lost the set while the meta still says "synced, rev N" (an older build's meta).
    const stale = a.stored()
    stale.activeWorkout = { ...stale.activeWorkout, sets: [] }
    a.storage.setItem(KEY, JSON.stringify(stale))
    const b = device(undefined, { storage: a.storage, fetch: a.fetch })
    b.mount()
    await b.engine.idle()
    assert.equal(setNotes(b.state).length, 1)
    b.change((s) => renamed(s, 'rtn-a', 'next edit'))
    await b.settle()
    assert.equal(setNotes(server(user).state).length, 1)
  })

  // Round 1's #2 asserted the device's copy wins after a restore; review round 2 reversed that (a
  // push onto a restored history merges WITHOUT a base: the restored value stays where they differ,
  // the device's is listed as lost; records only the device has are kept and listed).
  // Review round 4 (DEC-133): except the workout in progress — the device's wins; the restored one
  // is listed as lost.
  const lostIn = (user) => {
    const id = userId(user)
    return listRevisions(srv.db, id).flatMap((r) => getRevision(srv.db, id, r.rev).conflicts)
  }
  const R = (rid) => ({ id: rid, name: rid, focus: 'Machines', archivedAt: null, exercises: [] })

  it('#2 the server went back (a backup restored): a clean device never takes the older copy silently — it merges, disagreements listed', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.change((s) => ({ ...withSet(s), routines: [...s.routines, R('rtn-after-backup')] }))
    await d.settle()
    d.change((s) => withSet(s))
    await d.settle()
    srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev > 1').run(userId(user)) // restore → rev 1
    await d.engine.trigger()
    await d.engine.idle()
    const after = server(user)
    assert.equal(after.rev, 2, 'one merged revision on top of the restored one')
    assert.ok(after.state.routines.some((r) => r.id === 'rtn-after-backup'), 'only on the device → kept')
    assert.equal(setNotes(after.state).length, 2, 'DEC-133: the device’s workout in progress wins')
    const lost = lostIn(user)
    assert.ok(lost.some((c) => c.field === 'activeWorkout' && c.kind === 'no-base-in-progress' && setNotes({ activeWorkout: c.lost }).length === 0), 'the restored workout is listed, not dropped')
    assert.ok(lost.some((c) => c.id === 'rtn-after-backup' && c.kind === 'no-base-one-side'))
    assert.deepEqual(d.state, after.state, 'the device took the merged result')
    assert.equal(d.engine.getStatus().error, null)
  })

  it('#2 the server went back: a device with a change waiting merges instead of a 409 forever', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.change((s) => withSet(s))
    await d.settle()
    srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev > 1').run(userId(user))
    d.change((s) => withSet(s))
    await d.settle()
    await d.engine.idle()
    assert.equal(d.engine.getStatus().error, null, 'no 409')
    assert.equal(d.engine.getStatus().dirty, false)
    // DEC-133: the device's 2 sets win; the restored workout (rev 1: no sets) is the listed one.
    assert.equal(setNotes(server(user).state).length, 2)
    assert.ok(lostIn(user).some((c) => c.field === 'activeWorkout' && c.kind === 'no-base-in-progress' && setNotes({ activeWorkout: c.lost }).length === 0))
  })

  it('round 2 P6 — a rev number reused after a restore is never read as a fast-forward', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user) // rev 1
    const b = device(emptyState())
    await b.login(user)
    a.change((s) => withSet(s))
    await a.settle() // rev 2 ← B's base after its next sync
    await b.engine.trigger()
    assert.equal(JSON.parse(b.storage.getItem(META_KEY)).rev, 2)
    b.fetch.offline = true
    b.change((s) => ({ ...s, routines: [...s.routines, R('rtn-from-b')] })) // unsynced on B
    await b.settle()
    a.change((s) => withSet(s))
    await a.settle() // rev 3
    a.change((s) => ({ ...s, routines: [...s.routines, R('rtn-from-a')] }))
    await a.settle() // rev 4
    srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev > 1').run(userId(user)) // restore → rev 1
    await a.engine.trigger() // A pushes → stored as a NEW rev 2
    assert.equal(server(user).rev, 2)
    assert.ok(server(user).state.routines.some((r) => r.id === 'rtn-from-a'))
    b.fetch.offline = false
    await b.engine.trigger() // B: base "rev 2" — the old one
    const after = server(user)
    assert.ok(after.state.routines.some((r) => r.id === 'rtn-from-a'), 'A’s record is not erased')
    assert.ok(after.state.routines.some((r) => r.id === 'rtn-from-b'), 'B’s record is kept')
    const last = getRevision(srv.db, userId(user), after.rev)
    assert.equal(last.merged, true, 'merged, not a fast-forward')
    assert.ok(last.conflicts.length > 0, 'and its disagreements listed')
    assert.deepEqual(b.state, after.state)
  })

  it('round 3 P9 — a CLEAN laptop whose base was pruned takes the server’s copy; the phone’s deletions stay deleted', async () => {
    const user = await newAccount()
    const phone = device()
    phone.change((s) => ({ ...s, routines: [...s.routines, R('rtn-old')] }))
    await phone.login(user) // rev 1 holds rtn-old
    const laptop = device(emptyState())
    await laptop.login(user) // took rev 1
    laptop.unmount()
    phone.change((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== 'rtn-old') }))
    await phone.settle()
    phone.change((s) => renamed(s, 'rtn-a', 'Upper (current)'))
    await phone.settle()
    prune(user, 1) // pruned
    const before = laptop.fetch.log.length
    laptop.mount() // opens online, nothing changed on it
    await laptop.engine.idle()
    assert.deepEqual(laptop.fetch.log.slice(before).map((e) => e.method), ['GET'], 'no push')
    const after = server(user).state
    assert.equal(after.routines.some((r) => r.id === 'rtn-old'), false, 'the deletion holds')
    assert.deepEqual(laptop.state, after, 'the laptop took the server’s copy')
    assert.equal(laptop.engine.getStatus().dirty, false)
  })

  it('round 3 — a pruned base with a change waiting still merges (no-base), the change is not dropped', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user)
    const laptop = device(emptyState())
    await laptop.login(user)
    laptop.unmount()
    phone.change((s) => renamed(s, 'rtn-a', 'phone'))
    await phone.settle()
    prune(user, 1) // pruned
    laptop.fetch.offline = true
    laptop.mount()
    await laptop.engine.idle()
    laptop.change((s) => ({ ...s, routines: [...s.routines, R('rtn-laptop')] }))
    laptop.fetch.offline = false
    await laptop.settle()
    const after = server(user).state
    assert.ok(after.routines.some((r) => r.id === 'rtn-laptop'))
    assert.equal(after.routines.find((r) => r.id === 'rtn-a').name, 'phone')
  })

  it('round 2 P7 — a stale laptop (base pruned) never ends the phone’s workout in progress', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user) // rev 1: an active workout (with its stopwatch)
    const laptop = device(emptyState())
    await laptop.login(user)
    laptop.unmount() // the laptop is put away, on rev 1
    // Weeks pass on the phone: a workout finished, a new one started, sets logged.
    phone.change((s) => finishedState(s, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z'))
    await phone.settle()
    phone.change((s) => ({ ...s, activeWorkout: { ...fullState().activeWorkout, id: 'wo-now' } }))
    phone.change((s) => renamed(withSet(s), 'rtn-a', 'Upper (current)'))
    await phone.settle()
    prune(user, 1) // pruned
    // The laptop opens and makes one edit on its old copy (no active workout, old names).
    // Review round 3: offline BEFORE it opens, so the open-time check can't go out and take the
    // server's copy — the stale edit really is pushed onto a pruned base.
    laptop.fetch.offline = true
    laptop.mount()
    await laptop.engine.idle()
    laptop.change((s) => ({ ...s, activeWorkout: null, exercises: [...s.exercises, { ...s.exercises[0], id: 'ex-laptop', name: 'Laptop exercise' }] }))
    laptop.fetch.offline = false
    await laptop.settle()
    const after = server(user).state
    assert.equal(after.activeWorkout?.id, 'wo-now', 'the workout in progress is still there')
    assert.equal(after.routines.find((r) => r.id === 'rtn-a').name, 'Upper (current)', 'the newer name stays')
    assert.ok(after.exercises.some((e) => e.id === 'ex-laptop'), 'the laptop’s new record is kept')
    await phone.engine.trigger()
    assert.equal(phone.state.activeWorkout?.id, 'wo-now')
    assert.equal(setNotes(phone.state).length, 1)
    assert.deepEqual(phone.state.activeWorkout.stopwatch, fullState().activeWorkout.stopwatch)
  })

  // Review round 4 (#1, DEC-133) — a restore while the phone is mid-workout: the sets logged after
  // the backup survive (the device's activeWorkout wins the no-base merge); every other record takes
  // the restored copy, so a routine renamed after the backup reverts (reviewer's P2: intended).
  it('round 4 DEC-133 — a restore never removes the sets of the workout in progress; a routine edit after the backup reverts', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user) // rev 1
    phone.change((s) => withSet(s))
    await phone.settle() // rev 2 ← the backup
    const backupName = server(user).state.routines.find((r) => r.id === 'rtn-a').name
    phone.change((s) => withSet(s))
    await phone.settle()
    phone.change((s) => renamed(withSet(s), 'rtn-a', 'renamed after the backup'))
    await phone.settle()
    assert.equal(setNotes(phone.state).length, 3)
    srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev > 2').run(userId(user)) // restore → rev 2
    await phone.engine.trigger() // the app opens / comes back online
    await phone.engine.idle()
    const after = server(user).state
    assert.equal(setNotes(after).length, 3, 'all 3 sets on the server')
    assert.equal(setNotes(phone.state).length, 3, 'and on the phone')
    assert.equal(after.routines.find((r) => r.id === 'rtn-a').name, backupName, 'the routine edit reverts to the backup')
    assert.equal(phone.state.routines.find((r) => r.id === 'rtn-a').name, backupName)
    const lost = lostIn(user)
    assert.ok(lost.some((c) => c.id === 'rtn-a' && c.lost?.name === 'renamed after the backup'), 'the phone’s rename is listed')
    assert.ok(lost.some((c) => c.field === 'activeWorkout' && setNotes({ activeWorkout: c.lost }).length === 1), 'the restored workout is listed')
    assert.equal(phone.engine.getStatus().dirty, false)
  })

  // Review round 4 (#3) — reviewer's P10: a laptop opens clean, its base was pruned, and an edit is
  // made while the open-time check is out. What it opened with is the last-synced state, so the
  // server's copy is rebased under the edit three-way — the phone's deletion holds, the edit survives.
  it('round 4 P10 — a clean-opened laptop, base pruned, an edit made right after opening: deletions stay deleted, the edit survives', async () => {
    const user = await newAccount()
    const phone = device()
    phone.change((s) => ({ ...s, routines: [...s.routines, R('rtn-old')] }))
    await phone.login(user) // rev 1 holds rtn-old
    const laptop = device(emptyState())
    await laptop.login(user)
    laptop.unmount()
    phone.change((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== 'rtn-old') }))
    await phone.settle()
    prune(user, 1)
    let edited = false
    laptop.fetch.respond = (e) => {
      if (e.method === 'GET' && !edited) {
        edited = true
        laptop.change((s) => ({ ...s, routines: [...s.routines, R('rtn-lap')] })) // while the GET is out
      }
      return null
    }
    laptop.mount()
    await laptop.engine.idle()
    laptop.fetch.respond = null
    await laptop.settle()
    const after = server(user).state
    const conf = lostIn(user).map((c) => `${c.field}:${c.kind}`)
    assert.equal(after.routines.some((r) => r.id === 'rtn-old'), false, `rtn-old stays deleted (conflicts: ${conf})`)
    assert.ok(after.routines.some((r) => r.id === 'rtn-lap'), 'the laptop’s edit survives')
    assert.deepEqual(laptop.state, after)
    assert.equal(laptop.engine.getStatus().dirty, false)
  })

  // Review round 5 (#1, reviewer's probe A) — DEC-133 is for a RESTORE only. A stale laptop whose
  // base was PRUNED, still holding the old workout in progress (wo-2), never replaces the phone's
  // live one (wo-now, 2 sets). P7 missed it: its laptop had no workout (`null`).
  it('round 5 probe A — a pruned base never lets a stale laptop’s old workout replace the phone’s live one', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user) // rev 1: wo-2 in progress
    const laptop = device(emptyState())
    await laptop.login(user)
    laptop.unmount() // put away on rev 1, wo-2 in progress
    phone.change((s) => finishedState(s, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z'))
    await phone.settle()
    phone.change((s) => ({ ...s, activeWorkout: { ...fullState().activeWorkout, id: 'wo-now' } }))
    phone.change((s) => withSet(withSet(s)))
    await phone.settle()
    prune(user, 1)
    laptop.fetch.offline = true
    laptop.mount()
    await laptop.engine.idle()
    assert.equal(laptop.state.activeWorkout?.id, 'wo-2', 'the laptop still holds the old workout')
    laptop.change((s) => ({ ...s, exercises: [...s.exercises, { ...s.exercises[0], id: 'ex-laptop', name: 'Laptop exercise' }] }))
    laptop.fetch.offline = false
    await laptop.settle()
    const after = server(user).state
    assert.equal(after.activeWorkout?.id, 'wo-now', 'the phone’s workout is still in progress')
    assert.equal(setNotes(after).length, 2, 'with its 2 sets')
    assert.ok(after.exercises.some((e) => e.id === 'ex-laptop'), 'the laptop’s edit is kept')
    await phone.engine.trigger()
    assert.equal(phone.state.activeWorkout?.id, 'wo-now')
    assert.equal(setNotes(phone.state).length, 2)
  })

  // Review round 5 (#3) — a restore brings back a workout this device has since FINISHED: it must not
  // come back as in progress (finishing it again wrote a second history entry with the same id).
  it('round 5 — a restored workout in progress that the device has finished does not come back as in progress', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user) // rev 1 ← the backup: wo-2 in progress
    assert.equal(server(user).state.activeWorkout?.id, 'wo-2')
    phone.change((s) => finishedState(withSet(s), { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z'))
    await phone.settle() // rev 2: wo-2 finished, nothing in progress
    srv.db.prepare('DELETE FROM revisions WHERE user_id = ? AND rev > 1').run(userId(user)) // restore → rev 1
    await phone.engine.trigger()
    await phone.engine.idle()
    const after = server(user).state
    assert.equal(after.activeWorkout, null, 'not in progress on the server')
    assert.equal(phone.state.activeWorkout, null, 'nor on the phone')
    assert.equal(after.workouts.filter((w) => w.id === 'wo-2').length, 1, 'one history entry for wo-2')
    assert.ok(lostIn(user).some((c) => c.field === 'activeWorkout' && c.kind === 'no-base-finished' && c.lost?.id === 'wo-2'), 'the dropped copy is listed')
  })

  it('#4 two tabs: one tab’s sync never clears the other tab’s waiting change', async () => {
    const user = await newAccount()
    const a = device()
    await a.login(user)
    // Tab B: same storage, offline (its own fetch), opens the app.
    const b = device(undefined, { storage: a.storage, adopt: 'sync' })
    b.fetch.offline = true
    b.mount()
    // A starts a sync of its own change; while it is out, B logs a set; A's tab closes before
    // React applies A's update (adopt never runs), so the stored copy is B's.
    a.unmount()
    const a2 = device(undefined, { storage: a.storage, fetch: a.fetch, adopt: 'never' })
    a2.mount()
    await a2.engine.idle()
    let release
    a2.fetch.hold = new Promise((r) => (release = r))
    a2.change((s) => renamed(s, 'rtn-a', 'from tab A'))
    const out = a2.engine.flush()
    await new Promise((r) => setTimeout(r, 30))
    b.change((s) => withSet(s))
    a2.fetch.hold = null
    release()
    await out
    assert.equal(JSON.parse(a.storage.getItem(META_KEY)).dirty, true, 'B’s change is still marked')
    // Next open (B's copy on disk): the set goes up.
    b.unmount()
    const c = device(undefined, { storage: a.storage, fetch: a.fetch })
    c.mount()
    await c.engine.idle()
    assert.equal(setNotes(server(user).state).length, 1)
  })

  it('#5 the store applies the server’s copy LATER (as React does): a sync queued behind it must not revert another device’s change', async () => {
    const user = await newAccount()
    const d = device(undefined, { adopt: 'async' })
    await d.login(user)
    d.applyAdopts()
    const other = device(emptyState())
    await other.login(user)
    other.change((s) => renamed(s, 'rtn-a', 'renamed elsewhere'))
    await other.settle()
    let release
    d.fetch.hold = new Promise((r) => (release = r))
    d.change((s) => withSet(s))
    const first = d.engine.flush()
    await new Promise((r) => setTimeout(r, 30))
    d.change((s) => withSet(s))
    d.engine.flush() // queued behind the first
    d.fetch.hold = null
    release()
    await first
    await d.engine.idle()
    d.applyAdopts()
    await d.settle()
    const after = server(user).state
    assert.equal(after.routines.find((r) => r.id === 'rtn-a').name, 'renamed elsewhere', 'P1: not reverted')
    // …at ANY point: no revision stored after the rename ever carried the old name again (another
    // device syncing then would have taken the revert).
    const id = userId(user)
    const renamedAt = listRevisions(srv.db, id).find((r) => getRevision(srv.db, id, r.rev).state.routines.find((x) => x.id === 'rtn-a').name === 'renamed elsewhere').rev
    for (const r of listRevisions(srv.db, id).filter((x) => x.rev >= renamedAt)) {
      assert.equal(getRevision(srv.db, id, r.rev).state.routines.find((x) => x.id === 'rtn-a').name, 'renamed elsewhere', `rev ${r.rev}`)
    }
    assert.equal(setNotes(after).length, 2)
  })

  it('#8 a refused notes upload never blocks the state sync', async () => {
    const user = await newAccount()
    const d = device()
    await d.login(user)
    d.notes.push({ route: '#/', timestamp: '2026-10-09T17:00:00.000Z', text: 'n', context: {} })
    d.engine.noteSaved()
    d.fetch.respond = (e) => (e.path === '/api/notes' ? new Response(JSON.stringify({ error: 'nope' }), { status: 400 }) : null)
    d.change((s) => withSet(s))
    await d.settle()
    assert.equal(setNotes(server(user).state).length, 1, 'the set went up')
    assert.equal(d.engine.getStatus().error, null, 'no failure shown for the state')
    d.fetch.respond = null
    await d.engine.trigger()
    assert.equal(getNotes(srv.db, userId(user)).length, 1, 'the note goes up later')
  })
})

// req-231 — go-live: a phone whose server-build origin once synced with a TEST server. Which reset
// keeps test records out of the real history? These pin the answer: clear the origin's whole site
// data (not only `workout-sync-v1`), and the history epoch (rev ids) is no protection.
describe('req-231 — a device that synced with a test server, at go-live', () => {
  const testData = () => {
    const s = fullState()
    s.routines = [...s.routines, { id: 'rtn-test', name: 'TEST ONLY', focus: 'Machines', archivedAt: null, exercises: [] }]
    return s // its finished workout wo-1 stands for a test workout
  }
  const realExport = () => {
    const s = fullState()
    s.routines = [...s.routines, { id: 'rtn-real', name: 'Real plan', focus: 'Machines', archivedAt: null, exercises: [] }]
    s.workouts = s.workouts.map((w, i) => ({ ...w, id: `wo-real-${i}` }))
    return s
  }
  const staleMeta = (user) => ({ user, syncedUser: user, rev: 5, revId: 'from-the-test-server', dirty: false })

  it('the epoch alone: the stale device logs in again and its test records are merged INTO the real account', async () => {
    const user = await newAccount() // the live account, nothing stored yet
    const d = device(testData())
    d.storage.setItem(META_KEY, JSON.stringify(staleMeta(user)))
    await d.login(user) // its test session is not valid here (401) → login as the same user → a normal sync
    const after = server(user).state
    assert.ok(after.routines.some((r) => r.id === 'rtn-test'), 'the no-base merge KEEPS one-sided records')
    assert.ok(after.workouts.some((w) => w.id === 'wo-1'))
  })

  it('only workout-sync-v1 cleared: the test data goes up as rev 1, and an Import with "Keep my history" keeps the test workouts', async () => {
    const user = await newAccount()
    const d = device(testData()) // META_KEY absent
    await d.login(user) // first login onto an empty account → the device's (test) data goes up
    assert.equal(server(user).rev, 1)
    assert.ok(server(user).state.routines.some((r) => r.id === 'rtn-test'))
    commitBackup(buildBackup(realExport()), (fn) => d.change(fn), { keepHistory: true, current: d.state })
    await d.settle()
    assert.ok(server(user).state.workouts.some((w) => w.id === 'wo-1'), 'a test workout in the real history')
  })

  // Replace everything: "Keep my history" keeps the DEVICE's finished workouts (none on a cleared
  // origin) and not the file's — the go-live Import must be Replace.
  it('site data cleared, log in, Import (Replace everything): the server holds exactly the export — no test record, no note', async () => {
    const user = await newAccount()
    const d = device(emptyState()) // a cleared origin: the app starts empty, no meta, no notes
    await d.login(user)
    commitBackup(buildBackup(realExport()), (fn) => d.change(fn), { keepHistory: false, current: d.state })
    await d.settle()
    const after = server(user).state
    assert.ok(!after.routines.some((r) => r.id === 'rtn-test'))
    assert.deepEqual(after.workouts.map((w) => w.id), realExport().workouts.map((w) => w.id))
    assert.deepEqual(after.routines.map((r) => r.id), realExport().routines.map((r) => r.id))
    assert.equal(getNotes(srv.db, userId(user)).length, 0)
  })
})

// req-268 (audit F-SYNC-1) — the app runs the same three-way merge when it rebases a change made
// while a sync was in flight (engine.js rebaseOnto). The phone finished wo-2; the laptop (same base,
// not pulled) pushes an unrelated edit and, while that push is out, logs one more set. The server's
// reply holds wo-2 finished; the rebase must not put wo-2 back in progress next to its history entry.
describe('req-268 — a workout finished elsewhere never comes back as in progress', () => {
  it('3. the engine rebase gives the same null result (nothing re-shown as in progress)', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user) // rev 1: wo-2 in progress
    const laptop = device(emptyState())
    await laptop.login(user) // the laptop holds rev 1
    const id = laptop.state.activeWorkout.id
    phone.change((s) => finishedState(s, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z'))
    await phone.settle() // rev 2: wo-2 finished
    assert.equal(server(user).state.activeWorkout, null)
    let release
    laptop.fetch.hold = new Promise((r) => (release = r))
    laptop.change((s) => renamed(s, 'rtn-a', 'laptop edit'))
    const out = laptop.engine.flush()
    await new Promise((r) => setTimeout(r, 30))
    laptop.change((s) => withSet(s)) // logged while the push is out
    laptop.fetch.hold = null
    release()
    await out
    assert.equal(laptop.state.activeWorkout, null, 'not in progress on the laptop after the rebase')
    assert.equal(laptop.state.workouts.filter((w) => w.id === id).length, 1, 'one history entry')
    await laptop.settle()
    const after = server(user).state
    assert.equal(after.activeWorkout, null, 'nor on the server')
    assert.equal(after.workouts.filter((w) => w.id === id).length, 1, 'one history entry on the server')
    assert.equal(after.routines.find((r) => r.id === 'rtn-a').name, 'laptop edit', 'the laptop’s edit is kept')
  })

  // Review should-fix 1 — the phone finished wo-2 AND started wo-new; the laptop's rebase drops its
  // stale wo-2 and keeps wo-new (never pushes null over the phone's live workout).
  it('review 1: the rebase keeps the phone’s new live workout, on the laptop and on the server', async () => {
    const user = await newAccount()
    const phone = device()
    await phone.login(user) // rev 1: wo-2 in progress
    const laptop = device(emptyState())
    await laptop.login(user)
    phone.change((s) => finishedState(s, { overallNote: '', overallFeel: '' }, '2026-10-09T18:00:00.000Z'))
    phone.change((s) => ({ ...s, activeWorkout: { ...fullState().activeWorkout, id: 'wo-new' } }))
    await phone.settle() // rev 2: wo-2 finished, wo-new in progress
    let release
    laptop.fetch.hold = new Promise((r) => (release = r))
    laptop.change((s) => renamed(s, 'rtn-a', 'laptop edit'))
    const out = laptop.engine.flush()
    await new Promise((r) => setTimeout(r, 30))
    laptop.change((s) => withSet(s)) // a set on the stale wo-2, while the push is out
    laptop.fetch.hold = null
    release()
    await out
    assert.equal(laptop.state.activeWorkout?.id, 'wo-new', 'the laptop shows the phone’s live workout')
    await laptop.settle()
    assert.equal(server(user).state.activeWorkout?.id, 'wo-new', 'the server still has it in progress')
    assert.equal(server(user).state.workouts.filter((w) => w.id === 'wo-2').length, 1)
    await phone.engine.trigger()
    await phone.engine.idle()
    assert.equal(phone.state.activeWorkout?.id, 'wo-new', 'the phone’s workout is not ended')
  })
})
