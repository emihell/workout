// req-96 — "you beat last time": a quiet, per-exercise celebration on the Finish
// screen. Pure and inspectable (the "reasoning made visible" rule): given the just
// -finished workout and the previous same-routine finished workout, it reports which
// exercises improved, each on its own natural axis — heavier weight, more reps, or a
// longer hold. It NEVER reports a regression and NEVER invents a comparison it doesn't
// have (DESIGN §1): no prior workout, no match for an exercise (newly added), or an
// unparseable axis all contribute no win rather than a guess.
//
// This is a NEW sibling to workoutVolume/workoutSummaryStats, not a change to them —
// req-84's auto-complete "vs last time" volume summary still uses those untouched.
import { isWeightedType } from './ids.js'

// Parse a stored numeric field defensively. Reps can be non-numeric ("AMRAP") and
// duration can be absent; anything that isn't a finite number reads as 0 — i.e. "no
// data on this axis", which can never out-score a real prior value, so it is silently
// not a win (never a "you did worse").
function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// The working sets logged for one exercise in a workout — warm-up sets excluded, the
// same rule workoutVolume applies (setType === 'wu'). Matched by exercise id, not name
// or position, so an exercise that moved in the routine still matches.
function workSetsFor(workout, exerciseId) {
  return (workout?.sets || []).filter((s) => s.exerciseId === exerciseId && s.setType !== 'wu')
}

// Exercise ids in workout order, de-duplicated. The snapshot's item order is the
// display order the user saw; fall back to the order sets first appear if a snapshot
// is missing (older records).
function orderedExerciseIds(workout) {
  const ids = []
  const seen = new Set()
  const push = (id) => {
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  for (const item of workout?.snapshot?.items || []) push(item.exerciseId)
  for (const s of workout?.sets || []) push(s.exerciseId)
  return ids
}

function snapshotItemFor(workout, exerciseId) {
  return (workout?.snapshot?.items || []).find((item) => item.exerciseId === exerciseId) || null
}

function exerciseTypeFor(workout, exerciseId, exercises) {
  const fromSnapshot = snapshotItemFor(workout, exerciseId)?.exerciseType
  if (fromSnapshot) return fromSnapshot
  return (exercises || []).find((e) => e.id === exerciseId)?.type
}

function exerciseNameFor(workout, exerciseId, exercises) {
  return (
    snapshotItemFor(workout, exerciseId)?.exerciseName ||
    (exercises || []).find((e) => e.id === exerciseId)?.name ||
    exerciseId
  )
}

// A timed exercise is one where any work set on either side carries a positive
// durationSec — that is the only axis that varies for a hold (weight/reps stay empty).
function isTimed(curSets, prevSets) {
  return [...curSets, ...prevSets].some((s) => num(s.durationSec) > 0)
}

function maxBy(sets, pick) {
  let best = null
  for (const s of sets) {
    const v = pick(s)
    if (best == null || v > best) best = v
  }
  return best ?? 0
}

// The heaviest set, breaking ties toward more reps — so "same top weight, more reps"
// is detectable as a rep win at that weight.
function bestWeighted(sets) {
  let best = null
  for (const s of sets) {
    const w = num(s.weight)
    const r = num(s.reps)
    if (best == null || w > best.w || (w === best.w && r > best.r)) best = { w, r }
  }
  return best
}

// Compare one exercise's current vs prior work sets on its natural axis. Returns a win
// kind ('heavier' | 'more-reps' | 'longer') or null. Requires sets on BOTH sides — an
// exercise absent from the prior workout yields null (no invented win).
function compareExercise(curSets, prevSets, type) {
  if (!curSets.length || !prevSets.length) return null

  if (isTimed(curSets, prevSets)) {
    const cur = maxBy(curSets, (s) => num(s.durationSec))
    const prev = maxBy(prevSets, (s) => num(s.durationSec))
    return cur > prev ? 'longer' : null
  }

  if (isWeightedType(type)) {
    const cur = bestWeighted(curSets)
    const prev = bestWeighted(prevSets)
    if (!cur || !prev) return null
    if (cur.w > prev.w) return 'heavier'
    if (cur.w === prev.w && cur.r > prev.r) return 'more-reps'
    return null
  }

  // Bodyweight / reps-only: more reps in the best set is the win.
  const cur = maxBy(curSets, (s) => num(s.reps))
  const prev = maxBy(prevSets, (s) => num(s.reps))
  return cur > prev ? 'more-reps' : null
}

// The exercises that improved this workout vs the previous same-routine workout, in
// workout order. Empty when there is no prior, or nothing improved. Each entry:
// { exerciseId, name, kind }. A regression on another exercise never suppresses a win
// elsewhere — a normal gym day still gets its line.
export function beatLastTimeWins(current, prior, exercises = []) {
  if (!current || !prior) return []
  const wins = []
  for (const exerciseId of orderedExerciseIds(current)) {
    const kind = compareExercise(
      workSetsFor(current, exerciseId),
      workSetsFor(prior, exerciseId),
      exerciseTypeFor(current, exerciseId, exercises),
    )
    if (kind) wins.push({ exerciseId, name: exerciseNameFor(current, exerciseId, exercises), kind })
  }
  return wins
}

const PHRASE = {
  heavier: (name) => `Heavier on ${name}`,
  'more-reps': (name) => `More reps on ${name}`,
  longer: (name) => `Longer ${name} than last time`,
}

// The one quiet line naming the win. Multiple wins name the first (workout order) plus
// a light "+N more". Returns null when there is nothing to celebrate (caller renders
// nothing). The leading ↑ accent is added by the view, not here.
export function beatLastTimeLine(wins) {
  if (!wins?.length) return null
  const phrase = PHRASE[wins[0].kind]?.(wins[0].name)
  if (!phrase) return null
  const extra = wins.length - 1
  return extra > 0 ? `${phrase} · +${extra} more` : phrase
}
