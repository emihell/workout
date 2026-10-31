// req-270 — split from workout-log.js: edits to a workout's items and sets, and the per-item questions they need (key, sets, logging state, done mark).
import { isSkippedSet } from './set-rules.js'

// req-165 (F-DEAD-3) — the legacy `session*` fallbacks (sessionItemId, sessionId,
// sessionName, completedSessionItemIds) are gone from every reader: migrateState strips
// them on every load and import (model.js), so they could never be reached.
export function itemKey(item) {
  return item?.routineItemId || item?.id || ''
}

// req-262 — an item with no key ('' from itemKey) or no id matches by neither: '' === '' and
// undefined === undefined made every key-less item claim every key-less set. Such an item
// matches by exerciseId alone (the legacy rule). Keyed items are unchanged.
export function setsForItem(sets, item) {
  const key = itemKey(item)
  const id = item?.id
  return (sets || []).filter(
    (set) =>
      (key !== '' && set.routineItemId === key) ||
      (id != null && set.routineItemId === id) ||
      (!set.routineItemId && set.exerciseId === item?.exerciseId),
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

// The mid-workout item for `exercise`: a Swap's replacement (inserted after `original`) or,
// since req-188, an Add exercise item (`original` null, appended). Nothing is copied from the
// original but its ROLE (a slot value: a warm-up replacement still reads as a warm-up; an added
// item is main); no warm-up, no notes. `id` must be unique and must not be a routine template
// item's id; it is both `id` and `routineItemId`. Prefill then comes from the exercise's own
// history through the normal log-form rule (DEC-053).
// - `prescription` given (req-188 / DEC-104): its sets, reps, kg, durations and rest — history's
//   prescription (routine-picker.js pickerItem), or for a no-history exercise the sets and rest
//   the user typed (mid-workout-pick.js noHistoryItem; reps and kg blank). Never invented.
// - absent (req-109 / req-178, kept for its callers and tests): 1 working set, no reps target,
//   `restSec` / `suggestedWeights` the caller's (history's rest and first kg, else 0 / []).
// - `replacesItemId` (req-188 review): the key of the item a Swap replaced, set only on a Swap
//   item, so the workout pill (currentWorkoutItem) tells a replacement from an appended item.
//   Kept across reloads (migrateState passes mid-workout items through unchanged).
function prescribed(prescription, restSec, suggestedWeights) {
  if (!prescription) return { sets: 1, targets: [], suggestedWeights, durations: [], restSec: Number(restSec) || 0 }
  const list = (value) => (Array.isArray(value) ? [...value] : [])
  return {
    sets: Math.max(1, Math.floor(Number(prescription.sets)) || 1),
    targets: list(prescription.targets),
    suggestedWeights: list(prescription.suggestedWeights),
    durations: list(prescription.durations),
    restSec: Number(prescription.restSec) || 0,
  }
}

export function replacementItem({ id, original, exercise, restSec, suggestedWeights = [], prescription = null }) {
  const plan = prescribed(prescription, restSec, suggestedWeights)
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
    sets: plan.sets,
    targets: plan.targets,
    suggestedWeights: plan.suggestedWeights,
    durations: plan.durations,
    restSec: plan.restSec,
    notes: '',
    warmup: null,
    addedMidWorkout: true,
    ...(original && itemKey(original) ? { replacesItemId: itemKey(original) } : {}),
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

// req-188 (DEC-103 §2) — "Add exercise" from the workout list: `item` (a replacementItem with
// no original) appended at the end of the snapshot. This workout only: the routine is untouched,
// no set is written. A key already in the snapshot → null.
export function appendItemPatch(workout, item) {
  const items = workout?.snapshot?.items || []
  if (!item || items.some((candidate) => itemKey(candidate) === itemKey(item))) return null
  return { snapshot: { ...workout.snapshot, items: [...items, item] } }
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
  const ids = workout?.completedItemIds || []
  return ids.includes(key)
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
      ...new Set([...(workout?.completedItemIds || []), key]),
    ],
    // req-194 re-review — a stopwatch running for one of THIS item's sets stops when the item
    // is marked done (its last set logged, Skip exercise, Swap via skipItemPatch, Remove set),
    // so a later "Add set" can't reopen it with all the minutes since. Only present then.
    ...(stopwatchItemKey(workout) === key ? { stopwatch: null } : {}),
  }
}

// The item key a stopwatch's draftKey (`<itemKey>|<wu|work>|<n>`, setDraftKey) belongs to.
function stopwatchItemKey(workout) {
  const draftKey = workout?.stopwatch?.draftKey
  return typeof draftKey === 'string' ? draftKey.slice(0, draftKey.lastIndexOf('|', draftKey.lastIndexOf('|') - 1)) : null
}

// req-11 / DEC-013 — the inverse patch: "Add set" on an already-done exercise
// reopens it (removes the key from completedItemIds) so the log screen renders
// again instead of the markedDone guard bouncing back to the overview. The set
// itself is added separately (addWorkingSet); this only clears the done mark.
export function reopenItemPatch(workout, item) {
  const key = itemKey(item)
  return {
    completedItemIds: (workout?.completedItemIds || []).filter(
      (id) => id !== key,
    ),
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
  // req-194 review fix 1 — Done / Skip set on the set the stopwatch runs for stops it.
  if (draftKey != null && next.stopwatch?.draftKey === draftKey) delete next.stopwatch
  return next
}

// req-212 (DEC-119 §1) — the exercise review's one effort. The sets it covers: this item's
// logged work sets that are not skipped (a warm-up, a skipped set and another exercise's
// sets are never touched). `withItemEffort` writes `rpe` (a number, or null = no effort) on
// each of them and leaves every other field — `loggedAt` included — as it was, so the
// per-set rule in progress.js reads the one exercise effort unchanged.
export function itemEffortSets(workout, item) {
  return setsForItem(workout?.sets, item).filter((set) => set.setType !== 'wu' && !isSkippedSet(set))
}

export function withItemEffort(workout, item, rpe) {
  if (!workout || !item) return workout
  const targets = new Set(itemEffortSets(workout, item))
  if (!targets.size) return workout
  const value = rpe === '' || rpe == null ? null : Number(rpe)
  return { ...workout, sets: (workout.sets || []).map((set) => (targets.has(set) ? { ...set, rpe: value } : set)) }
}

// The effort the review shows as picked: the one rpe every covered set shares, when it is
// one the review offers (2 / 3 / 4); else '' (nothing picked — a fresh exercise, sets that
// differ, or an old Failure the review no longer offers).
export function itemEffort(workout, item) {
  const sets = itemEffortSets(workout, item)
  if (!sets.length) return ''
  const first = sets[0].rpe
  if (first == null || first === '' || !sets.every((set) => String(set.rpe) === String(first))) return ''
  return [2, 3, 4].includes(Number(first)) ? Number(first) : ''
}
