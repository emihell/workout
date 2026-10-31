// req-254 (DEC-145 §4) — `ops plan build`: Coach's short change list → a checked plan file for
// `ops plan preview`. Pure: no DB, no fs; the CLI (ops-cli.mjs) reads the base state and the
// library and writes the file.
//
//   buildPlan(current, changes, {library, makeId, now}) → {state, file, plan, lines, warnings, refusals}
//
// The app's own builders make every record (exerciseFromData + catalogItemToExercise for a library
// exercise, pickerItem for a new routine item, routineItemAdded for its shape) and the server's own
// check (readPlanFile + planChange, what `plan preview` runs) is C7 — no second copy of the rules
// (DEC-128 §5). C1–C6 are this file's: they guard what the ops did, and C2 is computed from the two
// states, not from the op list, so it also catches this file's own bugs.
import { isDeepStrictEqual } from 'node:util'
import { buildBackup } from '../src/exchange.js'
import { catalogItemToExercise } from '../src/exerciseCatalog.js'
import { exerciseFromData } from '../src/exercise-names.js'
import { historyPrescription } from '../src/history-queries.js'
import { ROUTINE_ROLES, uid } from '../src/ids.js'
import { isDurationTarget } from '../src/progress.js'
import { pickerItem } from '../src/routine-picker.js'
import { MAX_SETS } from '../src/routine-item-parse.js'
import { routineItemAdded } from '../src/state-reducers.js'
import { planChange, readPlanFile } from './plan.mjs'

export const CHANGES_KIND = 'workout-plan-changes'
export const CHANGES_VERSION = 1
// DEC-151: an interval under 30 s rest can't be run (the tap delay eats it).
export const MIN_TIMED_REST_SEC = 30

const ITEM_FIELDS = ['sets', 'targets', 'suggestedWeights', 'durations', 'restSec', 'role', 'warmup', 'notes']
const EXERCISE_SET_FIELDS = ['weightStep', 'lightestWeight', 'unilateral', 'hasDuration', 'durationSec', 'cues']
const OPS = {
  'exercise.add': ['op', 'ref', 'libraryId', 'set'],
  'exercise.set': ['op', 'exercise', 'set'],
  'routine.add': ['op', 'ref', 'name', 'focus', 'items'],
  'routine.set': ['op', 'routine', 'set'],
  'routine.items': ['op', 'routine', 'items'],
  'item.set': ['op', 'routine', 'exercise', 'set'],
  'routine.archive': ['op', 'routine'],
  'schedule.set': ['op', 'loopWeeks', 'slots'],
}
const HISTORY_KEYS = ['workouts', 'draftWorkouts', 'activeWorkout', 'plannedWorkouts', 'legacyRecommendations']
const ROLE_VALUES = ROUTINE_ROLES.map((r) => r.value)

class Refusal extends Error {}
const refuse = (message) => {
  throw new Refusal(message)
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isInt = (v) => Number.isInteger(v)
const list = (values) => (values?.length ? values.map(String).join('/') : '—')
const json = (v) => JSON.stringify(v)

function onlyKeys(object, allowed, where) {
  if (!isObject(object)) refuse(`${where}: an object is needed.`)
  const unknown = Object.keys(object).filter((k) => !allowed.includes(k))
  if (unknown.length) refuse(`${where}: unknown field(s) ${unknown.join(', ')} (allowed: ${allowed.join(', ')}).`)
}

// ---- references: by id, by a ref defined earlier in this file, or by exact name (non-archived) ----

function resolve(records, refs, value, noun) {
  if (typeof value !== 'string' || !value) refuse(`A ${noun} reference must be a non-empty string (got ${json(value)}).`)
  const byId = records.find((r) => r.id === value)
  if (byId) return byId
  if (refs.has(value)) return records.find((r) => r.id === refs.get(value))
  const named = records.filter((r) => !r.archivedAt && r.name === value)
  if (named.length === 1) return named[0]
  if (named.length > 1) refuse(`${json(value)} names ${named.length} ${noun}s: ${named.map((r) => r.id).join(', ')} — use the id.`)
  const near = records.filter((r) => String(r.name || '').toLowerCase() === value.toLowerCase())
  refuse(`No ${noun} ${json(value)} (not an id, a ref defined earlier, or the exact name of a non-archived ${noun})${near.length ? `; close: ${near.map((r) => `${r.id} "${r.name}"${r.archivedAt ? ' (archived)' : ''}`).join(', ')}` : ''}.`)
}

function defineRef(refs, ref, id, ids) {
  if (ref === undefined) return
  if (typeof ref !== 'string' || !ref) refuse(`ref: a non-empty string (got ${json(ref)}).`)
  if (refs.has(ref)) refuse(`ref ${json(ref)} is defined twice.`)
  if (ids.has(ref)) refuse(`ref ${json(ref)} is an existing record's id: pick another.`)
  refs.set(ref, id)
}

// ---- field checks (types; C4 shape is checked on the finished items) ----

function checkExerciseSet(set, where) {
  onlyKeys(set, EXERCISE_SET_FIELDS, `${where} set`)
  if ('weightStep' in set && (typeof set.weightStep !== 'string' || !set.weightStep.trim())) refuse(`${where}: weightStep is a non-empty string ("2.5", "Steps A/B", "n/a").`)
  if ('lightestWeight' in set && !(typeof set.lightestWeight === 'number' && set.lightestWeight >= 0)) refuse(`${where}: lightestWeight is a number of kg ≥ 0.`)
  if ('unilateral' in set && typeof set.unilateral !== 'boolean') refuse(`${where}: unilateral is true or false.`)
  if ('hasDuration' in set && typeof set.hasDuration !== 'boolean') refuse(`${where}: hasDuration is true or false.`)
  if ('durationSec' in set && !(isInt(set.durationSec) && set.durationSec > 0)) refuse(`${where}: durationSec is a whole number of seconds > 0.`)
  if ('cues' in set && typeof set.cues !== 'string') refuse(`${where}: cues is a string.`)
}

function itemFields(given, where, withExercise) {
  onlyKeys(given, withExercise ? ['exercise', ...ITEM_FIELDS] : ITEM_FIELDS, where)
  const out = {}
  for (const k of ITEM_FIELDS) if (k in given) out[k] = structuredClone(given[k])
  return out
}

// ---- C4 / C6 / C5 / warnings on one finished item ----

function itemProblems(item, exercise, workouts, before) {
  const refusals = []
  const warnings = []
  const timed = Boolean(exercise?.hasDuration)
  const cardio = exercise?.type === 'cardio'
  const { sets, targets, suggestedWeights: kg, durations, restSec, role, warmup, notes } = item
  // C4 — item shape (CAPABILITIES §How a plan runs).
  if (!isInt(sets) || sets < 1 || sets > MAX_SETS) refusals.push(`sets must be a whole number from 1 to ${MAX_SETS} (got ${json(sets)}).`)
  if (!Array.isArray(targets) || targets.some((t) => typeof t !== 'string')) refusals.push('targets: a list of strings ("10", not 10).')
  else if (isInt(sets) && (targets.length || (!timed && !cardio)) && targets.length !== sets) {
    refusals.push(`targets has ${targets.length} entries for ${sets} sets.`)
  }
  if (!Array.isArray(kg) || kg.some((w) => typeof w !== 'number' || !Number.isFinite(w) || w < 0)) refusals.push('suggestedWeights: a list of kg numbers ≥ 0.')
  else if (kg.length && isInt(sets) && kg.length !== sets) refusals.push(`suggestedWeights has ${kg.length} entries for ${sets} sets.`)
  if (!Array.isArray(durations) || durations.some((d) => typeof d !== 'number' || !(d > 0))) refusals.push('durations: a list of seconds, each > 0.')
  else if (timed && isInt(sets) && durations.length !== sets) refusals.push(`a timed item needs ${sets} durations (one per set), got ${durations.length}.`)
  if (!isInt(restSec) || restSec < 0) refusals.push(`restSec must be a whole number ≥ 0 (got ${json(restSec)}).`)
  if (!ROLE_VALUES.includes(role)) refusals.push(`role must be one of ${ROLE_VALUES.join(', ')} (got ${json(role)}).`)
  if (!(warmup === null || (isObject(warmup) && Object.keys(warmup).join() === 'reps' && String(warmup.reps ?? '') !== ''))) {
    refusals.push(`warmup is null or {"reps": …} (got ${json(warmup)}).`)
  }
  if (typeof notes !== 'string') refusals.push('notes: a string.')

  // C6 — what the workout can't run (DEC-146/151).
  if (!timed && !cardio && Array.isArray(targets)) {
    const bad = targets.filter((t) => isDurationTarget(t))
    if (bad.length) refusals.push(`target ${json(bad[0])} shows as Duration on a reps item: write reps as a bare number, or use hasDuration for timed work.`)
  }
  if (timed && isInt(sets) && sets >= 2 && isInt(restSec) && restSec < MIN_TIMED_REST_SEC) {
    refusals.push(`a timed ${sets}-set item with restSec ${restSec}: an interval under ${MIN_TIMED_REST_SEC} s can't be run (DEC-151).`)
  }

  // C5 — no invented kg (DESIGN §1, DEC-096): a kg is set only where there is history.
  const kgChanged = !before || !isDeepStrictEqual(before.suggestedWeights, kg)
  if (kgChanged && Array.isArray(kg) && kg.some((w) => w > 0) && !historyPrescription(workouts, item.exerciseId)) {
    refusals.push(`kg ${list(kg)} on ${exercise?.name ?? item.exerciseId}, which has no logged history: a kg comes from history or from Emilio, never invented (DEC-096). Leave suggestedWeights [].`)
  }

  // Warnings (§5): printed, never refusing.
  if (!timed && !cardio && Array.isArray(targets)) {
    const loose = targets.filter((t) => typeof t === 'string' && !/^\d+$/.test(t.trim()) && !isDurationTarget(t))
    if (loose.length) warnings.push(`target ${json(loose[0])} is not a plain number: it is logged as typed unless he retypes it (set-seed.js setLogSeed).`)
  }
  if (Array.isArray(durations) && durations.some((d) => d < 30)) warnings.push(`a duration under 30 s (${list(durations)}).`)
  if (restSec === 0 && typeof notes === 'string' && notes.trim()) warnings.push('restSec 0 with notes: notes show only during rest, so these never show.')
  const pattern = typeof notes === 'string' && notes.match(/superset|circuit|emom|tabata|warm[\s-]?up/i)
  if (pattern) warnings.push(`notes mention "${pattern[0]}": the app has no such feature, the note is only text (DEC-146).`)
  return { refusals, warnings }
}

// ---- C2: only the named records changed (from the two states, not from the ops) ----

const byId = (records) => new Map((records || []).map((r) => [r.id, r]))

// `named` = {exercises: Set, routines: Set, schedule: boolean}. → refusal strings.
export function onlyNamedChanged(base, result, named) {
  const out = []
  for (const [noun, key] of [['exercise', 'exercises'], ['routine', 'routines']]) {
    const before = byId(base[key])
    const after = byId(result[key])
    for (const [id, record] of after) {
      if (named[key].has(id)) continue
      if (!before.has(id)) out.push(`C2: ${noun} ${id} "${record.name}" was added, but no change names it.`)
      else if (!isDeepStrictEqual(before.get(id), record)) out.push(`C2: ${noun} ${id} "${record.name}" changed, but no change names it.`)
    }
    for (const [id, record] of before) if (!after.has(id)) out.push(`C2: ${noun} ${id} "${record.name}" was removed — nothing is ever deleted.`)
  }
  const s0 = base.schedule || {}
  const s1 = result.schedule || {}
  const slots0 = byId(s0.slots)
  const slots1 = byId(s1.slots)
  if (!named.schedule) {
    if (!isDeepStrictEqual(s0.slots || [], s1.slots || [])) out.push('C2: the schedule’s slots changed, but no schedule.set names them.')
    if (s0.loopWeeks !== s1.loopWeeks) out.push('C2: loopWeeks changed, but no schedule.set names it.')
  }
  if (s0.anchor !== s1.anchor) out.push('C2: the schedule’s anchor changed (it is never edited).')
  // moves/swaps: kept as they are; one whose slot schedule.set removed may drop (model.js normalises it away).
  for (const field of ['moves', 'swaps']) {
    const kept = (s0[field] || []).filter((entry) => !(named.schedule && slots0.has(entry.slotId) && !slots1.has(entry.slotId)))
    if (!isDeepStrictEqual(kept, s1[field] || [])) out.push(`C2: the schedule’s ${field} changed (they are never edited).`)
  }
  const other = (state) => Object.fromEntries(Object.entries(state).filter(([k]) => !['exercises', 'routines', 'schedule', ...HISTORY_KEYS].includes(k)))
  if (!isDeepStrictEqual(other(base), other(result))) out.push('C2: a top-level field other than exercises/routines/schedule changed.')
  return out
}

// C1 — logged history deep-equal.
export function historyChanged(base, result) {
  return HISTORY_KEYS.filter((k) => !isDeepStrictEqual(base[k] ?? null, result[k] ?? null))
}

// ---- describing an item change ----

const FIELD_LABEL = { suggestedWeights: 'kg', targets: 'reps', restSec: 'rest', sets: 'sets', durations: 'durations', role: 'role', warmup: 'warm-up', notes: 'notes' }
const show = (field, v) => {
  if (field === 'suggestedWeights' || field === 'targets' || field === 'durations') return list(v)
  if (field === 'warmup') return v ? `${v.reps} reps` : 'none'
  if (field === 'notes') return v ? json(v) : '""'
  return String(v)
}
function fieldDiff(before, after) {
  return ITEM_FIELDS.filter((f) => !isDeepStrictEqual(before[f], after[f])).map((f) => `${FIELD_LABEL[f]} ${show(f, before[f])} → ${show(f, after[f])}`)
}

// ---- the builder ----

export function buildPlan(current, changes, { library = [], makeId = uid, now = new Date().toISOString() } = {}) {
  const lines = []
  const warnings = []
  const refusals = []
  const fail = (refusalList) => ({ state: null, file: null, plan: null, lines, warnings, refusals: refusalList })

  if (!isObject(changes) || changes.kind !== CHANGES_KIND) return fail([`Not a change list: "kind" must be "${CHANGES_KIND}".`])
  if (changes.version !== CHANGES_VERSION) return fail([`Change list version ${json(changes.version)}: this builder reads version ${CHANGES_VERSION}.`])
  const unknownTop = Object.keys(changes).filter((k) => !['kind', 'version', 'changes'].includes(k))
  if (unknownTop.length) return fail([`Unknown top-level field(s): ${unknownTop.join(', ')}.`])
  if (!Array.isArray(changes.changes) || changes.changes.length === 0) return fail(['"changes" is empty: nothing to build.'])

  const state = structuredClone(current)
  state.exercises = state.exercises || []
  state.routines = state.routines || []
  state.schedule = state.schedule || { loopWeeks: 1, slots: [] }
  const workouts = state.workouts || []
  const libraryById = new Map(library.map((e) => [String(e.id), e]))
  const ids = new Set([...state.exercises, ...state.routines, ...(state.schedule.slots || [])].map((r) => r.id))
  const exRefs = new Map()
  const rtnRefs = new Map()
  const named = { exercises: new Set(), routines: new Set(), schedule: false }
  // Items this file made or changed, checked after all ops (C3–C6): "routineId itemId" → base item or null.
  const touched = new Map()
  const baseItems = new Map(state.routines.flatMap((r) => (r.exercises || []).map((i) => [`${r.id} ${i.id}`, i])))

  const exerciseOf = (id) => state.exercises.find((e) => e.id === id)
  const exName = (id) => exerciseOf(id)?.name ?? id
  const newId = (prefix) => {
    let id
    do id = makeId(prefix)
    while (ids.has(id))
    ids.add(id)
    return id
  }

  // A new routine item: the app's add path (pickerItem → routineItemAdded's shape), the given fields on top.
  function newItem(exercise, given) {
    const picked = pickerItem(workouts, exercise)
    const shaped = routineItemAdded({ exercises: [] }, { ...picked.item, exerciseId: exercise.id }, newId('si')).exercises[0]
    const item = { ...shaped, ...given }
    const from = picked.source === 'history' ? `from history: ${picked.label.replace(/^Last time: /, '')}` : 'starting plan, no kg'
    const extra = Object.keys(given).length ? `; then ${fieldDiff(shaped, item).join('; ')}` : ''
    return { item, text: `+ item ${exercise.name} (${from})${extra}` }
  }

  function itemsFrom(routine, given, where) {
    if (!Array.isArray(given)) refuse(`${where}: items is a list.`)
    const left = [...(routine.exercises || [])]
    const out = []
    const texts = []
    given.forEach((g, i) => {
      const fields = itemFields(g, `${where} item ${i + 1}`, true)
      const exercise = resolve(state.exercises, exRefs, g.exercise, 'exercise')
      const at = left.findIndex((item) => item.exerciseId === exercise.id)
      if (at > -1) {
        const [kept] = left.splice(at, 1)
        const item = { ...kept, ...fields }
        out.push(item)
        const diff = fieldDiff(kept, item)
        if (diff.length) texts.push(`${exercise.name}: ${diff.join('; ')}`)
      } else {
        const made = newItem(exercise, fields)
        out.push(made.item)
        texts.push(made.text)
      }
    })
    for (const dropped of left) texts.push(`- item ${exName(dropped.exerciseId)} (removed from this routine)`)
    const keptOrder = out.filter((item) => (routine.exercises || []).some((b) => b.id === item.id)).map((i) => i.id)
    const baseOrder = (routine.exercises || []).map((i) => i.id).filter((id) => keptOrder.includes(id))
    if (!isDeepStrictEqual(keptOrder, baseOrder)) texts.push('order changed')
    return { items: out, texts }
  }

  const runOp = {
    'exercise.add'(c, where) {
      if (typeof c.libraryId !== 'string' || !c.libraryId) refuse(`${where}: libraryId is needed.`)
      const entry = libraryById.get(c.libraryId)
      if (!entry) refuse(`${where}: no library entry "${c.libraryId}".`)
      if (entry.mergedInto) refuse(`${where}: library entry "${c.libraryId}" is merged into "${entry.mergedInto}" — use that id.`)
      if (entry.hidden) refuse(`${where}: library entry "${c.libraryId}" is hidden (not offered in the app).`)
      const existing = state.exercises.filter((e) => !e.archivedAt && e.libraryId === c.libraryId)
      if (existing.length) refuse(`${where}: "${c.libraryId}" is already exercise ${existing.map((e) => `${e.id} "${e.name}"`).join(', ')} — use that one.`)
      const set = c.set ?? {}
      checkExerciseSet(set, where)
      const { lightestWeight, unilateral, ...data } = set
      const exercise = exerciseFromData({ ...catalogItemToExercise(entry), ...data }, newId('ex'))
      if (lightestWeight !== undefined) exercise.lightestWeight = lightestWeight
      if (unilateral !== undefined) exercise.unilateral = unilateral
      defineRef(exRefs, c.ref, exercise.id, ids)
      state.exercises.push(exercise)
      named.exercises.add(exercise.id)
      const extras = Object.entries(set).filter(([k]) => k !== 'cues').map(([k, v]) => `${k} ${v}`)
      lines.push(`+ exercise ${exercise.name} (${exercise.id}, library ${c.libraryId}, ${exercise.type}${extras.length ? `; ${extras.join(', ')}` : ''})`)
    },
    'exercise.set'(c, where) {
      const exercise = resolve(state.exercises, exRefs, c.exercise, 'exercise')
      checkExerciseSet(c.set, where)
      const diff = Object.entries(c.set).filter(([k, v]) => !isDeepStrictEqual(exercise[k], v)).map(([k, v]) => `${k} ${k === 'cues' ? '(text)' : json(exercise[k] ?? null)} → ${k === 'cues' ? '(new text)' : json(v)}`)
      Object.assign(exercise, structuredClone(c.set))
      named.exercises.add(exercise.id)
      lines.push(`exercise ${exercise.name}: ${diff.join('; ') || 'no change'}`)
    },
    'routine.add'(c, where) {
      if (typeof c.name !== 'string' || !c.name.trim()) refuse(`${where}: name is needed.`)
      if (c.focus !== undefined && typeof c.focus !== 'string') refuse(`${where}: focus is a string.`)
      const routine = { id: newId('rtn'), name: c.name.trim(), focus: c.focus || 'Machines', archivedAt: null, exercises: [] }
      defineRef(rtnRefs, c.ref, routine.id, ids)
      const { items, texts } = itemsFrom(routine, c.items ?? [], where)
      routine.exercises = items
      for (const item of items) touched.set(`${routine.id} ${item.id}`, null)
      state.routines.push(routine)
      named.routines.add(routine.id)
      lines.push(`+ routine ${routine.name} (${routine.id}, ${routine.focus}, ${items.length} items)`)
      for (const t of texts) lines.push(`  ${routine.name} · ${t}`)
    },
    'routine.set'(c, where) {
      const routine = resolve(state.routines, rtnRefs, c.routine, 'routine')
      onlyKeys(c.set, ['name', 'focus'], `${where} set`)
      for (const k of ['name', 'focus']) if (k in c.set && (typeof c.set[k] !== 'string' || !c.set[k].trim())) refuse(`${where}: ${k} is a non-empty string.`)
      const diff = Object.entries(c.set).filter(([k, v]) => routine[k] !== v).map(([k, v]) => `${k} ${json(routine[k])} → ${json(v)}`)
      Object.assign(routine, c.set)
      named.routines.add(routine.id)
      lines.push(`routine ${routine.name}: ${diff.join('; ') || 'no change'}`)
    },
    'routine.items'(c, where) {
      const routine = resolve(state.routines, rtnRefs, c.routine, 'routine')
      const { items, texts } = itemsFrom(routine, c.items, where)
      routine.exercises = items
      for (const item of items) touched.set(`${routine.id} ${item.id}`, baseItems.get(`${routine.id} ${item.id}`) ?? null)
      named.routines.add(routine.id)
      lines.push(`routine ${routine.name} items (${items.length}):${texts.length ? '' : ' no change'}`)
      for (const t of texts) lines.push(`  ${routine.name} · ${t}`)
    },
    'item.set'(c, where) {
      const routine = resolve(state.routines, rtnRefs, c.routine, 'routine')
      const exercise = resolve(state.exercises, exRefs, c.exercise, 'exercise')
      const fields = itemFields(c.set, `${where} set`, false)
      const matches = (routine.exercises || []).filter((i) => i.exerciseId === exercise.id)
      if (matches.length !== 1) {
        refuse(`${where}: ${routine.name} has ${matches.length} items for ${exercise.name}${matches.length ? ` (${matches.map((i) => i.id).join(', ')}) — use routine.items` : ''}.`)
      }
      const before = matches[0]
      const after = { ...before, ...fields }
      routine.exercises = routine.exercises.map((i) => (i === before ? after : i))
      touched.set(`${routine.id} ${after.id}`, baseItems.get(`${routine.id} ${after.id}`) ?? null)
      named.routines.add(routine.id)
      lines.push(`${routine.name} · ${exercise.name}: ${fieldDiff(before, after).join('; ') || 'no change'}`)
    },
    'routine.archive'(c) {
      const routine = resolve(state.routines, rtnRefs, c.routine, 'routine')
      if (routine.archivedAt) refuse(`routine ${routine.id} "${routine.name}" is already archived.`)
      routine.archivedAt = now
      named.routines.add(routine.id)
      lines.push(`routine ${routine.name}: archived (kept, with its history)`)
    },
    'schedule.set'(c, where) {
      if (!isInt(c.loopWeeks) || c.loopWeeks < 1 || c.loopWeeks > 4) refuse(`${where}: loopWeeks is a whole number 1–4.`)
      if (!Array.isArray(c.slots)) refuse(`${where}: slots is a list.`)
      const before = state.schedule.slots || []
      const free = [...before]
      const slots = c.slots.map((s, i) => {
        onlyKeys(s, ['week', 'weekday', 'routine'], `${where} slot ${i + 1}`)
        if (!isInt(s.week) || s.week < 0 || s.week >= c.loopWeeks) refuse(`${where} slot ${i + 1}: week is 0–${c.loopWeeks - 1} (0 = the loop's first week).`)
        if (!isInt(s.weekday) || s.weekday < 0 || s.weekday > 6) refuse(`${where} slot ${i + 1}: weekday is 0–6 (0 = Sunday, 1 = Monday).`)
        const routine = resolve(state.routines, rtnRefs, s.routine, 'routine')
        const at = free.findIndex((o) => o.week === s.week && o.weekday === s.weekday && o.routineId === routine.id)
        const id = at > -1 ? free.splice(at, 1)[0].id : newId('slot')
        return { id, week: s.week, weekday: s.weekday, routineId: routine.id }
      })
      const name = (id) => state.routines.find((r) => r.id === id)?.name ?? id
      const text = (s) => `w${s.week} d${s.weekday} ${name(s.routineId)}`
      lines.push(`schedule: loopWeeks ${state.schedule.loopWeeks} → ${c.loopWeeks}; slots [${before.map(text).join(', ')}] → [${slots.map(text).join(', ')}]`)
      state.schedule = { ...state.schedule, loopWeeks: c.loopWeeks, slots }
      named.schedule = true
    },
  }

  changes.changes.forEach((c, i) => {
    const where = `change ${i + 1}${isObject(c) && typeof c.op === 'string' ? ` (${c.op})` : ''}`
    try {
      if (!isObject(c) || !OPS[c.op]) refuse(`${where}: unknown op ${json(isObject(c) ? c.op : c)} (ops: ${Object.keys(OPS).join(', ')}).`)
      onlyKeys(c, OPS[c.op], where)
      runOp[c.op](c, where)
    } catch (error) {
      if (!(error instanceof Refusal)) throw error
      refusals.push(error.message.startsWith('change ') ? error.message : `${where}: ${error.message}`)
    }
  })
  if (refusals.length) return fail(refusals)

  // C3–C6 on every item this file made or changed.
  const live = (records) => new Set(records.filter((r) => !r.archivedAt).map((r) => r.id))
  const liveExercises = live(state.exercises)
  for (const routine of state.routines) {
    for (const item of routine.exercises || []) {
      const key = `${routine.id} ${item.id}`
      if (!touched.has(key)) continue
      const before = touched.get(key)
      if (before && isDeepStrictEqual(before, item)) continue
      const where = `${routine.name} · ${exName(item.exerciseId)}`
      if (!liveExercises.has(item.exerciseId)) refusals.push(`C3: ${where}: exercise ${item.exerciseId} is archived or missing.`)
      const p = itemProblems(item, exerciseOf(item.exerciseId), workouts, before)
      for (const r of p.refusals) refusals.push(`${where}: ${r}`)
      for (const w of p.warnings) warnings.push(`${where}: ${w}`)
    }
  }
  const liveRoutines = live(state.routines)
  for (const slot of state.schedule.slots || []) {
    if (!liveRoutines.has(slot.routineId)) refusals.push(`C3: schedule slot ${slot.id} (week ${slot.week}, day ${slot.weekday}) points at routine ${slot.routineId}, which is archived or missing — set the schedule.`)
  }

  const changedHistory = historyChanged(current, state)
  if (changedHistory.length) refusals.push(`C1: logged history changed (${changedHistory.join(', ')}).`)
  refusals.push(...onlyNamedChanged(current, state, named))
  if (refusals.length) return fail(refusals)

  // C7 — the server's own check: the file as `plan preview` reads it, against the same base.
  let fileState
  const file = buildBackup(state)
  try {
    fileState = readPlanFile(JSON.parse(JSON.stringify(file)))
  } catch (error) {
    return fail([`C7: plan preview would not read the file: ${error.message}`])
  }
  // The file as read (validState) must still hold only what was named, and the same history.
  const after = historyChanged(current, fileState)
  if (after.length) refusals.push(`C7: the file as read changes logged history (${after.join(', ')}).`)
  refusals.push(...onlyNamedChanged(current, fileState, named).map((r) => `C7 (file as read) ${r}`))
  const plan = planChange(current, fileState, { archivedAt: now })
  refusals.push(...plan.refusals.map((r) => `C7: ${r}`))
  if (refusals.length) return { state, file: null, plan, lines, warnings, refusals }
  return { state, file, plan, lines, warnings, refusals }
}
