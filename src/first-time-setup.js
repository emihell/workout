// req-10 (DEC-012, amended by DEC-123 §1) — first-time guided setup for an exercise with no
// finished history. Pure, so every decision is unit-tested and inspectable:
//   - setupPromptShows: when "First time — [Set it up] [I'll enter it]" shows;
//   - setTwoSeed: after set 1 in setup, "How was that?" → set 2's editable prefill + its reason.
// The answer is NEVER stored on a set (set 1 and set 2 keep `rpe: null`): req-212's rule writes
// an item's effort onto later work sets (item.jsx completeSet), so a stored answer would spread
// as the exercise effort. It lives only on `activeWorkout.firstTimeSetup` (transient, like
// seedOverrides: kept through migrateState by workoutSnapshot's spread, dropped by finishedState).
//
// Set 1's kg is never touched (DESIGN §1): the seed applies to set 2 only, and it is computed
// from set 1's LOGGED kg by the app's one progression rule — recommendNextPrescription (and so
// moveToValidWeight) — never a second rule.
import { isWeightedType } from './ids.js'
import { HOLD_REASONS, isAssistedExercise, recommendNextPrescription, unreadableTarget, validWeights } from './progress.js'
import { isSkippedSet } from './set-rules.js'
import { itemKey, itemLoggingState, seedOverrideKey, setTargetFor } from './workout-log.js'

// The sheet's answers. `rpe` is only the value handed to recommendNextPrescription (the same
// numbers EFFORT_OPTIONS uses: Easy 2, Medium 3, Hard 4) — it is never written anywhere.
export const SETUP_FEELS = [
  { value: 'easy', label: 'Easy', rpe: 2 },
  { value: 'medium', label: 'Medium', rpe: 3 },
  { value: 'hard', label: 'Hard', rpe: 4 },
]

export const SETUP_TEXT = {
  prompt: 'First time',
  setUp: 'Set it up',
  manual: "I'll enter it",
  guideWeighted: 'Pick a weight you could lift about 15 times. Log the set, then tell us how it felt.',
  guideBodyweight: 'Do the reps you can do with good form. Log the set, then tell us how it felt.',
  sheetTitle: 'How was that?',
  sheetSkip: 'Skip',
  noStep: 'No weight steps set for this exercise',
}

// The per-exercise entry on activeWorkout.firstTimeSetup (keyed by exerciseId: once answered it
// doesn't show again for that exercise in this workout):
//   { mode: 'setup' | 'manual', itemKey, answered?: 'easy' | 'medium' | 'hard' | 'skip',
//     seed?: { itemKey, workIndex: 1, weight?, reps?, reason, overrideWeight } }
// `itemKey`: the item the prompt was answered on (the guide line and the sheet belong to it).
// `answered` is the sheet's answer: so it asks once, and so an edit of set 1 can recompute the
// seed (setupAfterSetOneEdit). `overrideWeight`: this exercise's session kg override when the seed
// was written — a later override (the user's own kg) beats the seed (setupSeedFor, workout-log.js).
// All of it is dropped at Finish.
export function firstTimeSetupFor(workout, exerciseId) {
  const map = workout?.firstTimeSetup
  const entry = map && typeof map === 'object' ? map[exerciseId] : null
  return entry && typeof entry === 'object' ? entry : null
}

// The activeWorkout patch writing one exercise's entry (the rest of the map kept).
export function firstTimeSetupPatch(workout, exerciseId, entry) {
  return { firstTimeSetup: { ...(workout?.firstTimeSetup || {}), [exerciseId]: entry } }
}

// Weighted or bodyweight, not timed: cardio and timed exercises have nothing to calibrate.
export function setupApplies(ex) {
  if (!ex || ex.type === 'cardio' || ex.hasDuration) return false
  return ex.type === 'bodyweight' || isWeightedType(ex.type)
}

// The prompt: at the first work set (nothing of it logged yet, warm-up done) of an exercise with
// no finished history (`hasHistory` = lastSetsForExercise is non-null), not yet answered.
export function setupPromptShows({ ex, hasHistory, currentType, workLogged, entry }) {
  if (hasHistory || !setupApplies(ex)) return false
  if (currentType !== 'work' || (workLogged || []).length > 0) return false
  return !entry
}

// After set 1's Done, in setup mode: ask only when there is a set 2 to seed, set 1 was logged
// (not skipped), and — weighted — set 1 has a kg to step from (a blank kg logs 0: nothing to move).
// Review round 1 — `key`: the item on screen; the sheet belongs to the item the prompt was answered on.
export function setupSheetShows({ ex, entry, set1, exerciseDone, key }) {
  if (entry?.mode !== 'setup' || entry.answered || entry.seed || exerciseDone) return false
  if (key !== undefined && entry.itemKey !== key) return false
  if (!set1 || isSkippedSet(set1) || !setupApplies(ex)) return false
  if (ex.type !== 'bodyweight' && !(Number(set1.weight) > 0)) return false
  return true
}

function plainInt(value) {
  const text = String(value ?? '').trim()
  return /^\d+$/.test(text) ? Number(text) : null
}

// The holds recommendNextPrescription reports (HOLD_REASONS), in the reason line's words.
const HOLD_TEXT = {
  assisted: 'Same kg — assisted, kept as is',
  target: "Same kg — the target isn't a single number",
  lightest: 'Same kg — already the lightest weight',
}

const FELT = { easy: 'felt easy', medium: 'felt medium', hard: 'felt hard' }

// Set 2's seed from set 1 + the answer: `{ workIndex: 1, weight?, reps?, reason }`, or null
// (Skip / no answer / nothing to seed → the plain carry). Computed by recommendNextPrescription
// on set 1 alone, judged against set 1's own target: Easy → one valid step up; Medium / Hard →
// same kg; missed reps → one step down (whatever the answer; Hard holds); the helper's holds
// (assisted, a target that isn't one number, already at the lightest weight, no weight step)
// keep the kg and say why. Bodyweight: Easy → set 1's logged reps + 1, else no seed (below).
export function setTwoSeed({ ex, set1, feel, target1 }) {
  const pick = SETUP_FEELS.find((f) => f.value === feel)
  if (!pick || !set1 || isSkippedSet(set1) || !setupApplies(ex)) return null
  const kg = Number(set1.weight) || 0
  const bodyweight = ex.type === 'bodyweight'
  if (!bodyweight && kg <= 0) return null
  const result = recommendNextPrescription({
    targets: [target1 ?? ''],
    weights: [kg],
    sets: [{ ...set1, rpe: pick.rpe }],
    exercise: ex,
  })
  const why = FELT[feel]
  const held = (key) => result.reason.includes(HOLD_REASONS[key])

  // Review round 1 — bodyweight builds on what set 1 LOGGED, not the routine target: Easy (with
  // the target met — the helper didn't move down — and a target it can read) → set 1's reps + 1.
  // Medium / Hard / missed reps → no seed: set 2 keeps the plain seed (set 1's reps carried on a
  // uniform plan, else its own target), with no reason line.
  if (bodyweight) {
    const logged = plainInt(set1.reps)
    if (feel !== 'easy' || logged == null || result.action === 'down' || held('target')) return null
    return { workIndex: 1, reps: String(logged + 1), reason: `One more rep — set 1 ${why}` }
  }

  const moved = Number(result.weights[0]) || 0
  // An Easy at the top of a fixed weightOptions list can't go higher: hold, never step down.
  const next = result.action === 'up' && moved < kg ? kg : moved
  let reason
  if (next > kg) reason = `Up one step — set 1 ${why}`
  else if (next < kg) reason = 'Down one step — set 1 missed reps'
  else if (isAssistedExercise(ex)) reason = HOLD_TEXT.assisted
  else if (unreadableTarget(target1)) reason = HOLD_TEXT.target
  else if (!validWeights(ex).length) reason = SETUP_TEXT.noStep
  else if (held('lightest')) reason = HOLD_TEXT.lightest
  else reason = `Same kg — set 1 ${why}`
  return { workIndex: 1, weight: String(next), reason }
}

function overrideWeightNow(workout, exerciseId) {
  const weight = workout?.seedOverrides?.[seedOverrideKey(exerciseId, 'work')]?.weight
  return weight != null ? String(weight) : ''
}

// The activeWorkout patch for the sheet's answer, built from the workout AS IT IS NOW (set 1
// logged, its override written): the item's one logged work set is set 1. `feel` null = Skip.
// The answer and the seed go on firstTimeSetup only — never onto a set.
export function setupAnsweredPatch(workout, item, ex, feel) {
  const key = itemKey(item)
  const { workLogged } = itemLoggingState(workout, item)
  const seed =
    feel && workLogged.length === 1
      ? setTwoSeed({ ex, set1: workLogged[0], feel, target1: setTargetFor(item, 'work', 0) })
      : null
  return firstTimeSetupPatch(workout, item.exerciseId, {
    mode: 'setup',
    itemKey: key,
    answered: feel || 'skip',
    ...(seed ? { seed: { ...seed, itemKey: key, overrideWeight: overrideWeightNow(workout, item.exerciseId) } } : {}),
  })
}

// Review round 1 — set 1 of this item edited (the edit sheet) while set 2 is still to come:
// the seed is recomputed from the edited set 1 with the same stored answer (dropped when that
// answer no longer yields one). Null = nothing to change (no answer / Skip / another item / set 2
// already logged).
export function setupAfterSetOneEdit(workout, item, ex) {
  const entry = firstTimeSetupFor(workout, item.exerciseId)
  if (!entry || entry.mode !== 'setup' || !entry.answered || entry.answered === 'skip') return null
  if ((entry.itemKey ?? entry.seed?.itemKey) !== itemKey(item)) return null
  if (itemLoggingState(workout, item).workLogged.length !== 1) return null
  return setupAnsweredPatch(workout, item, ex, entry.answered)
}
