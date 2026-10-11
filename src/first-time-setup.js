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
//   { mode: 'setup' | 'manual', answered?: 'easy' | 'medium' | 'hard' | 'skip',
//     seed?: { itemKey, workIndex: 1, weight?, reps?, reason } }
// `answered` is the sheet's answer, kept only so it asks once; it is dropped at Finish.
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
export function setupSheetShows({ ex, entry, set1, exerciseDone }) {
  if (entry?.mode !== 'setup' || entry.answered || entry.seed || exerciseDone) return false
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
// keep the kg and say why. Bodyweight moves set 2's reps ±1 instead (never below 1).
export function setTwoSeed({ ex, set1, feel, target1, target2 }) {
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

  if (bodyweight) {
    const before = plainInt(target1)
    const after = plainInt(result.targets[0])
    const delta = before != null && after != null ? after - before : 0
    if (delta === 0) {
      const reason = held('target')
        ? "Same reps — the target isn't a single number"
        : result.action === 'down'
          ? 'Same reps — already at 1 rep'
          : `Same reps — set 1 ${why}`
      return { workIndex: 1, reason }
    }
    const base = plainInt(target2) ?? before
    const reps = String(Math.max(1, base + delta))
    return {
      workIndex: 1,
      reps,
      reason: delta > 0 ? `One more rep — set 1 ${why}` : 'One rep fewer — set 1 missed reps',
    }
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
