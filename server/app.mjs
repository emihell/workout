// req-229 — the HTTP API (node:http, no framework).
//
//   GET  /api/health                → {ok, revisions}            (no auth, no auth details)
//   POST /api/register {code, username, password}  → session cookie
//   POST /api/login    {username, password}        → session cookie
//   POST /api/logout                                → cookie cleared, session deleted
//   GET  /api/me                    → {username}
//   GET  /api/state                 → {rev, state}
//   PUT  /api/state {baseRev, state} → {rev, state, merged, conflicts[, unchanged]}
//   GET  /api/revisions             → [{rev, baseRev, merged, conflicts, createdAt}]
//   GET  /api/revisions/:rev        → {rev, …, conflicts, state}
//   GET  /api/export                → the app's Export file
//   GET  /api/notes, POST /api/notes
//
// Every write (any method but GET/HEAD) passes the CSRF guard first: the custom header
// `X-Workout-Request: 1` (a cross-site page can't send it without a CORS preflight, which this
// server never answers), JSON content type, and — when the browser sends them — an Origin whose
// host is ours and a Sec-Fetch-Site of same-origin.
import { createServer } from 'node:http'
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
  getState,
  listRevisions,
  putState,
  revisionTotal,
} from './store.mjs'

export const COOKIE = 'workout_session'
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

export function readCookie(header, name = COOKIE) {
  for (const part of String(header ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at > -1 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim()
  }
  return null
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

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new ClientError(413, 'Request too large.')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ClientError(400, 'Request body is not JSON.')
  }
}

export function createApp({ db, secret }) {
  const authed = (req) => sessionUser(db, secret, readCookie(req.headers.cookie))

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
      deleteSession(db, secret, readCookie(req.headers.cookie))
      return [200, { ok: true }, { 'set-cookie': CLEARED_COOKIE }]
    },

    'GET /api/me': (req, body, user) => [200, { username: user.username }],
    'GET /api/state': (req, body, user) => [200, getState(db, user.id)],
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
    if (!PUBLIC.has(key)) {
      user = authed(req)
      if (!user) return send(res, 401, { error: 'Not signed in.' })
    }
    const body = write ? await readJson(req) : null
    if (handler === 'rev') {
      const found = getRevision(db, user.id, rev)
      return found ? send(res, 200, found) : send(res, 404, { error: 'Not found.' })
    }
    const [status, payload, headers] = await handler(req, body, user)
    return send(res, status, payload, headers)
  }

  return async (req, res) => {
    try {
      await handle(req, res)
    } catch (error) {
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
