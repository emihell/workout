// req-230 — rendered: the plain build never calls the network (criterion 1, at run time), and the
// server build's screens — login, the Settings line, Log out, the 401 prompt, unreadable data.
// The real StoreProvider / persistence / App under happy-dom; the server is a mocked fetch here
// (src/sync/engine.test.js runs the engine against a real throwaway server).
import { describe, it, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, importJsx, render } from '../test-support/render.js'
import { fullState } from '../test-support/full-state.js'
import { buildBackup } from '../exchange.js'
import { getLoadUnreadable, loadState, saveState, subscribeSaved } from '../persistence.js'
import { answerConfirm, getPendingConfirm } from '../ui/confirm.js'
import { createSync, META_KEY } from './engine.js'
import { NOT_SYNCED } from './status.js'

const h = React.createElement
const KEY = 'workout-mvp-v9'
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

let view = null
let engine = null
const realFetch = globalThis.fetch
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  window.location.hash = '#/'
})
afterEach(async () => {
  if (getPendingConfirm()) answerConfirm(false)
  if (view) await view.unmount()
  view = null
  engine?.dispose()
  engine = null
  globalThis.fetch = realFetch
})

describe('1. the plain build’s state path never calls the network', () => {
  it('open, edit through the store, Import (both choices), a feedback note, Settings → fetch is never called', async () => {
    const calls = []
    globalThis.fetch = (...args) => {
      calls.push(args)
      throw new Error('the plain build must not call the network')
    }
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    const { default: App } = await importJsx('../App.jsx', import.meta.url)
    const { StoreProvider } = await importJsx('../store.jsx', import.meta.url)
    const { useStore } = await import('../store-context.js')
    const { saveNote } = await import('../dev/dev-notes.js')
    const captured = {}
    function Grab() {
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return null
    }
    view = await render(h(StoreProvider, null, h(Grab)))
    await act(async () => captured.store.addRoutine({ name: 'Offline only', focus: 'Machines' }))
    await act(async () => captured.store.applyBackup(buildBackup(fullState())))
    await act(async () => captured.store.applyBackup(buildBackup(fullState()), { keepHistory: true }))
    saveNote({ text: 'a note', routeInfo: { name: 'today' }, hash: '#/' }, '2026-10-22T10:00:00.000Z')
    await flush()
    await view.unmount()
    window.location.hash = '#/settings'
    view = await render(h(App))
    await flush()
    assert.ok(view.text().includes('Backup & data'))
    assert.equal(view.text().includes('Sync'), false, 'no sync section in the plain build')
    assert.equal(view.button('Log out'), null)
    assert.deepEqual(calls, [])
  })
})

// A mocked server: `routes[method + ' ' + path]` → a Response (or a function of the body).
function mockServer(routes) {
  const log = []
  globalThis.fetch = async (path, init = {}) => {
    log.push(`${init.method} ${path}`)
    const route = routes[`${init.method} ${path}`]
    if (!route) throw new TypeError('fetch failed')
    return typeof route === 'function' ? route(init.body ? JSON.parse(init.body) : null) : route()
  }
  return log
}

function makeEngine() {
  engine = createSync({
    fetch: (...args) => globalThis.fetch(...args),
    storage: localStorage,
    isUnreadable: getLoadUnreadable,
    loadLocal: loadState,
    saveLocal: saveState,
    subscribeSaved,
  })
  return engine
}

async function renderRoot() {
  const { SyncRoot } = await importJsx('./root.jsx', import.meta.url)
  const { ConfirmSheet } = await importJsx('../ui/index.jsx', import.meta.url)
  view = await render(h(React.Fragment, null, h(SyncRoot, { sync: engine }), h(ConfirmSheet)))
  await flush()
  return view
}

describe('the server build’s screens', () => {
  it('no user → the login screen; first login takes the server’s copy and opens the app', async () => {
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    const server = { ...fullState(), routines: [{ id: 'rtn-s', name: 'From the server', focus: 'Machines', archivedAt: null, exercises: [] }] }
    const log = mockServer({
      'POST /api/login': (body) => (body.password === 'sixsix' ? json(200, { username: 'emilio' }) : json(401, { error: 'Wrong username or password.' })),
      'GET /api/state': () => json(200, { rev: 7, state: server }),
    })
    makeEngine()
    await renderRoot()
    assert.ok(view.text().startsWith('Log in'))
    assert.ok(view.input('Username') && view.input('Password'))
    await view.type(view.input('Username'), 'emilio')
    await view.type(view.input('Password'), 'nope!!')
    await view.click(view.button('Log in'))
    await flush()
    assert.ok(view.text().includes('Wrong username or password.'))
    await view.type(view.input('Password'), 'sixsix')
    await view.click(view.button('Log in'))
    await flush()
    assert.equal(view.input('Password'), null, 'the app is open')
    assert.deepEqual(JSON.parse(localStorage.getItem(KEY)).routines, server.routines, 'the device took the server’s copy')
    assert.equal(log.includes('PUT /api/state'), false)
    assert.equal(JSON.parse(localStorage.getItem(META_KEY)).rev, 7)
  })

  it('Settings shows the one status line and Log out; logging out keeps the data and shows the login screen', async () => {
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    localStorage.setItem(META_KEY, JSON.stringify({ user: 'emilio', syncedUser: 'emilio', rev: 4, syncedAt: new Date(Date.now() - 2 * 60000).toISOString() }))
    const log = mockServer({ 'GET /api/state': () => json(200, { rev: 4, state: fullState() }), 'POST /api/logout': () => json(200, { ok: true }) })
    makeEngine()
    window.location.hash = '#/settings'
    await renderRoot()
    const line = view.container.querySelector('[data-sync-status]')
    assert.equal(line.textContent, 'Synced · just now', 'synced on open')
    assert.equal(/conflict/i.test(view.text()), false, 'no conflict banner')
    // Offline with a change waiting: the other line.
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    await act(async () => saveState({ ...fullState(), routines: [] }))
    await flush()
    assert.equal(view.container.querySelector('[data-sync-status]').textContent, NOT_SYNCED)
    const before = localStorage.getItem(KEY)
    await view.click(view.button('Log out'))
    await flush()
    assert.ok(view.text().startsWith('Log in'), 'the login screen')
    assert.equal(localStorage.getItem(KEY), before, 'the data stays on the device')
    assert.equal(JSON.parse(localStorage.getItem(META_KEY)).dirty, true, 'and still goes up at the next login')
    assert.ok(log.includes('GET /api/state'))
  })

  it('6. a 401 → a Log in prompt over the open app; local data byte-identical; Cancel returns', async () => {
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    localStorage.setItem(META_KEY, JSON.stringify({ user: 'emilio', syncedUser: 'emilio', rev: 4, dirty: true }))
    const before = localStorage.getItem(KEY)
    mockServer({ 'PUT /api/state': () => json(401, { error: 'Not signed in.' }) })
    makeEngine()
    await renderRoot()
    assert.ok(view.text().includes("You're logged out on the server — log in to sync. Everything is still saved on this phone."))
    assert.equal(localStorage.getItem(KEY), before)
    await view.click(view.button('Log in'))
    assert.ok(view.text().startsWith('Log in'))
    assert.equal(view.input('Username').value, 'emilio')
    await view.click(view.button('Cancel'))
    assert.ok(view.button('Log in'), 'back on the app, prompt still there')
    assert.equal(localStorage.getItem(KEY), before)
  })

  it('4. unreadable stored data and no user → the app under its banner (Import reachable), no login, no request', async () => {
    localStorage.setItem(KEY, '{not json')
    const log = mockServer({})
    makeEngine()
    loadState() // what boot.jsx does before choosing the screen
    await renderRoot()
    assert.ok(view.text().includes("Couldn't read your saved data."))
    assert.equal(view.input('Password'), null)
    assert.deepEqual(log, [])
    assert.equal(localStorage.getItem(KEY), '{not json')
  })
})

// Review round 1 (#7, DEC-128 §1 — no signal never blocks logging).
describe('review #7 — logged out with no signal', () => {
  const setOnline = (value) => Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  afterEach(() => setOnline(true))

  it('offline, this device synced before → "Continue without syncing" opens the app on its data; changes wait for the next login', async () => {
    const { CONTINUE_OFFLINE, OFFLINE_BANNER } = await importJsx('./root.jsx', import.meta.url)
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    localStorage.setItem(META_KEY, JSON.stringify({ user: null, syncedUser: 'emilio', rev: 4 }))
    const log = mockServer({})
    setOnline(false)
    makeEngine()
    await renderRoot()
    assert.ok(view.text().startsWith('Log in'))
    await view.click(view.button(CONTINUE_OFFLINE))
    assert.equal(view.input('Password'), null, 'the app is open')
    assert.ok(view.text().includes(OFFLINE_BANNER))
    assert.deepEqual(JSON.parse(localStorage.getItem(KEY)), fullState(), 'on the device’s own data')
    await act(async () => saveState({ ...fullState(), routines: [] }))
    assert.equal(JSON.parse(localStorage.getItem(META_KEY)).dirty, true, 'marked: it goes up at the next login')
    assert.deepEqual(log, [], 'nothing sent while logged out')
    await view.click(view.button('Log in'))
    assert.ok(view.text().startsWith('Log in'), 'Log in on the banner returns to the login screen')
  })

  it('online but the server can’t be reached → the login error, then the same way out', async () => {
    const { CONTINUE_OFFLINE } = await importJsx('./root.jsx', import.meta.url)
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    localStorage.setItem(META_KEY, JSON.stringify({ user: null, syncedUser: 'emilio', rev: 4 }))
    mockServer({})
    makeEngine()
    await renderRoot()
    assert.equal(view.button(CONTINUE_OFFLINE), null, 'online: not offered up front')
    await view.type(view.input('Username'), 'emilio')
    await view.type(view.input('Password'), 'sixsix')
    await view.click(view.button('Log in'))
    await flush()
    assert.ok(view.text().includes("Can't reach the server."))
    assert.ok(view.button(CONTINUE_OFFLINE))
  })

  it('a device that never synced (a first login would replace its data) is not offered it', async () => {
    const { CONTINUE_OFFLINE } = await importJsx('./root.jsx', import.meta.url)
    localStorage.setItem(KEY, JSON.stringify(fullState()))
    setOnline(false)
    mockServer({})
    makeEngine()
    await renderRoot()
    assert.equal(view.button(CONTINUE_OFFLINE), null)
  })
})
