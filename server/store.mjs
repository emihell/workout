// req-229 §3–7 — each user's data: the state revisions and the feedback notes.
//
// One row per accepted revision (rev 1, 2, 3 …) per user; the newest is the current document.
// Every query here takes `userId` and filters on it — none reads another user's rows.
// The validator is the app's own `applyBackup` (src/exchange.js): no second copy of the rules.
import { isDeepStrictEqual } from 'node:util'
import { BACKUP_KIND, BACKUP_VERSION, applyBackup, buildBackup } from '../src/exchange.js'
import { emptyState } from '../src/persistence.js'
import { inTransaction } from './db.mjs'
import { mergeStates } from './merge.mjs'

export class ClientError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// The incoming `state` through the app's import validator + migration. A reject → 400 with
// applyBackup's own message.
export function validState(state) {
  try {
    return applyBackup({ kind: BACKUP_KIND, version: BACKUP_VERSION, state }).state
  } catch (error) {
    throw new ClientError(400, error.message)
  }
}

function revisionRow(db, userId, rev) {
  return db
    .prepare('SELECT rev, state, base_rev, merged, conflicts, created_at FROM revisions WHERE user_id = ? AND rev = ?')
    .get(userId, rev)
}

export function currentRev(db, userId) {
  return db.prepare('SELECT COALESCE(MAX(rev), 0) AS rev FROM revisions WHERE user_id = ?').get(userId).rev
}

// → {rev, state}. A user with nothing stored yet is rev 0 with the app's empty state.
export function getState(db, userId) {
  const rev = currentRev(db, userId)
  if (rev === 0) return { rev: 0, state: emptyState() }
  return { rev, state: JSON.parse(revisionRow(db, userId, rev).state) }
}

export function listRevisions(db, userId) {
  return db
    .prepare(
      `SELECT rev, base_rev AS baseRev, merged, conflicts, created_at AS createdAt
       FROM revisions WHERE user_id = ? ORDER BY rev`,
    )
    .all(userId)
    .map((row) => ({
      rev: row.rev,
      baseRev: row.baseRev,
      merged: row.merged === 1,
      conflicts: JSON.parse(row.conflicts).length,
      createdAt: row.createdAt,
    }))
}

export function getRevision(db, userId, rev) {
  const row = revisionRow(db, userId, rev)
  if (!row) return null
  return {
    rev: row.rev,
    baseRev: row.base_rev,
    merged: row.merged === 1,
    conflicts: JSON.parse(row.conflicts),
    createdAt: row.created_at,
    state: JSON.parse(row.state),
  }
}

// PUT /api/state. `baseRev` = the rev the device last synced.
//   baseRev = current → stored as rev+1 (fast-forward).
//   baseRev < current → three-way merge (base = baseRev's state, rev 0 = the empty state),
//                       the result stored as rev+1 with its conflicts.
//   result equals the current state → nothing stored, the current rev returned (`unchanged`).
export function putState(db, userId, body, at = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ClientError(400, 'Expected {baseRev, state}.')
  const { baseRev } = body
  if (!Number.isInteger(baseRev) || baseRev < 0) throw new ClientError(400, 'baseRev must be a whole number ≥ 0.')
  const incoming = validState(body.state)
  return inTransaction(db, () => {
    const current = getState(db, userId)
    if (baseRev > current.rev) throw new ClientError(409, `baseRev ${baseRev} is ahead of the server (rev ${current.rev}).`)
    let state = incoming
    let conflicts = []
    const merged = baseRev < current.rev
    if (merged) {
      const base = baseRev === 0 ? emptyState() : JSON.parse(revisionRow(db, userId, baseRev).state)
      const result = mergeStates(base, incoming, current.state)
      // Re-validated: the merge only recombines valid records, but the stored document always
      // passes the app's own checks.
      state = validState(result.state)
      conflicts = result.conflicts
    }
    if (current.rev > 0 && conflicts.length === 0 && isDeepStrictEqual(state, current.state)) {
      return { rev: current.rev, state: current.state, merged, conflicts, unchanged: true }
    }
    const rev = current.rev + 1
    db.prepare(
      'INSERT INTO revisions (user_id, rev, state, base_rev, merged, conflicts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(userId, rev, JSON.stringify(state), baseRev, merged ? 1 : 0, JSON.stringify(conflicts), at.toISOString())
    return { rev, state, merged, conflicts }
  })
}

export function exportFile(db, userId) {
  return buildBackup(getState(db, userId).state)
}

// ---- feedback notes (src/dev/dev-notes.js record: {route, timestamp, text, context}) ----

function validNote(note) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) throw new ClientError(400, 'A note must be an object.')
  const { route = '', timestamp, text, context = {} } = note
  if (typeof timestamp !== 'string' || !timestamp) throw new ClientError(400, 'A note needs a timestamp.')
  if (typeof text !== 'string' || !text.trim()) throw new ClientError(400, 'A note needs text.')
  if (typeof route !== 'string') throw new ClientError(400, 'A note route must be text.')
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new ClientError(400, 'A note context must be an object.')
  }
  return { route, timestamp, text, context }
}

// POST /api/notes: one note, or `{notes: [...]}`. Appended; a note with the same timestamp +
// text as a stored one is skipped (dedupe), so a device can re-send its whole list safely.
export function addNotes(db, userId, body, at = new Date()) {
  const list = Array.isArray(body?.notes) ? body.notes : [body]
  const notes = list.map(validNote)
  return inTransaction(db, () => {
    const insert = db.prepare(
      `INSERT OR IGNORE INTO notes (user_id, route, timestamp, text, context, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    let added = 0
    for (const n of notes) {
      added += Number(insert.run(userId, n.route, n.timestamp, n.text, JSON.stringify(n.context), at.toISOString()).changes)
    }
    return { added, total: noteCount(db, userId) }
  })
}

function noteCount(db, userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM notes WHERE user_id = ?').get(userId).n
}

// In the order they reached the server.
export function getNotes(db, userId) {
  return db
    .prepare('SELECT route, timestamp, text, context FROM notes WHERE user_id = ? ORDER BY id')
    .all(userId)
    .map((row) => ({ ...row, context: JSON.parse(row.context) }))
}

export function revisionTotal(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM revisions').get().n
}
