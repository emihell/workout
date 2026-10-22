// req-230 — the sync engine end to end against a THROWAWAY req-229 server (temp DB, free port;
// BACKEND rules 2 and 8 — test-helpers turns the live-path guard on before anything opens).
// Each "device" has its own storage, its own cookie and its own timers, and changes its state
// the way the store does (a reducer, then saveState → the save listener). Acceptance criteria
// are numbered in the test names.
import { startTestServer } from '../../server/test-helpers.mjs'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createInvite, registerUser, findUser } from '../../server/auth.mjs'
import { getRevision, getState, listRevisions, getNotes } from '../../server/store.mjs'
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

function device(state = fullState()) {
  const storage = memoryStorage()
  const timers = fakeTimers()
  const fetchFn = deviceFetch()
  const listeners = new Set()
  const notes = []
  let unreadable = false
  let current = state
  let detach = null
  storage.setItem(KEY, JSON.stringify(state))
  const save = (s) => {
    if (unreadable) return false
    storage.setItem(KEY, JSON.stringify(s))
    for (const l of listeners) l(s)
    return true
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
      detach = engine.attach({ state: current, adopt: (fn) => d.change(fn) })
    },
    unmount() {
      detach?.()
      detach = null
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
    assert.deepEqual(Object.keys(a.engine.getStatus()).sort(), ['dirty', 'error', 'expired', 'rev', 'syncedAt', 'syncing', 'user'])
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
    assert.deepEqual(b.fetch.log.map((e) => `${e.method} ${e.path}`), ['POST /api/login', 'GET /api/state', 'GET /api/state'])
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
