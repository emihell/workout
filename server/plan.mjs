// req-245 (DEC-141) — the coach's plan change, written to the server DB as a new revision.
//
//   previewPlan   what `ops plan preview|apply` shows: the app's own import preview (Keep my history)
//                 plus counts. Reads only.
//   applyPlan     the same, then — unless refused — a backup (BACKEND rules 5–6) and ONE putState,
//                 fast-forward only from the previewed rev, with `source`/`note` on the revision.
//   revertPlan    a kept revision's setup written back as a new revision, the same way.
//
// The rule both writes follow is Import's "Keep my history" (keptHistoryState, src/exchange.js): the
// plan, exercises, schedule and other setup from the file; the server's logged workouts, drafts and
// workout in progress kept exactly as they are. No second copy of those rules here (DEC-128 §5).
import { rmSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { BACKUP_KIND, BACKUP_VERSION, applyBackup, importPreview, keptHistoryState, previewLines } from '../src/exchange.js'
import { backupDb } from './ops.mjs'
import { ClientError, getRevision, getState, putState, validState } from './store.mjs'

// `source` names who wrote the revision and goes into the backup's name (`before-plan-<source>`,
// ops.mjs REASON: ≤ 40 characters in all). `revert` is the revert command's own.
export const SOURCE = /^[a-z0-9][a-z0-9-]{0,27}$/
export const REVERT = 'revert'

export class PlanRefused extends Error {
  constructor(plan) {
    super(`Refused, nothing written:\n${plan.refusals.map((r) => `  - ${r}`).join('\n')}`)
    this.plan = plan
  }
}

// A plan file → the state in it, through the server's own validator (validState: the app's import
// rules). The app's Export (`{kind, version, exportedAt, state}`) or a bare state. Either way the
// state must carry `exercises` and `routines` arrays: the import validator accepts `{}` as an empty
// state, and applying that would archive or drop the whole plan.
export function readPlanFile(payload) {
  const isExport = payload && typeof payload === 'object' && payload.kind === BACKUP_KIND
  if (isExport && Number(payload.version) !== BACKUP_VERSION) throw new ClientError(400, 'Not a workout-mvp-backup v1 document.')
  const state = isExport ? payload.state : payload
  if (!state || typeof state !== 'object' || !Array.isArray(state.exercises) || !Array.isArray(state.routines)) {
    throw new ClientError(400, 'Not a workout plan: the file’s state needs `exercises` and `routines` arrays.')
  }
  return validState(state)
}

const key = (record, index) => record?.id ?? `#${index}`
const byKey = (records) => new Map((records || []).map((record, index) => [key(record, index), record]))
const loggedHistory = (state) => [...(state?.workouts || []), ...(state?.draftWorkouts || [])]

function diffRecords(before, after) {
  const prev = byKey(before)
  const next = byKey(after)
  let added = 0
  let changed = 0
  for (const [id, record] of next) {
    if (!prev.has(id)) added += 1
    else if (!isDeepStrictEqual(prev.get(id), record)) changed += 1
  }
  return { added, changed, removed: [...prev.keys()].filter((id) => !next.has(id)).length }
}

// The file's logged records that the server doesn't hold as they are: one missing on the server, or
// one with the same id and different content. Records only the server has (logged since the file was
// exported) are not a mismatch — Keep my history keeps them. (unconfirmed: the spec's "workouts
// differ" read as "the file would change history", so a coach file made before today's workout applies.)
export function historyMismatch(file, current) {
  const server = byKey(loggedHistory(current))
  const out = []
  loggedHistory(file).forEach((record, index) => {
    const id = key(record, index)
    if (!server.has(id)) out.push({ id, why: 'not on the server' })
    else if (!isDeepStrictEqual(server.get(id), record)) out.push({ id, why: 'differs from the server’s' })
  })
  return out
}

// Pure: what writing `incoming` over `current` with Keep my history would store, and why it may not.
export function planChange(current, incoming, { archivedAt = new Date().toISOString(), checkFileHistory = true } = {}) {
  const result = validState(keptHistoryState(incoming, current, archivedAt))
  const kept = (state) => ({ workouts: state.workouts || [], draftWorkouts: state.draftWorkouts || [], activeWorkout: state.activeWorkout ?? null })
  const workoutsIdentical = isDeepStrictEqual(kept(result), kept(current))

  const refusals = []
  if (current.activeWorkout) {
    refusals.push('A workout is in progress (the server’s activeWorkout). A live workout is never changed under the phone: finish or discard it, sync, then run this again.')
  }
  const mismatch = checkFileHistory ? historyMismatch(incoming, current) : []
  if (mismatch.length) {
    const list = mismatch.slice(0, 5).map((m) => `${m.id} (${m.why})`).join(', ')
    refusals.push(`The file’s logged history differs from the server’s: ${mismatch.length} record(s) — ${list}${mismatch.length > 5 ? ', …' : ''}. Export the current state and make the change on that.`)
  }
  if (!workoutsIdentical) refusals.push('The result’s logged history is not identical to the server’s.')

  // The lines the app's Import shows for Keep my history: the file with the server's history in it, so
  // "Logged history" and "Workout in progress" read as what this write does (unchanged).
  const shown = applyBackup({ kind: BACKUP_KIND, version: BACKUP_VERSION, state: { ...incoming, ...kept(current) } }).state
  const lines = previewLines(importPreview(current, shown), 'keep')

  const before = byKey(current.routines)
  const counts = {
    routines: {
      ...diffRecords(current.routines, result.routines),
      archived: (result.routines || []).filter((r) => r.archivedAt && !before.get(r.id)?.archivedAt).length,
    },
    exercises: diffRecords(current.exercises, result.exercises),
    slots: { before: (current.schedule?.slots || []).length, after: (result.schedule?.slots || []).length },
    workouts: (current.workouts || []).length,
    workoutsIdentical,
    activeWorkout: Boolean(current.activeWorkout),
  }
  return { result, lines, counts, refusals, unchanged: isDeepStrictEqual(result, current) }
}

// Reads only (works on a read-only DB handle).
export function previewPlan(db, userId, incoming, options) {
  const current = getState(db, userId)
  return { rev: current.rev, revId: current.revId, ...planChange(current.state, incoming, options) }
}

function checkMeta(source, note) {
  if (!SOURCE.test(String(source ?? ''))) throw new Error(`--source: lower-case letters, digits and dashes, ≤ 28 characters (got "${source ?? ''}").`)
  if (typeof note !== 'string' || !note.trim()) throw new Error('--note: say what changed and why.')
}

// → the preview plus {written, rev, backup}. Refused (PlanRefused) before any backup is taken. A
// device push that lands between the preview and the write makes putState refuse (fastForwardOnly)
// and the backup just taken is removed — no backup is left claiming a write that didn't happen.
export async function applyPlan(db, dataDir, userId, incoming, { source, note, at = new Date(), checkFileHistory = true, reserved = false } = {}) {
  checkMeta(source, note)
  if (source === REVERT && !reserved) throw new Error('--source revert is the revert command’s own.')
  const plan = previewPlan(db, userId, incoming, { archivedAt: at.toISOString(), checkFileHistory })
  if (plan.refusals.length) throw new PlanRefused(plan)
  if (plan.unchanged) return { ...plan, fromRev: plan.rev, written: false }
  const backup = await backupDb(dataDir, `before-plan-${source}`, { at })
  try {
    const body = { baseRev: plan.rev, ...(plan.revId ? { baseId: plan.revId } : {}), state: plan.result }
    const out = putState(db, userId, body, at, { source, note: note.trim(), fastForwardOnly: true })
    return { ...plan, fromRev: plan.rev, written: !out.unchanged, rev: out.rev, backup: backup.file }
  } catch (error) {
    rmSync(backup.file, { force: true })
    throw error
  }
}

// `plan revert <rev>`: that revision's setup back, Keep my history again (history logged since stays).
// Its own logged history is not compared — it is older than the server's by design.
export async function revertPlan(db, dataDir, userId, rev, { note, at = new Date() } = {}) {
  const row = getRevision(db, userId, rev)
  if (!row) throw new Error(`Revision ${rev} is not kept (pruned, or never written). GET /api/revisions lists the kept ones.`)
  return applyPlan(db, dataDir, userId, row.state, {
    source: REVERT,
    note: note?.trim() || `revert to rev ${rev}`,
    at,
    checkFileHistory: false,
    reserved: true,
  })
}
