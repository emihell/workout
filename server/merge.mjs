// req-229 §5 (DEC-128 §2) — the three-way merge of one user's state. Pure: no I/O, no clock.
//
//   base   = the state the incoming device last synced (its `baseRev`)
//   mine   = the incoming state (the newest edit)
//   theirs = the server's current state
//
// Top-level arrays whose elements all carry a unique `id` (exercises, routines, workouts,
// draftWorkouts, plannedWorkouts) merge per id; every other field (schedule, activeWorkout,
// legacyRecommendations, schemaVersion, …) is ONE record. For each record:
//   - same on both sides            → that value
//   - changed on one side only      → that side (a deletion is a change)
//   - changed on both, differently  → the incoming one wins, and the losing (current) version is
//                                     listed in `conflicts` — nothing is dropped silently.
// "Changed" is deep inequality against the base. The server computes nothing new: every value
// in the result is one of the three inputs' values, verbatim.
import { isDeepStrictEqual } from 'node:util'

const same = (a, b) => isDeepStrictEqual(a, b)

function idCollection(value) {
  if (!Array.isArray(value)) return null
  const byId = new Map()
  for (const element of value) {
    if (element === null || typeof element !== 'object' || Array.isArray(element)) return null
    if (typeof element.id !== 'string' && typeof element.id !== 'number') return null
    if (byId.has(element.id)) return null
    byId.set(element.id, element)
  }
  return byId
}

// One record's outcome. `undefined` = absent (deleted / never existed).
function resolve(b, m, t) {
  if (same(m, t)) return { value: m }
  if (same(m, b)) return { value: t }
  if (same(t, b)) return { value: m }
  return { value: m, conflict: true }
}

// Review round 2 — the schedule when the base has NO anchor (the rev-0 document): every real
// device state carries one (emptyState() makes it, loadState saves it — src/persistence.js), so
// an anchor present only because the base had none is not an edit. Changes are judged ignoring
// `anchor`; the value stored is still one side's schedule verbatim, anchor included (rule 9).
// Neither side really changed → the current side's schedule if it has an anchor (what other
// devices already hold), else the incoming one.
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
function withoutAnchor(schedule) {
  if (!isPlain(schedule)) return schedule
  const { anchor: _anchor, ...rest } = schedule
  return rest
}
function resolveSchedule(b, m, t) {
  if (!isPlain(b) || 'anchor' in b) return resolve(b, m, t)
  if (same(m, t)) return { value: m }
  const mChanged = !same(withoutAnchor(m), b)
  const tChanged = !same(withoutAnchor(t), b)
  if (!mChanged && !tChanged) return { value: isPlain(t) && t.anchor ? t : m }
  if (!mChanged) return { value: t }
  if (!tChanged) return { value: m }
  if (same(withoutAnchor(m), withoutAnchor(t))) return { value: m }
  return { value: m, conflict: true }
}

function conflictKind(b, m, t) {
  if (b === undefined) return 'added-on-both'
  if (m === undefined) return 'deleted-vs-edited'
  if (t === undefined) return 'edited-vs-deleted'
  return 'edited-on-both'
}

// Order: the incoming array's order for what it kept, with records only the current side has
// (added there) placed after their nearest kept predecessor in the current array.
function mergedOrder(mineArr, theirsArr, keep) {
  const out = mineArr.map((r) => r.id).filter((id) => keep.has(id))
  const placed = new Set(out)
  let after = null
  for (const record of theirsArr) {
    if (placed.has(record.id)) {
      after = record.id
      continue
    }
    if (!keep.has(record.id)) continue
    const at = after === null ? 0 : out.indexOf(after) + 1
    out.splice(at, 0, record.id)
    placed.add(record.id)
    after = record.id
  }
  return out
}

function mergeCollection(field, baseArr, mineArr, theirsArr, conflicts) {
  const b = idCollection(baseArr ?? [])
  const m = idCollection(mineArr ?? [])
  const t = idCollection(theirsArr ?? [])
  if (!b || !m || !t) return null // not an id collection on every side → merged as one record
  const ids = new Set([...b.keys(), ...m.keys(), ...t.keys()])
  const kept = new Map()
  for (const id of ids) {
    const bv = b.get(id)
    const mv = m.get(id)
    const tv = t.get(id)
    const { value, conflict } = resolve(bv, mv, tv)
    if (conflict) conflicts.push({ field, id, kind: conflictKind(bv, mv, tv), lost: tv ?? null })
    if (value !== undefined) kept.set(id, value)
  }
  return mergedOrder(mineArr ?? [], theirsArr ?? [], kept).map((id) => kept.get(id))
}

export function mergeStates(base, mine, theirs) {
  const conflicts = []
  const out = {}
  const fields = new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(base)])
  for (const field of fields) {
    const bv = base[field]
    const mv = mine[field]
    const tv = theirs[field]
    const anyArray = [bv, mv, tv].some(Array.isArray)
    const collection = anyArray ? mergeCollection(field, bv, mv, tv, conflicts) : null
    if (collection) {
      out[field] = collection
      continue
    }
    const { value, conflict } = field === 'schedule' ? resolveSchedule(bv, mv, tv) : resolve(bv, mv, tv)
    if (conflict) conflicts.push({ field, id: null, kind: conflictKind(bv, mv, tv), lost: tv ?? null })
    if (value !== undefined) out[field] = value
  }
  return { state: out, conflicts }
}
