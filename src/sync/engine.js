// req-230 (DEC-127/128/132) — the app's side of sync: the phone's browser storage stays the
// working copy (offline-first) and is kept in step with req-229's server.
//
// Only the server build creates an engine (src/sync/boot.jsx). Everything it touches is passed
// in, so the tests run it under `node --test` against a throwaway server (or a mocked fetch).
//
//   after each save        → a push, debounced DEBOUNCE_MS (persistence.js subscribeSaved)
//   on open / online / visible → a sync now
//   a push   = PUT /api/state {baseRev, state}; the server's merged result is taken
//   no local change → GET /api/state; a newer server copy is taken
//
// Rules this file holds:
//   - ONE request at a time. A sync asked for while one is in flight runs after it, on the rev
//     the first one returned (req-229 review: two pushes on one baseRev merge against each other).
//   - A local change made while a sync was in flight is never overwritten: the server's copy is
//     rebased under it with the same three-way merge the server runs (base = what was sent).
//   - Unreadable local data (DEC-032): no request of any kind leaves the app, nothing is taken.
//   - A 401 marks the session expired (a login prompt); local data is never touched.
//   - Too much data for the server's 20 MB cap: refused here before sending (the server closes
//     the socket, which a browser reports as a network error, not a 413) → a clear failure,
//     not an endless "offline" retry. Network errors retry a bounded number of times by timer;
//     a save, opening the app, or coming back online always tries again.
//   - First login on a device (DEC-132 §1): the device takes the server's copy; an empty
//     account (rev 0) gets the device's data. Never a baseRev-0 push onto an account with data.
//   - Log out (DEC-132 §3): always allowed, offline too; local data stays, and anything not yet
//     synced goes up at the next login as the same user.
//   Review round 1:
//   - "Not dirty" is trusted only as far as it was written: equal revs but a local copy that
//     differs from the server's → the server's copy is taken (a save that failed on a full
//     storage left the disk behind the meta). A device whose last state save failed (`diskBehind`)
//     pulls before it pushes, rebasing anything typed since the app opened onto the server's copy.
//   - The server's rev went BACKWARDS (a backup restored): never take the older copy; this device's
//     data is pushed as a change on top of the server's current rev (its restored revision stays
//     on the server as a revision).
//   - Two tabs: the meta is re-read before each write and `dirty` is sticky — only cleared when no
//     other tab marked a change after this tab's last one.
//   - Feedback notes never block the state sync: sent after it, and their failures stay their own.
//   Review round 2:
//   - Rev numbers are reused after a backup restore, so the device keeps the revision's id
//     (`revId`) with its rev and sends it back (`baseId`). If the server says that base is no
//     longer its history (GET `baseOk: false`, or a PUT on it), the push is merged WITHOUT a base
//     on the server: never a fast-forward, every disagreement listed, the server's value kept
//     where they differ. The device then takes the result as usual.
import { deepEqual } from './equal.js'
import { mergeStates } from './merge.js'

export const META_KEY = 'workout-sync-v1'
export const DEBOUNCE_MS = 2000
// server/app.mjs MAX_BODY (a test keeps the two equal).
export const MAX_BYTES = 20 * 1024 * 1024
export const RETRY_MS = [5000, 20000, 60000]
export const CSRF_HEADER = 'x-workout-request'

export const LOGIN_OFFLINE = "Can't reach the server. Check your connection and try again."
export const LOGIN_UNREADABLE = "Your saved data can't be read, so sync is paused. Nothing was sent."

const META_DEFAULTS = {
  user: null, // the logged-in user on this device (null = logged out → login screen)
  syncedUser: null, // the user this device's data last synced as (first login = a different one)
  rev: 0, // the server rev this device's data is based on
  revId: null, // that revision's id (review round 2: a rev number alone can be reused by a restore)
  syncedAt: null, // when the last sync finished (ISO)
  dirty: false, // a local change the server doesn't have yet
  notesDirty: false, // a feedback note not yet sent
  expired: false, // the server said 401: log in again to sync
  dirtyMark: null, // who marked `dirty` last (one random id per tab) — review round 1, two tabs
  diskBehind: false, // the last state save failed: the stored copy is older than this meta says
}

// State as the server stores it (JSON): drops `undefined`-valued keys, so they never read as a change.
const norm = (state) => JSON.parse(JSON.stringify(state))
const bytes = (text) => new TextEncoder().encode(text).length

export function readMeta(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(META_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? { ...META_DEFAULTS, ...parsed } : { ...META_DEFAULTS }
  } catch {
    return { ...META_DEFAULTS }
  }
}

export function createSync({
  fetch,
  storage,
  isUnreadable,
  loadLocal,
  saveLocal,
  subscribeSaved,
  loadNotes = () => [],
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  base = '',
}) {
  let meta = readMeta(storage)
  let store = null // { adopt(fn) } while the app is mounted
  let latest = null // the newest local state (from attach, then every save)
  let agreed = null // the server's copy at meta.rev, once seen this session
  let error = null // { kind: 'too-large', bytes } | { kind: 'server', message }
  let failures = 0
  let debounce = null
  let retry = null
  let inFlight = null
  let again = false
  let generation = 0 // bumped by login/logout: a reply from before is ignored
  let status = null
  let opened = null // the state the app opened with (attach): the base for a pull-first rebase
  let pullFirst = false
  const tabMark = Math.random().toString(36).slice(2) // this tab's `dirtyMark`
  const listeners = new Set()

  function emit() {
    status = null
    for (const listener of listeners) listener()
  }
  function setMeta(patch) {
    const next = { ...meta, ...patch }
    // Review round 1 (#4) — another tab may have marked a change since: re-read, and keep `dirty`
    // unless the last mark is this tab's own (then this tab synced the change it marked).
    const disk = readMeta(storage)
    if (!next.dirty && disk.dirty && disk.dirtyMark && disk.dirtyMark !== tabMark) {
      next.dirty = true
      next.dirtyMark = disk.dirtyMark
    }
    meta = next
    try {
      storage.setItem(META_KEY, JSON.stringify(meta))
    } catch {
      // Not stored: the in-memory meta still holds for this session.
    }
    emit()
  }
  function clearTimers() {
    if (debounce !== null) clearTimer(debounce)
    if (retry !== null) clearTimer(retry)
    debounce = null
    retry = null
  }

  const canRun = () => Boolean(meta.user) && !meta.expired && store !== null && !isUnreadable()

  async function request(method, path, body) {
    // DEC-032 — the single choke point: with unreadable local data, no request leaves the app.
    if (isUnreadable()) return { blocked: true }
    const headers = { accept: 'application/json' }
    if (method !== 'GET') {
      headers['content-type'] = 'application/json'
      headers[CSRF_HEADER] = '1'
    }
    let res
    try {
      res = await fetch(base + path, { method, headers, body, credentials: 'same-origin', cache: 'no-store' })
    } catch {
      return { network: true }
    }
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    return { status: res.status, data }
  }

  // → true when the reply is a success the caller should use; otherwise records why not.
  function settle(r, sentBytes = 0) {
    if (r.blocked) return false
    if (r.network || r.status >= 500) {
      failures += 1
      if (failures <= RETRY_MS.length && retry === null) {
        retry = setTimer(() => {
          retry = null
          run()
        }, RETRY_MS[failures - 1])
      }
      emit()
      return false
    }
    if (r.status === 401) {
      clearTimers()
      setMeta({ expired: true })
      return false
    }
    if (r.status === 413) {
      error = { kind: 'too-large', bytes: sentBytes }
      emit()
      return false
    }
    if (r.status < 200 || r.status >= 300) {
      error = { kind: 'server', message: r.data?.error || `HTTP ${r.status}` }
      emit()
      return false
    }
    failures = 0
    error = null
    return true
  }

  // The server's copy, rebased under whatever changed locally since `sent` was read.
  function rebaseOnto(server, sent) {
    return (prev) => {
      if (deepEqual(prev, server)) return prev
      const mine = norm(prev)
      if (deepEqual(mine, server)) return prev
      const merged = mergeStates(norm(sent), mine, server).state
      return deepEqual(merged, server) ? server : merged
    }
  }

  function accept({ rev, revId = null, state: server }, sent) {
    agreed = server
    const rebase = rebaseOnto(server, sent)
    // Computed here as well, so a sync queued behind this one sends the rebased state even
    // before React has run the store update.
    latest = rebase(latest)
    setMeta({ rev, revId, syncedAt: new Date(now()).toISOString(), dirty: !deepEqual(norm(latest), server) })
    if (store) store.adopt(rebase)
  }

  async function sendNotes() {
    const notes = loadNotes().filter(
      (n) => n && typeof n.timestamp === 'string' && n.timestamp && typeof n.text === 'string' && n.text.trim(),
    )
    if (!notes.length) {
      setMeta({ notesDirty: false })
      return true
    }
    const r = await request('POST', '/api/notes', JSON.stringify({ notes }))
    if (r.status === 401) return settle(r)
    if (r.blocked || r.network || r.status < 200 || r.status >= 300) return false // stays queued
    setMeta({ notesDirty: false })
    return true
  }

  // Review round 1 (#2) — the server is behind this device (a restored backup) and this device has
  // no revision id (a meta from before round 2): take nothing; push on top of the server's rev.
  function serverBehind(serverRev) {
    setMeta({ rev: serverRev, dirty: true, dirtyMark: tabMark })
    again = true
  }

  // Review round 2 — the server's history no longer holds this device's base (a restore reused its
  // rev number, or removed it): take nothing; push, and the server merges without a base.
  function diverged() {
    setMeta({ dirty: true, dirtyMark: tabMark })
    again = true
  }

  const stateUrl = () =>
    meta.revId ? `/api/state?baseRev=${meta.rev}&baseId=${encodeURIComponent(meta.revId)}` : '/api/state'

  // → true when the GET reply says the server's history no longer matches this device's base.
  function historyGone(data) {
    if (data.baseOk === false) {
      // Review round 3 — base PRUNED and nothing to send here: the server's copy descends from
      // this device's, so take it (as before round 2). Pushing a stale copy through the no-base
      // merge would bring back records other devices deleted. Restored history, or a change waiting
      // here: push, and the server merges without a base.
      if (data.baseGone === 'pruned' && !meta.dirty) return false
      diverged()
      return true
    }
    if (!meta.revId && data.rev < meta.rev) {
      serverBehind(data.rev)
      return true
    }
    return false
  }

  async function syncState(gen) {
    if (pullFirst) {
      // Review round 1 (#1) — the stored copy is behind this meta (a failed save): pull the server's
      // copy first and rebase what changed since the app opened (base = what it opened with).
      const r = await request('GET', stateUrl())
      if (gen !== generation || !settle(r)) return
      pullFirst = false
      if (historyGone(r.data)) return
      accept(r.data, opened)
      if (!deepEqual(norm(latest), r.data.state)) again = true
      return
    }
    const sent = latest
    const changedHere = meta.dirty || (agreed !== null && !deepEqual(norm(sent), agreed))
    if (changedHere) {
      const body = JSON.stringify({ baseRev: meta.rev, ...(meta.revId ? { baseId: meta.revId } : {}), state: sent })
      const size = bytes(body)
      if (size > MAX_BYTES) {
        error = { kind: 'too-large', bytes: size }
        emit()
        return
      }
      const r = await request('PUT', '/api/state', body)
      if (gen !== generation) return
      if (r.status === 409) {
        // baseRev ahead of the server and no revision id sent (a meta from before round 2): it went
        // back (a restore). Push on top of its current rev.
        const g = await request('GET', '/api/state')
        if (gen !== generation || !settle(g)) return
        return serverBehind(g.data.rev)
      }
      if (!settle(r, size)) return
      accept(r.data, sent)
      return
    }
    // Nothing changed here since the last sync: only look for a newer server copy.
    const r = await request('GET', stateUrl())
    if (gen !== generation || !settle(r)) return
    if (historyGone(r.data)) return
    if (r.data.rev === meta.rev && deepEqual(norm(sent), r.data.state)) {
      agreed = r.data.state
      setMeta({ syncedAt: new Date(now()).toISOString() })
      return
    }
    // A newer rev — or the same rev with a local copy that isn't the server's while nothing is
    // marked changed (review round 1 #1: a save lost to a full storage): take the server's copy.
    accept(r.data, sent)
  }

  async function once() {
    const gen = generation
    await syncState(gen)
    // Review round 1 (#8) — notes after the state, and a note failure never stops the state sync.
    if (gen === generation && meta.notesDirty && canRun()) await sendNotes()
  }

  function run() {
    if (!canRun()) return Promise.resolve()
    if (debounce !== null) {
      clearTimer(debounce)
      debounce = null
    }
    if (inFlight) {
      again = true
      return inFlight
    }
    inFlight = (async () => {
      try {
        do {
          again = false
          await once()
        } while (again && canRun())
      } finally {
        inFlight = null
        emit()
      }
    })()
    emit()
    return inFlight
  }

  function schedule() {
    if (!canRun()) return
    if (debounce !== null) clearTimer(debounce)
    debounce = setTimer(() => {
      debounce = null
      run()
    }, DEBOUNCE_MS)
  }

  const unsubscribeSaved = subscribeSaved((state, saved = true) => {
    latest = state
    const dirty = agreed === null ? true : !deepEqual(norm(state), agreed)
    const patch = {}
    if (dirty) Object.assign(patch, { dirty: true, dirtyMark: tabMark })
    else if (meta.dirty) patch.dirty = false
    if (meta.diskBehind !== !saved) patch.diskBehind = !saved
    if (Object.keys(patch).length) setMeta(patch)
    if (dirty) schedule()
  })

  async function login(username, password) {
    loadLocal() // sets the DEC-032 latch if the stored data can't be read
    if (isUnreadable()) return { error: LOGIN_UNREADABLE }
    const gen = ++generation
    clearTimers()
    const r = await request('POST', '/api/login', JSON.stringify({ username, password }))
    if (r.network || r.status >= 500) return { error: LOGIN_OFFLINE }
    if (r.status !== 200) return { error: r.data?.error || `Login failed (HTTP ${r.status}).` }
    const user = r.data.username
    if (meta.syncedUser === user) {
      // The same user again (after a logout or an expired session): a normal sync, so anything
      // made while logged out goes up now.
      setMeta({ user, expired: false })
      run()
      return { ok: true }
    }
    // DEC-132 §1 — first login on this device: take the server's copy; an empty account gets ours.
    const g = await request('GET', '/api/state')
    if (gen !== generation) return { error: LOGIN_OFFLINE }
    if (g.network || g.status !== 200) return { error: g.data?.error || LOGIN_OFFLINE }
    let taken = g.data
    if (g.data.rev === 0) {
      const local = store ? latest : loadLocal()
      const body = JSON.stringify({ baseRev: 0, state: local })
      if (bytes(body) > MAX_BYTES) return { error: 'Too much data to send to the server.' }
      const p = await request('PUT', '/api/state', body)
      if (gen !== generation) return { error: LOGIN_OFFLINE }
      if (p.network || p.status !== 200) return { error: p.data?.error || LOGIN_OFFLINE }
      taken = p.data
    }
    agreed = taken.state
    latest = taken.state
    if (store) store.adopt(() => taken.state)
    else saveLocal(taken.state)
    failures = 0
    error = null
    setMeta({
      user,
      syncedUser: user,
      rev: taken.rev,
      revId: taken.revId ?? null,
      syncedAt: new Date(now()).toISOString(),
      dirty: false,
      expired: false,
      notesDirty: loadNotes().length > 0,
    })
    if (meta.notesDirty) run()
    return { ok: true }
  }

  function logout() {
    generation += 1
    clearTimers()
    // Best effort, never awaited: logging out works offline (DEC-132 §3).
    request('POST', '/api/logout', '{}').catch(() => {})
    setMeta({ user: null, expired: false })
  }

  return {
    getStatus() {
      if (!status) {
        status = {
          user: meta.user,
          syncedUser: meta.syncedUser,
          expired: meta.expired,
          dirty: meta.dirty,
          syncedAt: meta.syncedAt,
          rev: meta.rev,
          error,
          syncing: inFlight !== null,
        }
      }
      return status
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    // The store, while the app is mounted: `adopt(fn)` runs `fn(prev) → next` as a store update.
    attach({ state, adopt }) {
      store = { adopt }
      latest = state
      opened = state
      pullFirst = meta.diskBehind
      run()
      return () => {
        store = null
        clearTimers()
      }
    },
    login,
    logout,
    noteSaved() {
      setMeta({ notesDirty: true })
      schedule()
    },
    trigger: () => run(),
    // Tests: run what a debounce would run, now.
    flush: () => run(),
    idle: () => inFlight ?? Promise.resolve(),
    pending: () => debounce !== null,
    dispose() {
      clearTimers()
      unsubscribeSaved()
      listeners.clear()
    },
  }
}
