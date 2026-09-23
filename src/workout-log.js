import { rpeOptionValue } from './ids.js'
// DEFAULT_DURATION_SEC is read only inside durationTargetFor (call time), so the
// model.js <-> workout-log.js import cycle is safe under ESM live bindings.
import { DEFAULT_DURATION_SEC } from './model.js'

export function itemKey(item) {
  return item?.routineItemId || item?.sessionItemId || item?.id || ''
}

export function setsForItem(sets, item) {
  const key = itemKey(item)
  return (sets || []).filter(
    (set) =>
      set.routineItemId === key ||
      set.sessionItemId === key ||
      set.routineItemId === item?.id ||
      set.sessionItemId === item?.id ||
      (!set.routineItemId && !set.sessionItemId && set.exerciseId === item?.exerciseId),
  )
}

export function workCountFor(item) {
  return Number(item?.sets) || 1
}

// req-117 — `addedSets` counts the sets "Add set" appended to this snapshot item (this
// workout only). Optional and persisted on the item: absent reads as 0 (every item
// before req-117), and workoutSnapshot (model.js) carries it through its item spread.
// It is what makes an extra set removable (canRemoveAddedSet / withOneLessSet).
export function addedSetCount(item) {
  return Math.max(0, Number(item?.addedSets) || 0)
}

export function withOneMoreSet(item) {
  const targets = [...(item?.targets || [])]
  const weights = [...(item?.suggestedWeights || [])]
  const lastTarget = targets.at(-1) ?? ''
  const lastWeight = weights.at(-1)
  return {
    ...item,
    sets: (Number(item?.sets) || 1) + 1,
    targets: [...targets, lastTarget],
    suggestedWeights: lastWeight != null ? [...weights, lastWeight] : weights,
    addedSets: addedSetCount(item) + 1,
  }
}

// req-117 — the exact inverse of withOneMoreSet: one set fewer, the target it appended
// popped (it always appends one), and the weight popped only when it appended one.
// withOneMoreSet appends a weight iff the list's last entry is non-null, and the
// appended copy is that same non-null value, so "last entry non-null" after the add
// is exactly "a weight was appended". `addedSets` is decremented (dropped at 0, so a
// fully undone item reads as it did before Add set). No added set → unchanged item.
export function withOneLessSet(item) {
  const added = addedSetCount(item)
  const sets = Number(item?.sets) || 1
  if (added === 0 || sets <= 1) return item
  const weights = [...(item?.suggestedWeights || [])]
  const { addedSets: _added, ...rest } = item
  return {
    ...rest,
    sets: sets - 1,
    targets: (item.targets || []).slice(0, -1),
    suggestedWeights: weights.at(-1) != null ? weights.slice(0, -1) : weights,
    ...(added > 1 ? { addedSets: added - 1 } : {}),
  }
}

// req-117 — "Remove set" shows while the set on the log screen is an extra (added)
// set that hasn't been logged: every planned set (and the warm-up) is logged and the
// next one is one of the `addedSets`. Removing pops the LAST set, which is unlogged
// here and a copy of the same appended target/weight, so a logged set is never touched.
export function canRemoveAddedSet(workout, item) {
  const added = addedSetCount(item)
  if (added === 0) return false
  const { needsWu, workLogged, workCount } = itemLoggingState(workout, item)
  if (needsWu) return false
  return workLogged.length < workCount && workLogged.length >= workCount - added
}

// req-117 — the activeWorkout patch for "Remove set": the item one set shorter
// (withOneLessSet), and the done state recomputed — every remaining planned set logged
// → marked done again, exactly the state before Add set. Null when there is nothing to
// remove (unknown item, or its current set isn't an unlogged added one).
export function removeAddedSetPatch(workout, itemId) {
  const items = workout?.snapshot?.items || []
  const item = items.find((candidate) => itemKey(candidate) === itemId)
  if (!item || !canRemoveAddedSet(workout, item)) return null
  const shorter = withOneLessSet(item)
  const snapshot = {
    ...workout.snapshot,
    items: items.map((candidate) => (candidate === item ? shorter : candidate)),
  }
  const done = itemLoggingState(workout, shorter).plannedDone
  return {
    snapshot,
    ...(done ? markItemDonePatch(workout, shorter) : {}),
  }
}

export function addWorkingSetToState(state, itemId) {
  const active = state?.activeWorkout
  if (!active) return state
  const key = itemId
  let bumped = null
  const items = (active.snapshot?.items || []).map((item) => {
    if (itemKey(item) !== key) return item
    bumped = withOneMoreSet(item)
    return bumped
  })
  if (!bumped) return state
  return {
    ...state,
    activeWorkout: {
      ...active,
      snapshot: { ...active.snapshot, items },
    },
  }
}

function skippedSet({ item, setType, workIndex }) {
  const key = itemKey(item)
  const target =
    setType === 'wu'
      ? String(item.warmup?.reps ?? '')
      : item.targets?.[workIndex] ?? item.targets?.[item.targets?.length - 1] ?? ''
  return {
    routineItemId: key,
    exerciseId: item.exerciseId,
    setType,
    weight: 0,
    reps: 'skipped',
    rpe: null,
    note: 'skipped',
    targetReps: target || '',
    targetWeight: setType === 'work' ? item.suggestedWeights?.[workIndex] ?? null : null,
  }
}

// Pushes a `skippedSet` onto `sets` (in place) for every set of `item` not yet logged:
// the warm-up if it has one and none is logged, then working sets up to its planned
// count. req-109 — extracted unchanged from withSkippedUnloggedSets so "Skip exercise"
// records exactly the sets Finish would have recorded as skipped.
function pushSkippedUnloggedSets(sets, item) {
  const logged = () => setsForItem(sets, item)
  if (item.warmup && !logged().some((set) => set.setType === 'wu')) {
    sets.push(skippedSet({ item, setType: 'wu', workIndex: 0 }))
  }
  const workCount = workCountFor(item)
  while (logged().filter((set) => set.setType !== 'wu').length < workCount) {
    const workIndex = logged().filter((set) => set.setType !== 'wu').length
    sets.push(skippedSet({ item, setType: 'work', workIndex }))
  }
}

export function withSkippedUnloggedSets(workout) {
  if (!workout) return workout
  const sets = [...(workout.sets || [])]
  for (const item of workout.snapshot?.items || []) pushSkippedUnloggedSets(sets, item)
  const keys = (workout.snapshot?.items || []).map((item) => itemKey(item)).filter(Boolean)
  return {
    ...workout,
    sets,
    completedItemIds: [...new Set([...(workout.completedItemIds || []), ...keys])],
  }
}

// store.finishWorkout's reducer (manual Finish and the req-84 auto-complete both call
// it). The finished record carries `progression` as history (recalc reads it), but
// req-112 / DEC-056: `routines` is NOT touched — updating the routine is a deliberate
// choice (History recalc), never a side effect of Finish. req-83 (N9) — the live
// seed-override map is transient session state, dropped so it never lands on the
// finished-history record (which feeds history-prefill from `sets` alone). req-116 —
// the auto-finish dismissed flag is transient in the same way and is dropped too.
// req-125 — so is the set-form draft (`setDraft`).
export function finishedState(state, { overallNote, overallFeel, progression = [] } = {}, finishedAt = new Date().toISOString()) {
  if (!state?.activeWorkout) return state
  const { seedOverrides, autoFinishDismissed: _dismissed, setDraft: _draft, ...activeToFinish } = state.activeWorkout
  const finished = withSkippedUnloggedSets({
    ...activeToFinish,
    finishedAt,
    overallNote: overallNote || '',
    overallFeel: overallFeel || '',
    restEndsAt: null,
    restPausedRemaining: null,
    progression,
  })
  return {
    ...state,
    plannedWorkouts: (state.plannedWorkouts || []).filter(
      (plan) => plan.occurrenceId !== state.activeWorkout.occurrenceId,
    ),
    activeWorkout: null,
    workouts: [finished, ...(state.workouts || [])],
  }
}

// req-109 — "Skip exercise": the activeWorkout patch that logs every remaining
// (unlogged) set of ONE item as skipped (the same skippedSet records Finish writes)
// and marks it done. Sets already logged stay. Rest is left as it is: a rest armed by
// the last real set still applies before the next exercise. Unknown item → null.
export function skipItemPatch(workout, itemId) {
  const item = (workout?.snapshot?.items || []).find((candidate) => itemKey(candidate) === itemId)
  if (!item) return null
  const sets = [...(workout.sets || [])]
  pushSkippedUnloggedSets(sets, item)
  return { sets, ...markItemDonePatch(workout, item) }
}

// req-109 — the marker on a snapshot item added mid-workout (a replacement). It tells
// workoutSnapshot (model.js) to skip, for this item, the routine-template match and the
// targets/weights backfill, so the item keeps its own unique routineItemId (never a
// template id → applyProgressionToRoutines never writes it onto the routine) and stays
// blank across reloads. Persisted on the snapshot item; absent on every other item.
export function isAddedMidWorkout(item) {
  return item?.addedMidWorkout === true
}

// req-109 — the blank replacement item for `exercise`, inserted after `original`.
// 1 working set, no reps target, no suggested weight, no warm-up, no notes: nothing is
// copied from the original but its ROLE (a slot value: a warm-up replacement still
// reads as a warm-up). `restSec` is the caller's — the rest of this exercise's own last
// finished snapshot (historyPrescription), else 0. `id` must be unique and must not be
// a routine template item's id; it is both `id` and `routineItemId`. Prefill then comes
// from the exercise's own history through the normal log-form rule (DEC-053).
export function replacementItem({ id, original, exercise, restSec }) {
  return {
    id,
    routineItemId: id,
    exerciseId: exercise.id,
    exerciseName: exercise.name || 'Exercise',
    equipment: exercise.equipment || '',
    exerciseType: exercise.type || 'free',
    weightStep: exercise.weightStep || 'n/a',
    // req-119 — Timed frozen from the replacement's exercise, as buildPlannedWorkout does.
    hasDuration: Boolean(exercise.hasDuration),
    role: original?.role || 'main',
    sets: 1,
    targets: [],
    suggestedWeights: [],
    durations: [],
    restSec: Number(restSec) || 0,
    notes: '',
    warmup: null,
    addedMidWorkout: true,
  }
}

// req-119 (DESIGN §3) — the exercise the live set form reads, for one snapshot item.
// `live` is the Library exercise (null when deleted). A snapshot item that carries
// `hasDuration` (built by buildPlannedWorkout / replacementItem since req-119) is
// authoritative for what was frozen at Start: name, equipment, type and Timed. Only
// weight step and cues (edited from inside the workout, workout/setup.jsx), plus
// durationSec (no snapshot field), stay live. An item WITHOUT `hasDuration` (a
// workout started before req-119) reads the live exercise exactly as before.
export function sessionExercise(live, item) {
  const fallback = {
    name: item.exerciseName,
    equipment: item.equipment,
    type: item.exerciseType,
    weightStep: item.weightStep,
    cues: '',
  }
  if (!('hasDuration' in item)) return live || fallback
  return {
    ...(live || fallback),
    name: item.exerciseName,
    equipment: item.equipment,
    type: item.exerciseType,
    hasDuration: Boolean(item.hasDuration),
  }
}

// req-109 — "Replace exercise": skip the original exactly as Skip exercise does, then
// insert `replacement` directly after it. This workout only: the routine is untouched.
// Unknown original → null.
export function replaceItemPatch(workout, itemId, replacement) {
  const skip = skipItemPatch(workout, itemId)
  if (!skip) return null
  const items = []
  for (const item of workout.snapshot?.items || []) {
    items.push(item)
    if (itemKey(item) === itemId) items.push(replacement)
  }
  return { ...skip, snapshot: { ...workout.snapshot, items } }
}

// req-109 — the overview's "skipped" state: the item has sets and every one of them is
// skipped. Derived from the sets alone (no stored marker); one logged set → not skipped.
export function itemAllSkipped(workout, item) {
  const logged = setsForItem(workout?.sets, item)
  return logged.length > 0 && logged.every(isSkippedSet)
}

export function itemLoggingState(workout, item) {
  const logged = setsForItem(workout?.sets, item)
  const wuLogged = logged.some((set) => set.setType === 'wu')
  const workLogged = logged.filter((set) => set.setType !== 'wu')
  const needsWu = Boolean(item?.warmup) && !wuLogged
  const workCount = workCountFor(item)
  return {
    logged,
    wuLogged,
    workLogged,
    needsWu,
    workCount,
    currentWorkIndex: workLogged.length,
    plannedDone: !needsWu && workLogged.length >= workCount,
  }
}

export function itemIsMarkedDone(workout, item) {
  const key = itemKey(item)
  const ids = workout?.completedItemIds || workout?.completedSessionItemIds || []
  return ids.includes(key)
}

// req-105 — every exercise in the live workout is done: marked done, or its planned
// sets are all logged (plannedDone) — the same per-item test the overview rows use.
// Gates the req-84 auto-complete summary and promotes the overview's Finish button to
// primary. An empty workout is NOT all done (the overview's empty branch never asks).
export function allItemsDone(workout) {
  const items = workout?.snapshot?.items || []
  if (items.length === 0) return false
  return items.every((item) => itemIsMarkedDone(workout, item) || itemLoggingState(workout, item).plannedDone)
}

// req-116 / DEC-058 §4 — the sets that were actually logged: every set that is not a
// skipped record. A logged warm-up counts (unconfirmed). Drives the Finish screen's and
// the auto-complete summary's set count, and the "Nothing logged" warning.
export function loggedSetCount(workout) {
  return (workout?.sets || []).filter((set) => !isSkippedSet(set)).length
}

export function anythingLogged(workout) {
  return loggedSetCount(workout) > 0
}

// req-116 — the auto-complete summary's gate. It shows only when every exercise is
// done, something was actually logged (an all-skipped workout never auto-finishes,
// DEC-058 §4), and it hasn't been dismissed for this workout. `autoFinishDismissed` is
// an optional flag on the ACTIVE workout (set by Cancel or Edit, so Back from Finish
// and a reload don't re-arm the 10 s countdown); finishedState strips it. A legacy
// active workout without the flag reads as not dismissed.
export function autoCompleteArmed(workout) {
  return allItemsDone(workout) && !workout?.autoFinishDismissed && anythingLogged(workout)
}

// req-11 / DEC-013, refined by req-25 — the activeWorkout patch that marks an
// exercise done. Since req-11 this fires on completing the last set (was: the
// review screen's "Done" button), so the mark-done transition is a pure, testable
// patch rather than inline in the completion handler. Adds the item key to
// completedItemIds. It deliberately does NOT touch restEndsAt/restPausedRemaining:
// req-25 arms a rest on the last set too (rest-on-overview), and this patch runs
// right after the rest patch — clearing rest here would wipe the armed countdown
// before the overview's rest pill renders. Suppression of rest belongs to the skip
// path (restPatchAfterSet), not to marking done.
export function markItemDonePatch(workout, item) {
  const key = itemKey(item)
  return {
    completedItemIds: [
      ...new Set([...(workout?.completedItemIds || workout?.completedSessionItemIds || []), key]),
    ],
  }
}

// req-11 / DEC-013 — the inverse patch: "Add set" on an already-done exercise
// reopens it (removes the key from completedItemIds) so the log screen renders
// again instead of the markedDone guard bouncing back to the overview. The set
// itself is added separately (addWorkingSet); this only clears the done mark.
export function reopenItemPatch(workout, item) {
  const key = itemKey(item)
  return {
    completedItemIds: (workout?.completedItemIds || workout?.completedSessionItemIds || []).filter(
      (id) => id !== key,
    ),
  }
}

export function lastLoggedSetIndex(workout, item) {
  const logged = setsForItem(workout?.sets, item)
  const lastSet = logged[logged.length - 1]
  if (!lastSet) return -1
  return (workout.sets || []).lastIndexOf(lastSet)
}

// req-44 — the one shared skipped-set predicate (was duplicated in storage.js and
// inlined in model.js/item.jsx/finish.jsx). Guards a null/undefined `reps` via
// `|| ''` — the finish.jsx site previously dropped that guard.
export function isSkippedSet(set) {
  return String(set?.reps || '').toLowerCase() === 'skipped'
}

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

// req-117 — the seconds a timed set's form starts from: the restored (Previous) set's
// logged duration when there is one, else the target (durationTargetFor).
export function initialDurationFor({ fromRestore, restore, target }) {
  if (fromRestore && restore?.durationSec != null) return restore.durationSec
  return target
}

// kg + reps to prefill the set-log form, in priority order (req-02 / DEC-002):
//   restore (un-logging via "Previous")  →  session seed override (req-83)  →
//   carried last live set (NO-history exercise only)  →  history prefill weight +
//   target reps (has-history, and the first set of a no-history exercise).
//   `weighted` gates kg — bodyweight / cardio never seed a weight. `carry` is
//   expected to be null whenever the exercise has history, so the with-history path
//   never carries; the explicit `!hasHistory` guard keeps that scope rule visible
//   and testable. Pure so the prefill decision is inspectable, the way the
//   history-prefill rule is.
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
// req-108 / DEC-052 (+ amendment) — only WEIGHT carries. Reps never come from the
// override or the no-history carry: every set prefills its own target for that set
// index, else empty ("each set is separate from each other"). A `reps` still stored on
// an active workout's override (saved before req-108) is ignored here, not migrated;
// likewise a carry's `reps`. The no-history kg carry (DEC-002) is unchanged.
export function setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target, override }) {
  if (fromRestore) {
    return { weight: weighted ? restore.weight : '', reps: restore.reps }
  }
  const ov = override || {}
  const baseWeight = !hasHistory && carry ? carry.weight : history.weight
  return {
    weight: weighted ? (ov.weight != null ? ov.weight : baseWeight) : '',
    reps: target || '',
  }
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
export function initialSetFields({ weighted, fromRestore, restore, hasHistory, history, carry, target, override }) {
  const seed = setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target, override })
  const effort =
    fromRestore && restore.rpe != null && restore.rpe !== ''
      ? rpeOptionValue(restore.rpe) || restore.rpe
      : 3
  const note = fromRestore ? restore.note : ''
  return { weight: seed.weight, reps: seed.reps, effort, note }
}

// req-125 — the set-form draft: what the user has typed on the CURRENT, not-yet-logged
// set (weight / reps / effort / duration / note), kept as ONE optional field on the
// active workout, `activeWorkout.setDraft = { key, weight, reps, effort, durationSec,
// note }`, so leaving the screen (‹ Exercises, the name link, the rest pill) or iOS
// reloading the tab doesn't lose it. Not a schema field: absent on every workout before
// req-125 (reads as "no draft"); migrateState keeps it via workoutSnapshot's spread;
// finishedState strips it; Abandon drops the whole workout. It is only ever what the user
// typed (or, via Previous, the set they just un-logged) — never invented (DESIGN §1).
//
// The key names one set of one item: `<itemKey>|<wu|work>|<workIndex>` (a warm-up is
// always index 0). It doubles as the log form's per-set React key (setSeedKey), so the
// draft is read exactly when the form remounts — on mount / set change, never live.
export function setDraftKey(item, setType, workIndex) {
  const wu = setType === 'wu'
  return `${itemKey(item)}|${wu ? 'wu' : 'work'}|${wu ? 0 : Number(workIndex) || 0}`
}

// The draft for the set `key`, or null — a draft whose key doesn't match the current set
// (that set was logged elsewhere, the item was replaced, a stale draft) is ignored.
export function setDraftFor(workout, key) {
  const draft = workout?.setDraft
  return draft && typeof draft === 'object' && draft.key === key ? draft : null
}

// The draft written as the user edits the form: the form's current values plus the
// note (which lives beside the title, req-80). `durationSec` is the typed seconds as
// entered (a string while editing); absent on a non-timed form.
export function setDraftFromForm(key, { weight, reps, effort, durationSec } = {}, note = '') {
  return {
    key,
    weight: weight ?? '',
    reps: reps ?? '',
    effort: effort ?? '',
    ...(durationSec != null ? { durationSec } : {}),
    note: note ?? '',
  }
}

// Previous (req-125 replaces the old `restore` component state) — the un-logged set's
// values become the draft of the set it returns to, so Previous + reload keeps them.
// Same values restoreFromLoggedSet always gave the form: weight/reps/note of the logged
// set (a skipped set restores empty), its effort mapped to the segment value, a timed
// set's logged seconds. An empty RPE (warm-up) leaves effort to the seed's default.
export function setDraftFromLoggedSet(key, set) {
  const restored = restoreFromLoggedSet(set)
  const effort = restored.rpe !== '' ? rpeOptionValue(restored.rpe) || restored.rpe : ''
  return {
    key,
    weight: restored.weight,
    reps: restored.reps,
    effort,
    ...(restored.durationSec != null ? { durationSec: restored.durationSec } : {}),
    note: restored.note,
  }
}

// The values the log form starts from: the chain `seed` (initialSetFields — req-106/108
// history / carry / target / req-83 override) with a matching draft laid over it, field
// by field. `seed` itself is NOT changed: it stays req-83's comparison base
// (nextSeedOverrides), so a drafted weight change still carries to later sets.
// `weighted` still gates kg; `durationTarget` is the timed set's target seconds.
export function formFieldsWithDraft({ seed, draft, weighted, durationTarget }) {
  const d = draft || {}
  const has = (v) => v != null && v !== ''
  return {
    weight: weighted && d.weight != null ? String(d.weight) : seed.weight,
    reps: d.reps != null ? String(d.reps) : seed.reps,
    effort: has(d.effort) ? d.effort : seed.effort,
    note: d.note != null ? d.note : seed.note,
    durationSec: d.durationSec != null ? d.durationSec : durationTarget,
  }
}

// req-125 — the draft writer: collects edits and writes the latest draft once the user
// pauses for `delayMs` (so a keystroke doesn't re-save the whole state to localStorage).
// `write(setDraft, sync)` does the store write; `flush(sync)` writes a pending draft now
// (leaving the screen, the tab hiding); `cancel()` drops it (the set was just logged or
// un-logged, so a late write can't resurrect it). `form` / `note` remember the latest
// form values per set key, so a note edit is written with the form's values and
// vice-versa; `startValues` is what the form started from, until it reports an edit.
// Timers are injectable so the debounce is unit-tested without waiting.
export const DRAFT_WRITE_MS = 300

export function createSetDraftWriter({
  write,
  delayMs = DRAFT_WRITE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let pending = null
  let timer = null
  let latest = { key: null, values: null }
  const stop = () => {
    if (timer != null) clearTimer(timer)
    timer = null
  }
  const flush = (sync = false) => {
    stop()
    const setDraft = pending
    pending = null
    if (setDraft) write(setDraft, sync)
  }
  const schedule = (setDraft) => {
    pending = setDraft
    stop()
    timer = setTimer(() => flush(), delayMs)
  }
  const remember = (key) => {
    if (latest.key !== key) latest = { key, values: null }
    return latest
  }
  return {
    flush,
    cancel() {
      stop()
      pending = null
      latest = { key: null, values: null }
    },
    form(key, values, note) {
      remember(key).values = values
      schedule(setDraftFromForm(key, values, note))
    },
    note(key, note, startValues) {
      schedule(setDraftFromForm(key, remember(key).values || startValues, note))
    },
  }
}

// store.completeSet's reducer (moved here so it is unit-tested): append the logged set,
// merge the caller's patch (rest, req-83 seedOverrides), and — req-125 — drop the draft
// when ITS set (`draftKey`) is the one just Completed or Skipped. Decided from the
// workout the store update receives (the LATEST state), not the render's copy, so a
// debounced draft write that landed just before Complete can't survive keyed to a set
// already logged. A draft for another set is left alone (setDraftFor ignores it; finish
// strips it). Without `draftKey` this is exactly the old merge.
export function withLoggedSet(workout, setRecord, activePatch = {}, draftKey = null) {
  const next = { ...workout, ...activePatch, sets: [...(workout?.sets || []), setRecord] }
  if (draftKey != null && next.setDraft?.key === draftKey) delete next.setDraft
  return next
}

// req-106 — the target reps a set's log form presents: the warm-up's reps for a 'wu'
// set, else this working set's routine target, else the last target in the list, else
// empty. Was inline in WorkoutItemLive; shared with setPreview so the two can't drift.
export function setTargetFor(item, setType, workIndex) {
  if (setType === 'wu') return String(item?.warmup?.reps ?? '')
  const targets = item?.targets || []
  return targets[workIndex] ?? targets[targets.length - 1] ?? ''
}

// req-85, moved here by req-106 — a timed exercise's work-set target seconds: this
// set's routine duration, else the last one in the list, else the exercise default,
// else the app default. Was view code (item.jsx); shared by the log form and the
// start-of-exercise preview so the two can't drift.
export function durationTargetFor(item, ex, workIndex) {
  const durations = item?.durations || []
  return durations[workIndex] ?? durations[durations.length - 1] ?? ex?.durationSec ?? DEFAULT_DURATION_SEC
}

// req-106 — the start-of-exercise preview: one entry per set of the item (warm-up
// first when there is one), each holding EXACTLY what that set's log form would
// prefill if you reached it now. At the start nothing is logged, so restore and carry
// are null; weight/reps go through initialSetFields with the same history / target /
// session seed-override inputs the form uses (DESIGN §1 — a set with no history has no
// kg, never a guessed or copied one). `historyFor({ setType, workIndex })` is the
// caller's historySetPrefill bound to the exercise's last finished sets (a callback so
// this module stays free of storage.js). Timed work sets carry their target seconds
// in place of reps, as the form does.
export function setPreview({ item, ex, weighted, hasHistory, historyFor, seedOverrides }) {
  const overrides = seedOverrides || {}
  const slots = []
  if (item?.warmup) slots.push({ setType: 'wu', workIndex: 0 })
  for (let i = 0; i < workCountFor(item); i++) slots.push({ setType: 'work', workIndex: i })
  return slots.map(({ setType, workIndex }) => {
    const fields = initialSetFields({
      weighted,
      fromRestore: false,
      restore: null,
      hasHistory,
      history: historyFor({ setType, workIndex }),
      carry: null,
      target: setTargetFor(item, setType, workIndex),
      override: overrides[seedOverrideKey(item.exerciseId, setType)],
    })
    const timed = Boolean(ex?.hasDuration) && setType === 'work'
    const entry = {
      setType,
      workIndex,
      label: setType === 'wu' ? 'WU' : String(workIndex + 1),
      weight: fields.weight,
      reps: timed ? '' : fields.reps,
      durationSec: timed ? durationTargetFor(item, ex, workIndex) : null,
    }
    return { ...entry, text: setPreviewText(entry, weighted) }
  })
}

// req-106 — one preview line: "1 · 20 kg × 8". A weighted set with no kg shows "—" in
// the kg slot (absent, not invented); bodyweight shows the reps alone; a timed set
// shows its seconds ("30s", as formatSetLine does) in place of reps.
export function setPreviewText({ label, weight, reps, durationSec }, weighted) {
  const amount = durationSec != null ? `${durationSec}s` : reps || '—'
  const body = weighted ? `${weight ? `${weight} kg` : '—'} × ${amount}` : amount
  return `${label} · ${body}`
}

// req-25 — the rest-patch decision, made pure so "when does rest run after a set"
// is inspectable and testable outside the component (DESIGN rule). Rest is armed
// by *completion*, not suppressed by whether it's the last set (that was the bug:
// the final, usually hardest, set got no rest). Only a *skipped* set suppresses
// rest; restSec === 0 means the exercise never rests. Shapes match what the store
// merges into activeWorkout: an armed rest sets restEndsAt (a future ms timestamp)
// and clears any paused value; restSec === 0 leaves restEndsAt untouched (it is
// never armed for such an item, so there is nothing to clear). Uses Date.now() so
// callers stay trivial; tests assert restEndsAt is in the future rather than exact.
export function restPatchAfterSet({ restSec, skipped = false }) {
  if (skipped) return { restEndsAt: null, restPausedRemaining: null }
  if (restSec > 0) {
    return { restEndsAt: Date.now() + restSec * 1000, restPausedRemaining: null }
  }
  return { restPausedRemaining: null }
}

// Pure rest-timer state, derived from the persisted workout-level fields
// (activeWorkout.restEndsAt / restPausedRemaining) and the current time. Kept
// side-effect-free so the "remaining time is recomputed from restEndsAt, not
// frozen or reset across navigation/reload" rule is unit-testable; the
// useRestCountdown hook is just this function plus a tick.
export function restRemaining(active, now) {
  const restEndsAt = active?.restEndsAt ?? null
  const restPausedRemaining = active?.restPausedRemaining ?? null
  const remainingMs =
    restPausedRemaining != null
      ? restPausedRemaining
      : restEndsAt
        ? Math.max(0, restEndsAt - now)
        : 0
  const paused = restPausedRemaining != null
  const resting = remainingMs > 0 || paused
  return { remainingMs, paused, resting }
}
