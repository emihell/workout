// req-229 — accounts: invite-only users, scrypt passwords, hashed sessions and invite codes.
//
// Passwords: crypto.scrypt with a per-user random salt, stored as `scrypt$N$r$p$salt$hash`.
// Session tokens and invite codes are random; only their HMAC (keyed by the data dir's secret)
// is stored, so a copy of the DB can't be replayed as a login or an invite.
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { inTransaction } from './db.mjs'

const scrypt = promisify(scryptCb)
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }
export const SESSION_DAYS = 90
export const INVITE_DAYS = 7
// DEC-132 §4 (req-230): at least 6 characters — supersedes req-229's 8 (DEC-131).
export const PASSWORD_MIN = 6
const DAY_MS = 24 * 60 * 60 * 1000
const USERNAME = /^[a-z0-9][a-z0-9._-]{0,31}$/

export const LOGIN_FAILED = 'Wrong username or password.'

export function normaliseUsername(name) {
  const username = String(name ?? '').trim().toLowerCase()
  if (!USERNAME.test(username)) {
    throw new Error('Username: 1–32 letters, digits, dot, dash or underscore, starting with a letter or digit.')
  }
  return username
}

export function checkPassword(password) {
  if (typeof password !== 'string' || [...password].length < PASSWORD_MIN) {
    throw new Error(`Password: at least ${PASSWORD_MIN} characters.`)
  }
  return password
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), hash.toString('base64url')].join('$')
}

export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored).split('$')
  if (kind !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = await scrypt(String(password), Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Verified against for an unknown user, so a wrong username costs the same scrypt as a wrong
// password (no timing tell between the two).
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'))

export function keyedHash(secret, value) {
  return createHmac('sha256', secret).update(String(value)).digest('base64url')
}

const now = () => new Date()

export function userCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n
}

export function findUser(db, username) {
  return db.prepare('SELECT id, username, password, disabled FROM users WHERE username = ?').get(username)
}

function insertUser(db, username, passwordHash) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)')
    .run(username, passwordHash, now().toISOString())
  return Number(lastInsertRowid)
}

// The first account. Refused once any user exists — later accounts come through invites.
export async function bootstrapUser(db, { username, password }) {
  const name = normaliseUsername(username)
  const hash = await hashPassword(checkPassword(password))
  return inTransaction(db, () => {
    if (userCount(db) > 0) throw new Error('Bootstrap refused: an account already exists. Use `invite`.')
    return { id: insertUser(db, name, hash), username: name }
  })
}

// A one-use invite code. Only its keyed hash is stored; the code itself is shown once.
export function createInvite(db, secret, { days = INVITE_DAYS, at = now() } = {}) {
  const code = randomBytes(12).toString('base64url')
  db.prepare('INSERT INTO invites (code_hash, created_at, expires_at) VALUES (?, ?, ?)').run(
    keyedHash(secret, code),
    at.toISOString(),
    new Date(at.getTime() + days * DAY_MS).toISOString(),
  )
  return code
}

export const INVITE_INVALID = 'That invite code is not valid.'
export const USERNAME_TAKEN = 'That username is taken.'

export async function registerUser(db, secret, { code, username, password }) {
  const name = normaliseUsername(username)
  const hash = await hashPassword(checkPassword(password))
  return inTransaction(db, () => {
    const invite = db
      .prepare('SELECT code_hash, expires_at, used_by FROM invites WHERE code_hash = ?')
      .get(keyedHash(secret, code ?? ''))
    if (!invite || invite.used_by != null || invite.expires_at <= now().toISOString()) throw new Error(INVITE_INVALID)
    if (findUser(db, name)) throw new Error(USERNAME_TAKEN)
    const id = insertUser(db, name, hash)
    db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code_hash = ?').run(
      id,
      now().toISOString(),
      invite.code_hash,
    )
    return { id, username: name }
  })
}

// Disable an account and end its sessions. Its data stays.
export function disableUser(db, username) {
  const user = findUser(db, normaliseUsername(username))
  if (!user) throw new Error(`No such user: ${username}`)
  inTransaction(db, () => {
    db.prepare('UPDATE users SET disabled = 1 WHERE id = ?').run(user.id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  })
  return { id: user.id, username: user.username }
}

// → the user on a correct password for an enabled account, else null (same for every failure).
export async function checkLogin(db, { username, password }) {
  let name
  try {
    name = normaliseUsername(username)
  } catch {
    name = null
  }
  const user = name ? findUser(db, name) : undefined
  const ok = await verifyPassword(String(password ?? ''), user ? user.password : DUMMY_HASH)
  if (!user || !ok || user.disabled) return null
  return { id: user.id, username: user.username }
}

export function createSession(db, secret, userId, at = now()) {
  const token = randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    keyedHash(secret, token),
    userId,
    at.toISOString(),
    new Date(at.getTime() + SESSION_DAYS * DAY_MS).toISOString(),
  )
  return token
}

// The session's user, or null. Sliding expiry: each use pushes it SESSION_DAYS out again, so a
// phone in regular use stays signed in.
export function sessionUser(db, secret, token, at = now()) {
  if (!token) return null
  const tokenHash = keyedHash(secret, token)
  const row = db
    .prepare(
      `SELECT s.user_id AS id, s.expires_at, u.username, u.disabled
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash)
  if (!row) return null
  if (row.disabled || row.expires_at <= at.toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    return null
  }
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(
    new Date(at.getTime() + SESSION_DAYS * DAY_MS).toISOString(),
    tokenHash,
  )
  return { id: row.id, username: row.username }
}

export function deleteSession(db, secret, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(keyedHash(secret, token))
}
