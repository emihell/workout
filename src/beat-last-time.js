// req-96 — "you beat last time": a quiet, per-exercise celebration on the Finish
// screen. Pure and inspectable (the "reasoning made visible" rule): given the just
// -finished workout and the previous same-routine finished workout, it reports which
// exercises improved, each on its own natural axis — heavier weight, more reps, or a
// longer hold. It NEVER reports a regression and NEVER invents a comparison it doesn't
// have (DESIGN §1): no prior workout, no match for an exercise (newly added), or an
// unparseable axis all contribute no win rather than a guess.
//
// req-210 (DEC-117 §1) — improvementPct puts a number on the same axis: the small "↑ N%"
// on the in-workout list and the finish screens. Never in History (DEC-050).
import { isWeightedType } from './ids.js'
import { isSkippedSet } from './workout-log.js'
import { exerciseById } from './model.js'

// Parse a stored numeric field defensively. Reps can be non-numeric ("AMRAP") and
// duration can be absent; anything that isn't a finite number reads as 0 — i.e. "no
// data on this axis", which can never out-score a real prior value, so it is silently
// not a win (never a "you did worse").
function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// The working sets logged for one exercise in a workout — warm-up sets excluded, the
// warm-up rule the summary stats use (setType === 'wu'). Matched by exercise id, not name
// or position, so an exercise that moved in the routine still matches.
// req-111 / DEC-053 — skipped sets (weight 0, reps 'skipped') are excluded on both
// sides: they hold no data, so a skipped week can't hand today a false "heavier", and an
// exercise skipped entirely today has no sets and so no win.
function workSetsFor(workout, exerciseId) {
  return (workout?.sets || []).filter(
    (s) => s.exerciseId === exerciseId && s.setType !== 'wu' && !isSkippedSet(s),
  )
}

// req-111 / DEC-053 — the prior work sets for one exercise: from the most recent prior
// (newest-first) where it has non-skipped work sets, looking past workouts where it was
// entirely skipped. None → [] → silent (DEC-050 no-invent).
function priorWorkSetsFor(priors, exerciseId) {
  for (const prior of priors) {
    const sets = workSetsFor(prior, exerciseId)
    if (sets.length) return sets
  }
  return []
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
  return exerciseById(exercises, exerciseId)?.type
}

function exerciseNameFor(workout, exerciseId, exercises) {
  return (
    snapshotItemFor(workout, exerciseId)?.exerciseName ||
    exerciseById(exercises, exerciseId)?.name ||
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
    // req-98 — BOTH sides must carry real duration to be comparable. A newly-flagged
    // timed exercise whose prior same-routine workout was logged the old way (free-text
    // reps, no durationSec) has prev === 0: no comparable prior, so it's silent rather
    // than claiming a bogus "↑ Longer" against a record with no duration (DESIGN §1 /
    // DEC-050 no-invent).
    return prev > 0 && cur > prev ? 'longer' : null
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
// req-111 — `prior` is one workout or a newest-first list of prior same-routine
// workouts (previousSameRoutineWorkouts); with a list, each exercise compares against
// the most recent one where it was actually done.
export function beatLastTimeWins(current, prior, exercises = []) {
  const priors = (Array.isArray(prior) ? prior : [prior]).filter(Boolean)
  if (!current || !priors.length) return []
  const wins = []
  for (const exerciseId of orderedExerciseIds(current)) {
    const kind = compareExercise(
      workSetsFor(current, exerciseId),
      priorWorkSetsFor(priors, exerciseId),
      exerciseTypeFor(current, exerciseId, exercises),
    )
    if (kind) wins.push({ exerciseId, name: exerciseNameFor(current, exerciseId, exercises), kind })
  }
  return wins
}

// req-210 / DEC-117 §1 — the small "↑ N%" per exercise: how much better this time than last,
// on the SAME axis compareExercise uses (DEC-050):
//   timed     → best duration;
//   weighted  → top-set kg, or — when the top kg is the same — the reps at that kg;
//   otherwise → best reps (bodyweight).
// (this − last) / last, rounded to a whole number; a real gain that rounds to 0 reads 1, so
// a shown arrow never says "↑ 0%". Null on no improvement (equal or worse — never a down
// arrow), on no sets either side, or when last's axis value is 0 (no base to divide by).
// Pure: the inputs are the two sides' WORK sets (warm-ups and skipped sets already out, as
// workSetsFor gives them) and the exercise type.
export function improvementPct(thisSets, lastSets, type) {
  const kind = compareExercise(thisSets || [], lastSets || [], type)
  if (!kind) return null
  let cur
  let prev
  if (kind === 'longer') {
    cur = maxBy(thisSets, (s) => num(s.durationSec))
    prev = maxBy(lastSets, (s) => num(s.durationSec))
  } else if (isWeightedType(type)) {
    const a = bestWeighted(thisSets)
    const b = bestWeighted(lastSets)
    ;[cur, prev] = kind === 'heavier' ? [a.w, b.w] : [a.r, b.r]
  } else {
    cur = maxBy(thisSets, (s) => num(s.reps))
    prev = maxBy(lastSets, (s) => num(s.reps))
  }
  if (!(prev > 0)) return null
  return Math.max(1, Math.round(((cur - prev) / prev) * 100))
}

// req-210 — improvementPct for one exercise of a workout, against the same prior source as
// beatLastTimeWins (the previous finished same-routine workout(s), same exercise id,
// DEC-050 / DEC-053). Null when there is no prior or no improvement.
export function exerciseImprovementPct(current, prior, exerciseId, exercises = []) {
  const priors = (Array.isArray(prior) ? prior : [prior]).filter(Boolean)
  if (!current || !priors.length) return null
  return improvementPct(
    workSetsFor(current, exerciseId),
    priorWorkSetsFor(priors, exerciseId),
    exerciseTypeFor(current, exerciseId, exercises),
  )
}

// req-210 — every improved exercise in workout order: [{ exerciseId, name, pct }]. The
// finish screens list these; an exercise that did not beat last time is absent.
export function improvementList(current, prior, exercises = []) {
  if (!current) return []
  const out = []
  for (const exerciseId of orderedExerciseIds(current)) {
    const pct = exerciseImprovementPct(current, prior, exerciseId, exercises)
    if (pct != null) out.push({ exerciseId, name: exerciseNameFor(current, exerciseId, exercises), pct })
  }
  return out
}

// req-210 — the arrow's text: "↑ 17%".
export function improvementText(pct) {
  return pct == null ? '' : `↑ ${pct}%`
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
