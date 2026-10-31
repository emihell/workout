// req-270 — split from workout-log.js: what a set is prefilled with (the prefill rule, CLAUDE.md).
import { rpeOptionValue } from './ids.js'
import { DEFAULT_DURATION_SEC, isSkippedSet } from './set-rules.js'
import { itemKey, workCountFor } from './workout-items.js'

// The most recent non-skipped working set already logged this session, scanning
// newest-first. Returns null when there is nothing to carry (no working set
// logged yet, or every one was skipped). The source for req-02's no-history
// carry (DEC-002): the next set follows the most recently logged set, and a
// skipped set is never the source. Pure, so the carry is testable without the DOM.
export function carriedWorkingSet(workLogged) {
  const sets = workLogged || []
  for (let i = sets.length - 1; i >= 0; i--) {
    if (!isSkippedSet(sets[i])) return sets[i]
  }
  return null
}

// req-02 / DEC-002 — the kg carried onto the next working set: the most recent
// non-skipped working set logged this session. Null for a warm-up or when nothing is
// logged yet. setLogSeed decides whether the kg is used (no history, or no history set at
// this index — req-152); moved here from item.jsx.
// req-191 §6 (DEC-107 §2; amends req-108 / DEC-052 "reps never carry") — the same set's
// logged reps ride along; setLogSeed uses them only on a set with NO reps target. A skipped
// set is never the source (carriedWorkingSet), so a skip carries nothing.
export function carryForSet(currentType, workLogged) {
  if (currentType !== 'work') return null
  const src = carriedWorkingSet(workLogged)
  if (!src) return null
  return {
    weight: src.weight != null && Number(src.weight) !== 0 ? String(src.weight) : '',
    reps: src.reps != null ? String(src.reps).trim() : '',
  }
}

// req-10 (DEC-123 §1) — the first-time setup's set-2 seed for this item, or null. It lives on
// `activeWorkout.firstTimeSetup[exerciseId].seed` (first-time-setup.js; transient session
// state like seedOverrides, dropped by finishedState) and names the item it was asked on.
// `workIndex` given → only when it names that work set (the live form's question).
export function setupSeedFor(workout, item, setType = 'work', workIndex = null) {
  if (setType !== 'work' || !item) return null
  const map = workout?.firstTimeSetup
  const entry = map && typeof map === 'object' ? map[item.exerciseId] : null
  const seed = entry && typeof entry === 'object' ? entry.seed : null
  if (!seed || typeof seed !== 'object' || seed.itemKey !== itemKey(item)) return null
  if (workIndex != null && Number(seed.workIndex) !== Number(workIndex)) return null
  // Review round 1 — a kg override newer than the seed (the user's own kg, written after it)
  // wins: a seed whose recorded override no longer matches is not used. (Editing set 1 rewrites
  // the seed with the new override, setupAfterSetOneEdit, so the seed then stands again.)
  if (seed.weight != null) {
    const now = workout?.seedOverrides?.[seedOverrideKey(item.exerciseId, 'work')]?.weight
    if (String(now ?? '') !== String(seed.overrideWeight ?? '')) return null
  }
  return seed
}

// req-117 — the log form's values for a set being un-logged by "Previous" (moved here
// from item.jsx so it is testable). A timed set also restores its logged seconds
// (`durationSec`), so Previous on a timed set shows the time just logged, not the
// target (DESIGN §5). Absent on a reps set.
export function restoreFromLoggedSet(set) {
  const skipped = isSkippedSet(set)
  return {
    setType: set.setType || 'work',
    workIndex: set.setType === 'wu' ? 0 : null,
    weight: set.weight != null && Number(set.weight) !== 0 ? String(set.weight) : '',
    reps: skipped ? '' : set.reps != null && set.reps !== '' ? String(set.reps) : '',
    rpe: set.rpe != null && set.rpe !== '' ? String(set.rpe) : '',
    note: skipped ? '' : set.note || '',
    ...(!skipped && set.durationSec != null ? { durationSec: Number(set.durationSec) || 0 } : {}),
  }
}

// kg + reps to prefill the set-log form (req-02 / DEC-002, as amended below):
//   restore (Previous re-edit) wins outright. Otherwise:
//   kg   — override (req-83) → a work set's routine kg (req-178) → the session carry
//          (when the routine has no kg there; on the warm-up path only with no history,
//          or no history set at this index, req-152) → history → blank;
//   reps — the set's target → with no target, the carry's reps (req-191) → blank.
//   `carry` is carryForSet: the last non-skipped WORKING set logged this session (null
//   for a warm-up or when nothing is logged), passed whether or not the exercise has
//   history. `weighted` gates kg — bodyweight / cardio never seed a weight. Pure so the
//   prefill decision is inspectable, the way the history-prefill rule is.
//
// req-83 (N9) — `override` is the session-scoped, per-field seed override for THIS
// exercise+setType (see nextSeedOverrides): once the user enters a value that
// differs from the presented seed, that field seeds from the override for the
// remaining sets this session, until changed again. Only a field the user actually
// changed is present on `override`, so an untouched field falls straight through to
// carry/history/target — never invented (DESIGN §1). It sits BELOW restore (a
// Previous re-edit shows the set's own logged values) and ABOVE carry/history.
// `weighted` still gates kg, so a weight override never lands on a bodyweight set.
//
// req-108 / DEC-052 (+ amendment), amended by req-191 / DEC-107 §2 — WEIGHT carries through
// the override and the session carry, as below. REPS: a set with a reps target prefills that
// target; a set with NO target prefills the carry's reps (the last non-skipped working set
// logged this session, carryForSet), else empty. Reps never come from the override: a `reps`
// still stored on an active workout's override (saved before req-108) is ignored here, not
// migrated. A warm-up has no carry, so its reps are its target or empty. The no-history kg
// carry (DEC-002) is unchanged.
//
// req-152 (QA-3) — `historyHasSet: false` says the history has no set at THIS index (an
// "Add set" beyond last time's count, or a routine that grew): there is no history kg for
// it, so the in-session carry applies, as for a no-history exercise — the kg just
// logged carries (weight carries; reps as above). Absent = unchanged (history wins).
//
// req-178 / DEC-096 §1 — a WORK set's kg is the routine's: `routineKg` is the snapshot
// item's suggestedWeights[workIndex] (frozen at Start). Chain: override (DEC-052) >
// routine kg (> 0) > session carry (DEC-002 / req-152, only when the routine has no kg
// there) > blank. History no longer seeds a work set's kg. `routineKg` undefined = the
// warm-up path (the routine holds no warm-up kg), which keeps history as before.
//
// req-210 / DEC-117 §3 (amends DEC-052) — `uniformReps: true` says every working set of the
// item has the SAME reps target (3 × 10, uniformRepsTargets): then the carry's reps (the last
// working set logged this session) win over the target, so a changed rep count rides to the
// remaining sets. Per-set targets that differ (12/10/8) pass false and keep their own target.
// A warm-up has no carry (carryForSet), so its reps are never carried.
//
// req-10 (DEC-123 §1) — `setup`: the first-time setup's set-2 seed (first-time-setup.js
// setTwoSeed, `{ weight?, reps? }`), passed only for the set it names. Computed from set 1's
// LOGGED kg / reps and the user's "How was that?" answer, so it is the user's own data (never a
// guessed starting kg — set 1 never gets one). It sits above override / routine kg / carry; a
// field it doesn't carry falls through unchanged. Absent = unchanged behaviour.
export function setLogSeed({ weighted, fromRestore, restore, hasHistory, historyHasSet, history, carry, target, override, routineKg, uniformReps = false, setup = null }) {
  if (fromRestore) {
    return { weight: weighted ? restore.weight : '', reps: restore.reps }
  }
  if (setup) {
    const plain = setLogSeed({ weighted, fromRestore, restore, hasHistory, historyHasSet, history, carry, target, override, routineKg, uniformReps })
    return {
      weight: weighted && setup.weight != null ? String(setup.weight) : plain.weight,
      reps: setup.reps != null ? String(setup.reps) : plain.reps,
    }
  }
  const ov = override || {}
  let baseWeight
  if (routineKg !== undefined) {
    const planned = Number(routineKg) > 0 ? String(routineKg) : ''
    baseWeight = planned || (carry ? carry.weight : '')
  } else {
    const useCarry = (!hasHistory || historyHasSet === false) && carry
    baseWeight = useCarry ? carry.weight : history.weight
  }
  return {
    weight: weighted ? (ov.weight != null ? ov.weight : baseWeight) : '',
    reps: (uniformReps && carry?.reps) || target || carry?.reps || '',
  }
}

// req-210 / DEC-117 §3 — true when the item's working sets all share one non-empty reps
// target (3 × 10). Read through setTargetFor so an "Add set" beyond the targets list counts
// with the last target, as its form does.
export function uniformRepsTargets(item) {
  const first = setTargetFor(item, 'work', 0)
  if (first === '') return false
  for (let i = 1; i < workCountFor(item); i++) {
    if (String(setTargetFor(item, 'work', i)) !== String(first)) return false
  }
  return true
}

// req-83 (N9) — the key a seed override is stored under on `activeWorkout.seedOverrides`.
// Per exercise AND per set kind: warm-up ('wu') and working ('work') sets seed
// independently (the separation the seed already uses), so a warm-up change carries
// only to later warm-up sets and NOT to the first working set (decided default: NO).
export function seedOverrideKey(exerciseId, setType) {
  return `${exerciseId}::${setType === 'wu' ? 'wu' : 'work'}`
}

// A weight normalized the same way the seed sources stringify it, so a value
// re-entered unchanged compares equal (no spurious override). Weight compares
// numerically ('5' === '5.0' === 5). (req-108 — the reps twins went with the reps carry.)
function weightSeedString(weight) {
  return weight != null && weight !== '' && Number(weight) !== 0 ? String(weight) : ''
}
function sameWeight(a, b) {
  return (Number(a) || 0) === (Number(b) || 0)
}

// req-83 (N9) — the next seed-override map after a set is logged. For the current
// exercise+setType, compare each logged field against the seed the form PRESENTED
// (`seed`, which already reflects any earlier override): a field that differs is
// the user changing it, so it becomes the override for the remaining sets; a field
// left at its seed is not "changed" and its prior override (if any) is untouched —
// so changing only weight never alters reps' seed, and vice-versa (field isolation,
// DESIGN §1). `weighted` gates weight, so a bodyweight set never records a weight
// override. Returns the SAME map (by identity) when nothing changed, so the caller
// can skip a needless write. Pure: keyed by exerciseId, it can never leak across
// exercises, and this is unit-tested rather than reasoned about.
// req-108 / DEC-052 — a reps change is no longer recorded (reps don't carry). A stale
// `reps` already on `prev` (an active workout saved before req-108) is passed through
// untouched — not rewritten — and setLogSeed never reads it.
export function nextSeedOverrides(overrides, { exerciseId, setType, weighted, seed, logged }) {
  const map = overrides || {}
  const key = seedOverrideKey(exerciseId, setType)
  const prev = map[key] || {}
  if (!weighted || sameWeight(logged.weight, seed.weight)) return map
  const weight = weightSeedString(logged.weight)
  if (weight === prev.weight) return map
  return { ...map, [key]: { ...prev, weight } }
}

// Everything the live set-log form starts from, decided from inputs alone — the
// history-is-truth rule made testable outside the component (req-17 / DEC-021).
// weight + reps go through the existing setLogSeed (never invents a kg it doesn't
// have); effort and note come from the restore payload only, else the defaults
// (effort 3 "Moderate", empty note). Same priority order as setLogSeed: restore
// (un-logging via "Previous") wins. Pure, so the prefill decision is inspectable.
// req-78 — the req-27 upcoming-weight override was removed: the next set's form is now
// the editable surface during rest, so the weight seed comes from restore/carry/history
// alone. (The pure pendingWeightFor helper went with it.)
// req-178 — `routineKg` as setLogSeed (a work set's routine kg; undefined for a warm-up).
// req-210 — `uniformReps` as setLogSeed.
// req-10 — `setup` as setLogSeed (the first-time setup's set-2 seed).
export function initialSetFields({ weighted, fromRestore, restore, hasHistory, historyHasSet, history, carry, target, override, routineKg, uniformReps, setup = null }) {
  const seed = setLogSeed({ weighted, fromRestore, restore, hasHistory, historyHasSet, history, carry, target, override, routineKg, uniformReps, setup })
  const effort =
    fromRestore && restore.rpe != null && restore.rpe !== ''
      ? rpeOptionValue(restore.rpe) || restore.rpe
      : 3
  const note = fromRestore ? restore.note : ''
  return { weight: seed.weight, reps: seed.reps, effort, note }
}

// req-106 — the target reps a set's log form presents: the warm-up's reps for a 'wu'
// set, else this working set's routine target, else the last target in the list, else
// empty. Was inline in WorkoutItemLive; shared with setPreview so the two can't drift.
export function setTargetFor(item, setType, workIndex) {
  if (setType === 'wu') return String(item?.warmup?.reps ?? '')
  const targets = item?.targets || []
  return targets[workIndex] ?? targets[targets.length - 1] ?? ''
}

// req-178 / DEC-096 §1 — the kg the routine sets for a set: the snapshot item's
// suggestedWeights at a WORK set's index ('' when it has none there); undefined for a
// warm-up (the routine holds no warm-up kg, so that set stays on history). Shared by the
// log form (item.jsx) and setPreview so the two can't drift.
export function routineKgFor(item, setType, workIndex) {
  if (setType === 'wu') return undefined
  return item?.suggestedWeights?.[workIndex] ?? ''
}

// req-85, moved here by req-106 — a timed exercise's work-set target seconds: this
// set's routine duration, else the last one in the list, else the exercise default,
// else the app default. Was view code (item.jsx); shared by the log form and the
// start-of-exercise preview so the two can't drift.
export function durationTargetFor(item, ex, workIndex) {
  const durations = item?.durations || []
  return durations[workIndex] ?? durations[durations.length - 1] ?? ex?.durationSec ?? DEFAULT_DURATION_SEC
}
