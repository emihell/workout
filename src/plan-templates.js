// req-181 (DEC-098) — "Start from a plan": pick days per week (1–4), fill each day's slots
// from the req-180 picker filtered to the slot's movement pattern, and Save once. Pure: the
// templates, the slot filters / candidates, and planToState (the one reducer Save runs).
// Output is plain routines + items + (only on an empty schedule) slots — nothing new is stored.
import { exerciseFromData } from './exercise-names.js'
import { listable } from './exerciseCatalog.js'
import { filteredBrowse, ownRecentFirst } from './routine-picker.js'
import { exerciseAddedState, restoreExerciseInState, routineAddedState, routineItemAdded, slotAddedState } from './state-reducers.js'
import { withDefaultAnchor } from './schedule.js'

// Slot → the library patterns it lists (unconfirmed: plain-word names, DEC-098 §3).
export const SLOTS = {
  squat: { label: 'Squat', patterns: ['squat'] },
  deadlift: { label: 'Deadlift', patterns: ['hinge'] },
  chest: { label: 'Chest press', patterns: ['horizontal-push'] },
  row: { label: 'Row', patterns: ['horizontal-pull'] },
  overhead: { label: 'Overhead press', patterns: ['vertical-push'] },
  pulldown: { label: 'Pull-down', patterns: ['vertical-pull'] },
  lunge: { label: 'Lunge', patterns: ['lunge'] },
  core: { label: 'Core', patterns: ['core-flexion', 'core-stability', 'core-rotation'] },
}

const A = { name: 'Full body A', slots: ['squat', 'chest', 'row', 'core'] }
const B = { name: 'Full body B', slots: ['deadlift', 'overhead', 'pulldown', 'lunge'] }

// Days per week → routines and the week's slots [weekday (0 = Sun), routine index]
// (unconfirmed: weekdays, DEC-098 §2 / prep §F). 4 days = Upper / Lower, each twice.
export const PLAN_TEMPLATES = {
  1: {
    label: 'Minimum',
    routines: [{ name: 'Full body', slots: ['squat', 'deadlift', 'chest', 'row', 'core'] }],
    week: [[1, 0]],
  },
  2: { label: 'Full body ×2', routines: [A, B], week: [[1, 0], [4, 1]] },
  3: {
    label: 'Full body ×3',
    routines: [A, B, { name: 'Full body C', slots: ['squat', 'chest', 'pulldown', 'core'] }],
    week: [[1, 0], [3, 1], [5, 2]],
  },
  4: {
    label: 'Upper / Lower',
    routines: [
      { name: 'Upper', slots: ['chest', 'row', 'overhead', 'pulldown'] },
      { name: 'Lower', slots: ['squat', 'deadlift', 'lunge', 'core'] },
    ],
    week: [[1, 0], [2, 1], [4, 0], [5, 1]],
  },
}

export const PLAN_DAYS = [1, 2, 3, 4]

// The fill screen's explicit "skip" for a slot (a pick is an object; unset is undefined).
export const PLAN_SKIP = 'skip'

// req-182 (unconfirmed) — a slot inherits the same slot's pick from an earlier day: Day C's
// Squat shows Day A's Squat pick until changed or skipped. An explicit pick or skip is never
// overwritten; a skip is never inherited. `fills[r][s]` → the same shape with each unset slot
// filled from the latest earlier day whose same slot key holds a pick (itself possibly carried).
export function carriedFills(days, fills) {
  const template = PLAN_TEMPLATES[days]
  if (!template) return fills || []
  const out = []
  template.routines.forEach((routine, r) => {
    out[r] = routine.slots.map((key, s) => {
      const own = fills?.[r]?.[s]
      if (own !== undefined && own !== null) return own
      for (let earlier = r - 1; earlier >= 0; earlier--) {
        const at = template.routines[earlier].slots.indexOf(key)
        const pick = at >= 0 ? out[earlier][at] : undefined
        if (pick && pick !== PLAN_SKIP) return pick
      }
      return undefined
    })
  })
  return out
}

// The picker's filters for a slot (req-180 ExercisePicker ownFilter / libraryFilter): a
// library entry by its pattern; an own exercise by its libraryId's entry (a manual one has
// no pattern, so it is only found by typing). `patterns` is a pattern or a list.
export function slotFilters(patterns, library) {
  const wanted = new Set([].concat(patterns))
  const byId = new Map((library || []).map((entry) => [entry.id, entry]))
  const libraryFilter = (entry) => wanted.has(entry?.pattern)
  const ownFilter = (exercise) => Boolean(exercise?.libraryId) && libraryFilter(byId.get(exercise.libraryId))
  return { ownFilter, libraryFilter }
}

// What a slot lists with an empty search: your exercises of the pattern (recent first),
// then the pattern's staples, then the rest ("Show more") — the same lists the picker shows.
export function slotCandidates(patterns, exercises, library, workouts = []) {
  const { ownFilter, libraryFilter } = slotFilters(patterns, library)
  const { staples, rest } = filteredBrowse((library || []).filter(listable), libraryFilter)
  return { own: ownRecentFirst(exercises, workouts).filter(ownFilter), staples, rest }
}

// The ids Save needs, made up front (store.jsx applyPlan): enough for every pick and day,
// drawn in order. Each call of the returned function starts a fresh cursor over the SAME ids,
// so running planToState twice (the updater, then the result) makes the same records.
export function planIds(choices, uid, now) {
  const template = PLAN_TEMPLATES[choices?.days]
  const picks = (choices?.fills || []).flat().filter(Boolean).length
  const pool = (prefix, n) => Array.from({ length: n }, () => uid(prefix))
  const made = {
    exercise: pool('ex', picks),
    routine: pool('rtn', template?.routines.length || 0),
    item: pool('si', picks),
    slot: pool('slot', template?.week.length || 0),
  }
  return () => {
    const cursor = { exercise: 0, routine: 0, item: 0, slot: 0 }
    const next = (key) => () => made[key][cursor[key]++]
    return { exercise: next('exercise'), routine: next('routine'), item: next('item'), slot: next('slot'), now }
  }
}

// The one reducer Save runs. `choices`: { days, fills } — fills[r][s] is the pick for routine
// r's slot s, or null (skipped): { kind: 'own', exerciseId, restore?, item } or
// { kind: 'library', data (catalogItemToExercise), item }. `ids`: { exercise(), routine(),
// item(), slot() } and `now` — the store makes ids and reads the clock, this stays pure.
// - A library entry picked in several slots becomes ONE exercise record.
// - A routine whose slots are all skipped is not made, nor its schedule days.
// - The week goes on the schedule only when it has no slots (then loopWeeks 1); otherwise
//   the schedule is left exactly as it was.
// → { state, routineIds, scheduled }
export function planToState(state, choices, ids) {
  const template = PLAN_TEMPLATES[choices?.days]
  if (!template) return { state, routineIds: [], scheduled: false }
  let s = state
  const created = new Map() // libraryId (or data name) → new exercise id
  const exerciseFor = (pick) => {
    if (pick.kind === 'own') {
      if (pick.restore) s = restoreExerciseInState(s, pick.exerciseId)
      return pick.exerciseId
    }
    const key = pick.data.libraryId || `name:${pick.data.name}`
    if (!created.has(key)) {
      const exercise = exerciseFromData(pick.data, ids.exercise())
      s = exerciseAddedState(s, exercise)
      created.set(key, exercise.id)
    }
    return created.get(key)
  }

  const routineIds = template.routines.map((def, r) => {
    const picks = (choices.fills?.[r] || []).slice(0, def.slots.length).filter(Boolean)
    if (!picks.length) return null
    let routine = { id: ids.routine(), name: def.name, focus: 'Machines', exercises: [] }
    for (const pick of picks) {
      routine = routineItemAdded(routine, { ...pick.item, exerciseId: exerciseFor(pick) }, ids.item())
    }
    s = routineAddedState(s, routine)
    return routine.id
  })

  const scheduled = (state.schedule?.slots || []).length === 0 && routineIds.some(Boolean)
  if (scheduled) {
    s = { ...s, schedule: { ...withDefaultAnchor(s.schedule || { slots: [] }, ids.now), loopWeeks: 1 } }
    for (const [weekday, r] of template.week) {
      if (routineIds[r]) s = slotAddedState(s, { id: ids.slot(), week: 0, weekday, routineId: routineIds[r] })
    }
  }
  return { state: s, routineIds: routineIds.filter(Boolean), scheduled }
}
