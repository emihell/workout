// req-181 (DEC-098) — "Start from a plan": pick days per week (1–4), fill each day's slots
// from the req-180 picker filtered to the slot's movement pattern, and Save once. Pure: the
// templates, the slot filters / candidates, and planToState (the one reducer Save runs).
// Output is plain routines + items + (only on an empty schedule) slots — nothing new is stored.
import { exerciseFromData } from './exercise-names.js'
import { listable } from './exerciseCatalog.js'
import { filteredBrowse, ownRecentFirst } from './routine-picker.js'
import { exerciseAddedState, restoreExerciseInState, routineAddedState, routineItemAdded, slotAddedState } from './state-reducers.js'
import { toLocalDate, withDefaultAnchor } from './schedule.js'

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

// req-190 (DEC-105 §2) — a new plan starts today: the week keeps its spacing, shifted so its
// first day is today's weekday (2 days: today, +3; 3: today, +2, +4; 4: today, +1, +3, +4).
// `week`: [[weekday, routineIdx]] in day order; `today`: a Date (injected — no clock read here).
export function startTodayWeek(week, today) {
  if (!week?.length) return []
  const first = week[0][0]
  const day = toLocalDate(today).getDay()
  return week.map(([weekday, r]) => [(((weekday - first + day) % 7) + 7) % 7, r])
}

// req-191 §4 `(unconfirmed)` — a workout's days in plain words, for the days step: weekdays in the
// week's order (startTodayWeek: today first). Today among them → "Starts today (Tue), then every
// Tue and Fri"; otherwise "Every Fri". `today` is a weekday number (0 = Sun).
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function andList(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
export function planDaysText(weekdays, today) {
  const list = [...new Set(weekdays || [])]
  if (!list.length) return ''
  const every = andList(list.map((weekday) => WEEKDAY_SHORT[weekday]))
  return list.includes(today) ? `Starts today (${WEEKDAY_SHORT[today]}), then every ${every}` : `Every ${every}`
}

// req-190 (DEC-105 §1) — machines-first split `(unconfirmed)`: 'same' → one workout of every
// pick; 'ab' → two, alternating in pick order (1st → A, 2nd → B, 3rd → A, …).
export const SPLIT_SAME = 'same'
export const SPLIT_AB = 'ab'
export function splitPicks(picks, split) {
  const list = picks || []
  if (split !== SPLIT_AB) return [list]
  return [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)]
}

// The machines-first plan: routine names `names` (req-207, DEC-116: the setup's name boxes,
// "New workout #N" prefilled; an emptied box → the caller's prefill); without them the old
// defaults "Workout" / "Workout A", "Workout B".
// `weekdays` (req-207): the days the user picked (0 = Sun) — the week is those, in Mon–Sun
// order, taken as given (`fixedDays`: planToState does not shift them; with today among them
// the plan still starts today, DEC-105). Without them, the template's spacing, which
// planToState shifts to start today. With A/B, days alternate A, B, A, B in that order.
// One day is always one workout (an A/B split needs two days).
export function machinesPlan({ days, split, picks, names, weekdays }) {
  const template = PLAN_TEMPLATES[days]
  if (!template) return null
  const ab = split === SPLIT_AB && days >= 2
  const groups = splitPicks(picks, ab ? SPLIT_AB : SPLIT_SAME)
  const fallback = ab ? ['Workout A', 'Workout B'] : ['Workout']
  const nameOf = (r) => String(names?.[r] ?? '').trim() || fallback[r]
  const chosen = weekdays ? mondayFirst(weekdays) : null
  const week = (chosen || template.week.map(([weekday]) => weekday)).map((weekday, i) => [weekday, ab ? i % 2 : 0])
  return {
    routines: groups.map((group, r) => ({ name: nameOf(r), picks: group })),
    week,
    ...(chosen ? { fixedDays: true } : {}),
  }
}

// req-207 — weekdays (0 = Sun), deduplicated, in Mon–Sun order (Sunday last).
export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0]
export function mondayFirst(weekdays) {
  const set = new Set((weekdays || []).map(Number))
  return WEEKDAYS_MON_FIRST.filter((weekday) => set.has(weekday))
}

// req-207 (DEC-116) — the default name of a new workout: "New workout #N", N the smallest
// integer ≥ 1 that no active (not archived) workout is already named. `count` → the next
// `count` free numbers in order (A/B: #N, then the next free one after it).
export function nextWorkoutNames(routines, count = 1) {
  const taken = new Set(
    (routines || []).filter((routine) => routine && !routine.archivedAt).map((routine) => String(routine.name ?? '').trim()),
  )
  const out = []
  for (let n = 1; out.length < count; n += 1) {
    const name = `New workout #${n}`
    if (!taken.has(name)) out.push(name)
  }
  return out
}
export function nextWorkoutName(routines) {
  return nextWorkoutNames(routines, 1)[0]
}

// The template days whose slots are all unchosen (null / skipped) — the empty-day sheet's
// subject (req-190 §4). → [routine index]; none when nothing at all is chosen.
export function emptyPlanDays(choices) {
  const template = PLAN_TEMPLATES[choices?.days]
  if (!template) return []
  const picked = template.routines.map((def, r) => (choices.fills?.[r] || []).slice(0, def.slots.length).some(Boolean))
  if (!picked.some(Boolean)) return []
  return picked.map((has, r) => (has ? -1 : r)).filter((r) => r >= 0)
}

// req-190 §4 — Save with a day that has no exercises asks first, never drops it silently:
// [Leave it out] (the day is not made, as before) or [Same as <first chosen day>]. Wording
// `(unconfirmed)`. → the sheet's text, or null when no day is empty.
export function emptyDaySheetText(days, fills) {
  const empties = emptyPlanDays({ days, fills })
  if (!empties.length) return null
  const routines = PLAN_TEMPLATES[days].routines
  const names = empties.map((r) => routines[r].name)
  const donor = routines.find((_, r) => !empties.includes(r))?.name
  const listed = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return {
    title: `${listed} ${names.length === 1 ? 'has' : 'have'} no exercises.`,
    message: `Leave it out and your week has no ${listed} day — or give it the same exercises as ${donor}.`,
    choices: [
      { value: 'leave', label: 'Leave it out' },
      { value: 'same', label: `Same as ${donor}` },
    ],
  }
}

// The template plan. `choices.empty` answers the empty-day sheet: 'same' → each empty day
// gets the first chosen day's picks ("Same as Full body A"); anything else ('leave', or
// unanswered) → the empty day is not made, nor its schedule days.
export function templatePlan({ days, fills, empty }) {
  const template = PLAN_TEMPLATES[days]
  if (!template) return null
  const picksOf = template.routines.map((def, r) => (fills?.[r] || []).slice(0, def.slots.length).filter(Boolean))
  const donor = picksOf.find((picks) => picks.length) || []
  return {
    routines: template.routines.map((def, r) => ({
      name: def.name,
      picks: picksOf[r].length || empty !== 'same' ? picksOf[r] : donor,
    })),
    week: template.week,
  }
}

function planShape(choices) {
  return (choices?.picks ? machinesPlan(choices) : templatePlan(choices || {})) || { routines: [], week: [] }
}

// The ids Save needs, made up front (store.jsx applyPlan): enough for every pick and day,
// drawn in order. Each call of the returned function starts a fresh cursor over the SAME ids,
// so running planToState twice (the updater, then the result) makes the same records.
export function planIds(choices, uid, now) {
  const plan = planShape(choices)
  const picks = plan.routines.reduce((n, routine) => n + routine.picks.length, 0)
  const pool = (prefix, n) => Array.from({ length: n }, () => uid(prefix))
  const made = {
    exercise: pool('ex', picks),
    routine: pool('rtn', plan.routines.length),
    item: pool('si', picks),
    slot: pool('slot', plan.week.length),
  }
  return () => {
    const cursor = { exercise: 0, routine: 0, item: 0, slot: 0 }
    const next = (key) => () => made[key][cursor[key]++]
    return { exercise: next('exercise'), routine: next('routine'), item: next('item'), slot: next('slot'), now }
  }
}

// The one reducer Save runs, for both starts. `choices` is either the template's
// { days, fills, empty? } — fills[r][s] is the pick for routine r's slot s, or null (skipped)
// — or the machines-first { days, split, picks }. A pick: { kind: 'own', exerciseId, restore?,
// item } or { kind: 'library', data (catalogItemToExercise), item }. `ids`: { exercise(),
// routine(), item(), slot() } and `now` (today) — the store makes ids and reads the clock.
// - A library entry picked in several slots becomes ONE exercise record.
// - A routine with no picks is not made, nor its schedule days (the template flow asks first).
// - The week goes on the schedule only when it has no slots (then loopWeeks 1), starting
//   today (startTodayWeek, req-190); otherwise the schedule is left exactly as it was.
// → { state, routineIds, scheduled }
export function planToState(state, choices, ids) {
  const plan = planShape(choices)
  if (!plan.routines.length) return { state, routineIds: [], scheduled: false }
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

  const routineIds = plan.routines.map((def) => {
    if (!def.picks.length) return null
    let routine = { id: ids.routine(), name: def.name, focus: 'Machines', exercises: [] }
    for (const pick of def.picks) {
      routine = routineItemAdded(routine, { ...pick.item, exerciseId: exerciseFor(pick) }, ids.item())
    }
    s = routineAddedState(s, routine)
    return routine.id
  })

  const scheduled = (state.schedule?.slots || []).length === 0 && routineIds.some(Boolean)
  if (scheduled) {
    s = { ...s, schedule: { ...withDefaultAnchor(s.schedule || { slots: [] }, ids.now), loopWeeks: 1 } }
    // The first KEPT day is today (a left-out day A does not push the plan to its next day).
    const kept = plan.week.filter(([, r]) => routineIds[r])
    // req-207 — days the user picked are the days (no shift); the template's start today.
    for (const [weekday, r] of plan.fixedDays ? kept : startTodayWeek(kept, ids.now || new Date())) {
      s = slotAddedState(s, { id: ids.slot(), week: 0, weekday, routineId: routineIds[r] })
    }
  }
  return { state: s, routineIds: routineIds.filter(Boolean), scheduled }
}
