// req-230 — the two builds from one code base, checked on the BUILT files:
//   plain (`npm run build`, no WORKOUT_SYNC): no login screen, no sync code, no service worker.
//   req-238: this was the GitHub Pages build until that mode was removed (DEC-135).
//   server (WORKOUT_SYNC=true): all three, and sw.js caches every built file.
// Then the built sw.js itself, run in a fake service-worker scope: what it caches, what it
// serves offline, what it never touches (/api), and that a new version waits (no skipWaiting).
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { syncEnabled } from '../../vite.config.js'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

function build(env) {
  const out = mkdtempSync(join(tmpdir(), 'workout-req230-build-'))
  const clean = { ...process.env }
  delete clean.WORKOUT_SYNC
  execFileSync(process.execPath, [VITE, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: ROOT,
    env: { ...clean, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  return out
}
const files = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1))
    .sort()
const scripts = (dir) => files(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')

let plain
let serverBuild
before(() => {
  plain = build({})
  serverBuild = build({ WORKOUT_SYNC: 'true' })
})
after(() => {
  for (const dir of [plain, serverBuild]) if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('req-230 — the build switch', () => {
  it('sync is on only with WORKOUT_SYNC=true', () => {
    assert.equal(syncEnabled({}), false)
    assert.equal(syncEnabled({ WORKOUT_SYNC: 'false' }), false)
    assert.equal(syncEnabled({ WORKOUT_SYNC: 'true' }), true)
  })

  it('1. the plain build: no login screen, no request to the server, no service worker', () => {
    const js = scripts(plain)
    assert.ok(js.length > 100000, 'the app is there')
    for (const marker of ['/api/', 'Log in', 'workout-sync-v1', 'serviceWorker', 'x-workout-request', 'sw.js']) {
      assert.equal(js.includes(marker), false, `plain bundle contains ${marker}`)
    }
    assert.equal(existsSync(join(plain, 'sw.js')), false)
    assert.match(readFileSync(join(plain, 'index.html'), 'utf8'), /src="\/assets\//, 'served from /')
  })

  it('the server build has them, and sw.js lists every built file', () => {
    const js = scripts(serverBuild)
    for (const marker of ['/api/state', 'Log in', 'workout-sync-v1', 'serviceWorker']) assert.ok(js.includes(marker), marker)
    const sw = readFileSync(join(serverBuild, 'sw.js'), 'utf8')
    const listed = JSON.parse(/const FILES = (\[.*\])/.exec(sw)[1])
    assert.deepEqual(listed, files(serverBuild).filter((f) => f !== 'sw.js'))
    assert.match(readFileSync(join(serverBuild, 'index.html'), 'utf8'), /src="\/assets\//)
  })
})

// A minimal service-worker scope for the built sw.js.
function swScope(source, { network }) {
  const stores = new Map()
  const handlers = {}
  const cacheFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    const key = (req) => new URL(typeof req === 'string' ? req : req.url, 'https://app.test/').href
    return {
      addAll: async (urls) => {
        for (const u of urls) store.set(key(u), `cached:${new URL(u, 'https://app.test/').pathname}`)
      },
      match: async (req) => store.get(key(req)),
    }
  }
  let skipWaiting = 0
  const self = {
    location: { origin: 'https://app.test', href: 'https://app.test/sw.js' },
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: () => (skipWaiting += 1),
    clients: { claim: async () => {} },
  }
  const caches = {
    open: async (name) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  }
  const context = vm.createContext({ self, caches, fetch: network, URL, Promise, console })
  vm.runInContext(source, context)
  async function dispatch(type, extra = {}) {
    let waited = null
    let responded = null
    const event = { ...extra, waitUntil: (p) => (waited = p), respondWith: (p) => (responded = p) }
    handlers[type](event)
    if (waited) await waited
    return responded ? await responded : undefined
  }
  return { stores, dispatch, skipWaiting: () => skipWaiting }
}

describe('req-230 §2 — the built service worker', () => {
  it('caches the app on install, serves it with no network, never touches /api, and a new version waits', async () => {
    const source = readFileSync(join(serverBuild, 'sw.js'), 'utf8')
    let online = true
    const network = async (req) => {
      if (!online) throw new TypeError('offline')
      return `network:${req.url}`
    }
    const sw = swScope(source, { network })
    await sw.dispatch('install')
    const [name] = sw.stores.keys()
    const cached = [...sw.stores.get(name).keys()].map((u) => new URL(u).pathname).sort()
    const expected = ['/', ...files(serverBuild).filter((f) => f !== 'sw.js' && f !== 'index.html').map((f) => `/${f}`)].sort()
    assert.deepEqual(cached, expected)

    online = false
    const page = await sw.dispatch('fetch', { request: { url: 'https://app.test/?x=1', method: 'GET', mode: 'navigate' } })
    assert.equal(page, 'cached:/', 'the app opens offline')
    const asset = files(serverBuild).find((f) => f.startsWith('assets/') && f.endsWith('.js'))
    assert.equal(await sw.dispatch('fetch', { request: { url: `https://app.test/${asset}`, method: 'GET', mode: 'no-cors' } }), `cached:/${asset}`)
    for (const request of [
      { url: 'https://app.test/api/state', method: 'GET', mode: 'cors' },
      { url: 'https://app.test/api/state', method: 'PUT', mode: 'cors' },
      { url: 'https://other.test/x.js', method: 'GET', mode: 'no-cors' },
    ]) {
      assert.equal(await sw.dispatch('fetch', { request }), undefined, `${request.method} ${request.url} goes to the network untouched`)
    }

    // An older version's cache is removed on activate. It never skips waiting on its own
    // (install/activate/fetch) — review round 1 (#6): only when the page asks.
    sw.stores.set('workout-app-old', new Map())
    await sw.dispatch('activate')
    assert.deepEqual([...sw.stores.keys()], [name])
    assert.equal(sw.skipWaiting(), 0, 'not on install, activate or fetch')
    await sw.dispatch('message', { data: { type: 'other' } })
    assert.equal(sw.skipWaiting(), 0)
    await sw.dispatch('message', { data: { type: 'SKIP_WAITING' } })
    assert.equal(sw.skipWaiting(), 1, 'the page’s SKIP_WAITING activates the new version')
  })
})
