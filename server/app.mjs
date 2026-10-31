// req-229 — the HTTP API (node:http, no framework).
//
//   GET  /api/health                → {ok, revisions}            (no auth, no auth details)
//   POST /api/register {code, username, password}  → session cookie
//   POST /api/login    {username, password}        → session cookie
//   POST /api/logout                                → cookie cleared, session deleted
//   GET  /api/me                    → {username}
//   GET  /api/state[?baseRev&baseId] → {rev, revId, state[, baseOk]}  (req-230 review round 2)
//   PUT  /api/state {baseRev, state[, conflicts]} → {rev, state, merged, conflicts[, unchanged]}  (conflicts: req-268)
//   GET  /api/revisions             → [{rev, baseRev, merged, conflicts, createdAt, source, note}]  (req-245)
//   GET  /api/revisions/:rev        → {rev, …, conflicts, state}
//   GET  /api/export                → the app's Export file
//   GET  /api/notes, POST /api/notes
//   GET  anything else              → the built app from `appDir` (req-230: same origin, so the
//                                     Secure; SameSite=Strict cookie works; no auth — the app
//                                     shell holds no data)
//
// Every write (any method but GET/HEAD) passes the CSRF guard first: the custom header
// `X-Workout-Request: 1` (a cross-site page can't send it without a CORS preflight, which this
// server never answers), JSON content type, and — when the browser sends them — an Origin whose
// host is ours and a Sec-Fetch-Site of same-origin.
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { dateKey } from '../src/schedule.js'
import {
  INVITE_INVALID,
  LOGIN_FAILED,
  SESSION_DAYS,
  USERNAME_TAKEN,
  checkLogin,
  createSession,
  deleteSession,
  registerUser,
  sessionUser,
} from './auth.mjs'
import {
  ClientError,
  addNotes,
  exportFile,
  getNotes,
  getRevision,
  getStateFor,
  listRevisions,
  putState,
  revisionTotal,
} from './store.mjs'

// req-231 — cookies don't isolate by port: every `tailscale serve` port on this Mac (:443 previews,
// :8443 White Sleeve, :8444, :8445, :8446 us) is one host to the browser. `__Host-` makes the browser
// refuse any variant of this name that isn't Secure, Path=/ and host-only, so another service can't
// plant one with a more specific path (sent first) or for a parent domain; readCookies takes every
// value of the name and the session is the one that is valid here. Residual (review): a co-hosted
// service still receives our cookie, and it CAN overwrite `__Host-workout_session` (same host,
// Secure, Path=/), which logs this app out — a denial of service, not an impersonation: a value it
// sets is no session here. All of them are this Mac's own processes (BACKEND rule 3, tailnet-only).
export const COOKIE = '__Host-workout_session'
export const CSRF_HEADER = 'x-workout-request'
export const MAX_BODY = 20 * 1024 * 1024

function send(res, status, body, headers = {}) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  })
  res.end(text)
}

function sessionCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`
}
const CLEARED_COOKIE = `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

// Every value sent under `name`, in header order (a browser sends a more specific path first).
export function readCookies(header, name = COOKIE) {
  const values = []
  for (const part of String(header ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at > -1 && part.slice(0, at).trim() === name) values.push(part.slice(at + 1).trim())
  }
  return values
}

// → null when the write may proceed, else [status, message].
export function csrfProblem(req) {
  if (req.headers[CSRF_HEADER] !== '1') return [403, 'Missing request header.']
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return [403, 'Cross-site request refused.']
  const origin = req.headers.origin
  if (origin) {
    let host
    try {
      host = new URL(origin).host
    } catch {
      return [403, 'Cross-site request refused.']
    }
    const ours = [req.headers.host, req.headers['x-forwarded-host']].filter(Boolean)
    if (!ours.includes(host)) return [403, 'Cross-site request refused.']
  }
  const type = String(req.headers['content-type'] ?? '')
  if (!/^application\/json\b/i.test(type)) return [415, 'Expected application/json.']
  return null
}

// Review round 1: a too-large body is refused WITHOUT reading the rest, so the connection can't
// be reused — the 413 says `connection: close` and the socket is destroyed once it is sent.
class TooLarge extends ClientError {
  constructor() {
    super(413, 'Request too large.')
  }
}

async function readJson(req, maxBody) {
  const declared = Number(req.headers['content-length'])
  if (declared > maxBody) throw new TooLarge()
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBody) throw new TooLarge()
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new ClientError(400, 'Request body is not JSON.')
  }
  // Review round 1: every write takes a JSON object (`null`, a number, an array → 400, not a
  // TypeError deeper in).
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ClientError(400, 'Request body must be a JSON object.')
  }
  return body
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
}

// req-230 — one file of the built app, or null. Never outside `appDir` (a `..` or an encoded one
// resolves outside and is refused). `/` is index.html; the app routes by hash, so no fallback.
async function appFile(appDir, pathname) {
  let path
  try {
    path = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (path.includes('\0')) return null
  const root = resolve(appDir)
  const file = resolve(root, `.${path === '/' ? '/index.html' : path}`)
  if (!file.startsWith(root + sep)) return null
  try {
    if (!(await stat(file)).isFile()) return null
    return { file, body: await readFile(file) }
  } catch {
    return null
  }
}

async function serveApp(appDir, req, res, pathname) {
  const found = appDir ? await appFile(appDir, pathname) : null
  if (!found) return send(res, 404, { error: 'Not found.' })
  // Hashed build files never change; index.html and sw.js must be checked on every load so a
  // new version is seen (the service worker decides when it takes over).
  const immutable = pathname.startsWith('/assets/')
  res.writeHead(200, {
    'content-type': TYPES[extname(found.file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    'content-length': found.body.length,
  })
  res.end(req.method === 'HEAD' ? undefined : found.body)
}

export function createApp({ db, secret, maxBody = MAX_BODY, appDir = null }) {
  // → {user, token} for a live session (its expiry just pushed SESSION_DAYS out), else null.
  // req-231 — any of the values sent under our name (see COOKIE).
  const authed = (req) => {
    for (const token of readCookies(req.headers.cookie)) {
      const user = sessionUser(db, secret, token)
      if (user) return { user, token }
    }
    return null
  }

  const routes = {
    'GET /api/health': () => [200, { ok: true, revisions: revisionTotal(db) }],

    'POST /api/register': async (req, body) => {
      try {
        const user = await registerUser(db, secret, body)
        return [201, { username: user.username }, { 'set-cookie': sessionCookie(createSession(db, secret, user.id)) }]
      } catch (error) {
        if (error instanceof ClientError) throw error
        const status = error.message === USERNAME_TAKEN ? 409 : error.message === INVITE_INVALID ? 403 : 400
        throw new ClientError(status, error.message)
      }
    },

    'POST /api/login': async (req, body) => {
      const user = await checkLogin(db, body)
      if (!user) return [401, { error: LOGIN_FAILED }]
      return [200, { username: user.username }, { 'set-cookie': sessionCookie(createSession(db, secret, user.id)) }]
    },

    'POST /api/logout': (req) => {
      for (const token of readCookies(req.headers.cookie)) deleteSession(db, secret, token)
      return [200, { ok: true }, { 'set-cookie': CLEARED_COOKIE }]
    },

    'GET /api/me': (req, body, user) => [200, { username: user.username }],
    'GET /api/state': (req, body, user) => [200, getStateFor(db, user.id, new URL(req.url, 'http://localhost').searchParams)],
    'PUT /api/state': (req, body, user) => [200, putState(db, user.id, body)],
    'GET /api/revisions': (req, body, user) => [200, listRevisions(db, user.id)],
    'GET /api/export': (req, body, user) => [
      200,
      exportFile(db, user.id),
      { 'content-disposition': `attachment; filename="workout-database-${dateKey(new Date())}.json"` },
    ],
    'GET /api/notes': (req, body, user) => [200, getNotes(db, user.id)],
    'POST /api/notes': (req, body, user) => [200, addNotes(db, user.id, body)],
  }
  const PUBLIC = new Set(['GET /api/health', 'POST /api/register', 'POST /api/login', 'POST /api/logout'])

  async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost')
    const method = req.method === 'HEAD' ? 'GET' : req.method
    if (method === 'GET' && pathname !== '/api' && !pathname.startsWith('/api/')) {
      return serveApp(appDir, req, res, pathname)
    }
    let key = `${method} ${pathname}`
    let rev = null
    const revMatch = /^\/api\/revisions\/(\d+)$/.exec(pathname)
    if (revMatch) {
      key = `${method} /api/revisions/:rev`
      rev = Number(revMatch[1])
    }
    const handler = key === 'GET /api/revisions/:rev' ? 'rev' : routes[key]
    if (!handler) {
      const known = Object.keys(routes).some((k) => k.endsWith(` ${pathname}`)) || revMatch
      return send(res, known ? 405 : 404, { error: known ? 'Method not allowed.' : 'Not found.' })
    }
    const write = method !== 'GET'
    if (write) {
      const problem = csrfProblem(req)
      if (problem) return send(res, problem[0], { error: problem[1] })
    }
    let user = null
    // Review round 1: the session's expiry slides on use (auth.mjs sessionUser), so the cookie's
    // Max-Age is re-sent on every authenticated response — the browser's copy slides with it.
    let refresh = {}
    if (!PUBLIC.has(key)) {
      const session = authed(req)
      if (!session) return send(res, 401, { error: 'Not signed in.' })
      user = session.user
      refresh = { 'set-cookie': sessionCookie(session.token) }
    }
    const body = write ? await readJson(req, maxBody) : null
    if (handler === 'rev') {
      const found = getRevision(db, user.id, rev)
      return found ? send(res, 200, found, refresh) : send(res, 404, { error: 'Not found.' }, refresh)
    }
    const [status, payload, headers] = await handler(req, body, user)
    return send(res, status, payload, { ...refresh, ...headers })
  }

  return async (req, res) => {
    try {
      await handle(req, res)
    } catch (error) {
      if (error instanceof TooLarge) {
        res.once('finish', () => req.socket.destroy())
        return send(res, 413, { error: error.message }, { connection: 'close' })
      }
      if (error instanceof ClientError) return send(res, error.status, { error: error.message })
      console.error(error)
      if (!res.headersSent) send(res, 500, { error: 'Server error.' })
      else res.end()
    }
  }
}

export function createHttpServer(deps) {
  return createServer(createApp(deps))
}
