// req-229 §3–7 — each user's data: the state revisions and the feedback notes.
//
// One row per accepted revision (rev 1, 2, 3 …) per user; the newest is the current document.
// Every query here takes `userId` and filters on it — none reads another user's rows.
// The validator is the app's own `applyBackup` (src/exchange.js): no second copy of the rules.
import { isDeepStrictEqual } from 'node:util'
import { BACKUP_KIND, BACKUP_VERSION, applyBackup, buildBackup } from '../src/exchange.js'
import { emptyState } from '../src/persistence.js'
import { inTransaction } from './db.mjs'
import { mergeStates, mergeWithoutBase } from './merge.mjs'

export class ClientError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// The incoming `state` through the app's import validator + migration. A reject → 400 with
// applyBackup's own message.
//
// Review round 1 (BACKEND rule 9 — the server stores what the app sent): applyBackup also does
// two import-only things — it drops a running `activeWorkout.stopwatch` (req-194) and defaults a
// missing `schedule.anchor` to this Monday (req-114). Both are undone here, so what is stored and
// returned is the sent state, migrated, with nothing dropped and no clock-made date.
export function validState(state) {
  let valid
  try {
    valid = applyBackup({ kind: BACKUP_KIND, version: BACKUP_VERSION, state }).state
  } catch (error) {
    throw new ClientError(400, error.message)
  }
  const sentStopwatch = state.activeWorkout?.stopwatch
  if (sentStopwatch !== undefined && valid.activeWorkout) {
    valid.activeWorkout = { ...valid.activeWorkout, stopwatch: structuredClone(sentStopwatch) }
  }
  if (!state.schedule?.anchor && valid.schedule && 'anchor' in valid.schedule) {
    const { anchor: _defaulted, ...schedule } = valid.schedule
    valid.schedule = schedule
  }
  // Review round 3: exactly as it will be stored (JSON). migrateState leaves `undefined`-valued
  // keys (e.g. `activeWorkout.routineId` when absent) that the stored base/current don't have;
  // left in, the merge saw every such record as "edited" on the incoming side — a stale device
  // could overwrite a logged set or resurrect a deleted workout.
  return JSON.parse(JSON.stringify(valid))
}

// Review round 1 — the rev-0 document: the app's empty state WITHOUT the clock-made schedule
// anchor, so it is one stable document, identical every time it is used (GET at rev 0 and the
// merge base for baseRev 0). With the anchor, the base moved every Monday and a baseRev-0 push
// a week later read as "changed the schedule".
const REV0 = (() => {
  const state = emptyState()
  const { anchor: _clock, ...schedule } = state.schedule
  return JSON.stringify({ ...state, schedule })
})()
export const revZeroState = () => JSON.parse(REV0)

function revisionRow(db, userId, rev) {
  return db
    .prepare('SELECT rev, state, base_rev, merged, conflicts, created_at FROM revisions WHERE user_id = ? AND rev = ?')
    .get(userId, rev)
}

export function currentRev(db, userId) {
  return db.prepare('SELECT COALESCE(MAX(rev), 0) AS rev FROM revisions WHERE user_id = ?').get(userId).rev
}

// → {rev, state}. A user with nothing stored yet is rev 0 with the stable empty document (REV0).
export function getState(db, userId) {
  const rev = currentRev(db, userId)
  if (rev === 0) return { rev: 0, state: revZeroState() }
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
//   baseRev < current → three-way merge (base = baseRev's state, rev 0 = REV0),
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
      const base = baseState(db, userId, baseRev)
      const result = base ? mergeStates(base, incoming, current.state) : mergeWithoutBase(incoming, current.state)
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
    pruneRevisions(db, userId, at)
    return { rev, state, merged, conflicts }
  })
}

// req-230 — revision growth. Every accepted revision stores the whole document (~200 kB for a
// real history) and the app syncs after each logged set, so old revisions are pruned in the same
// write that adds a new one. KEPT: every revision from the last PRUNE_DAYS days (any device that
// synced in that time can still hold one as its base), the newest revision of each older day
// (UTC), every revision with conflicts (the losing versions, DEC-128 §2), and the current one.
// A device still based on a pruned revision is merged without a base (mergeWithoutBase): nothing
// it can't decide is dropped, and every such record is listed in that revision's conflicts.
export const PRUNE_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export function pruneRevisions(db, userId, at = new Date()) {
  const cutoff = new Date(at.getTime() - PRUNE_DAYS * DAY_MS).toISOString()
  return Number(
    db
      .prepare(
        `DELETE FROM revisions
         WHERE user_id = ? AND created_at < ? AND conflicts = '[]'
           AND rev < (SELECT MAX(rev) FROM revisions WHERE user_id = ?)
           AND rev NOT IN (SELECT MAX(rev) FROM revisions WHERE user_id = ? GROUP BY substr(created_at, 1, 10))`,
      )
      .run(userId, cutoff, userId, userId).changes,
  )
}

// The merge base for `baseRev`: that revision's state, the rev-0 document, or null when the
// revision was pruned (review round 1 #3 — putState then merges WITHOUT a base, recording every
// record it can't decide; an older base would silently undo deletions and lose edits).
function baseState(db, userId, baseRev) {
  if (baseRev === 0) return revZeroState()
  const row = revisionRow(db, userId, baseRev)
  return row ? JSON.parse(row.state) : null
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
