// req-180 (DEC-097) — the exercise picker's pure parts: your exercises most recently done
// first, the library's staples grouped by muscle for an empty search, a loose own-name
// match for the near-duplicate guard, and each added item's values (history, or a shown
// starting plan). The view (views/ExercisePicker.jsx) only renders these.
import { finishedNewestFirst, historyPrescription } from './history-queries.js'
import { MUSCLE_GROUPS } from './exerciseLibrary.js'
import { listable, shownName } from './exerciseCatalog.js'
import { libraryItemMatch, normalName } from './exercise-names.js'
import { DEFAULT_DURATION_SEC, isSkippedSet } from './set-rules.js'

// exerciseId → rank of the newest finished workout with a done set of it (0 = newest).
function lastDoneRank(workouts) {
  const rank = new Map()
  finishedNewestFirst(workouts).forEach((workout, index) => {
    for (const set of workout.sets || []) {
      if (!isSkippedSet(set) && !rank.has(set.exerciseId)) rank.set(set.exerciseId, index)
    }
  })
  return rank
}

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''))

// Non-archived own exercises: most recently done first, never-done after, A→Z (unconfirmed).
export function ownRecentFirst(exercises, workouts) {
  const rank = lastDoneRank(workouts)
  const live = (exercises || []).filter((ex) => !ex.archivedAt)
  const done = live.filter((ex) => rank.has(ex.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id) || byName(a, b))
  const never = live.filter((ex) => !rank.has(ex.id)).sort(byName)
  return [...done, ...never]
}

// → [{ group, items }] in MUSCLE_GROUPS order, listable staples only, each A→Z by the
// shown name. A staple in several groups is listed under its first group only (unconfirmed).
export function staplesByMuscle(catalog) {
  const groups = Object.keys(MUSCLE_GROUPS)
  const out = new Map(groups.map((group) => [group, []]))
  for (const item of catalog || []) {
    if (!item?.staple || !listable(item)) continue
    const group = (item.muscleGroups || []).find((name) => out.has(name))
    if (group) out.get(group).push(item)
  }
  return groups
    .map((group) => ({
      group,
      items: out.get(group).sort((a, b) => shownName(a).localeCompare(shownName(b))),
    }))
    .filter((row) => row.items.length)
}

function words(name) {
  return normalName(name).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
}

// Every word of the shorter name is in the longer one ("Bench" ⊂ "Bench Press").
function looseNameMatch(a, b) {
  const [x, y] = [words(a), words(b)]
  if (!x.length || !y.length) return false
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x]
  const set = new Set(longer)
  return shorter.every((word) => set.has(word))
}

// req-180 §6 — the own record a library row may duplicate: libraryItemMatch (libraryId /
// exact name, live or archived) or a loose name match on the shown or free-db name. Live
// outranks archived; among several, the most recently done (then A→Z). → { kind, exercise } | null.
export function looseOwnMatch(exercises, item, workouts = []) {
  const list = exercises || []
  const exact = libraryItemMatch(list, item)
  const names = [shownName(item), item?.name].filter(Boolean)
  const loose = list.filter((ex) => names.some((name) => looseNameMatch(ex.name, name)))
  const candidates = [...(exact ? [exact.exercise] : []), ...loose.filter((ex) => ex !== exact?.exercise)]
  if (!candidates.length) return null
  const rank = lastDoneRank(workouts)
  const order = (a, b) =>
    (rank.has(a.id) ? rank.get(a.id) : Infinity) - (rank.has(b.id) ? rank.get(b.id) : Infinity) || byName(a, b)
  const live = candidates.filter((ex) => !ex.archivedAt).sort(order)
  if (live.length) return { kind: 'live', exercise: exact?.kind === 'live' ? exact.exercise : live[0] }
  const archived = candidates.sort(order)
  return { kind: 'archived', exercise: exact ? exact.exercise : archived[0] }
}

// req-180 §5 (DEC-097 §4) — starting plan values (unconfirmed: 3 sets, 90 s; cardio 1 set, rest 0).
export const STARTING_SETS = 3
export const STARTING_REPS = '10'
export const STARTING_REST_SEC = 90

function sameOrSlash(list, unit = '') {
  const values = (list || []).map(String)
  if (!values.length) return ''
  return (new Set(values).size === 1 ? values[0] : values.join('/')) + unit
}

// The routine item a picked exercise is added with, from ONE source — never mixed:
// - 'history': historyPrescription's whole prescription (a field it lacks stays absent);
//   warm-up set / role as the per-exercise form after req-179 (DEC-099: null / main).
// - 'starting': a plan by logging kind, never a kg (DEC-097 §4, DESIGN §1's one exception).
// `label` is what the selected row shows, so the plan is never silent.
export function pickerItem(workouts, exercise) {
  const history = exercise?.id ? historyPrescription(workouts, exercise.id) : null
  if (history) {
    const { warmup: _warmup, ...prescription } = history
    const item = { ...prescription, role: 'main', warmup: null, durations: [] }
    if (item.restSec === undefined) delete item.restSec
    const kg = sameOrSlash(history.suggestedWeights, ' kg')
    const reps = sameOrSlash(history.targets)
    const label = `Last time: ${[`${history.sets}${reps ? ` × ${reps}` : ' sets'}`, kg].filter(Boolean).join(' · ')}`
    return { source: 'history', item, label }
  }
  const base = { role: 'main', warmup: null, notes: '', suggestedWeights: [] }
  if (exercise?.type === 'cardio') {
    const item = { ...base, sets: 1, targets: [], durations: [], restSec: 0 }
    return { source: 'starting', item, label: 'Starting plan: 1 set — change any time' }
  }
  if (exercise?.hasDuration) {
    const seconds = exercise.durationSec != null ? Number(exercise.durationSec) : DEFAULT_DURATION_SEC
    const item = {
      ...base,
      sets: STARTING_SETS,
      targets: [],
      durations: Array.from({ length: STARTING_SETS }, () => seconds),
      restSec: STARTING_REST_SEC,
    }
    return {
      source: 'starting',
      item,
      label: `Starting plan: ${STARTING_SETS} × ${seconds} s, ${STARTING_REST_SEC} s rest — change any time`,
    }
  }
  const item = {
    ...base,
    sets: STARTING_SETS,
    targets: Array.from({ length: STARTING_SETS }, () => STARTING_REPS),
    durations: [],
    restSec: STARTING_REST_SEC,
  }
  return {
    source: 'starting',
    item,
    label: `Starting plan: ${STARTING_SETS} × ${STARTING_REPS}, ${STARTING_REST_SEC} s rest — change any time`,
  }
}
