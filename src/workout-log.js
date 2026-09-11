import { rpeOptionValue } from './ids.js'

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

export function withSkippedUnloggedSets(workout) {
  if (!workout) return workout
  const sets = [...(workout.sets || [])]
  for (const item of workout.snapshot?.items || []) {
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
  const keys = (workout.snapshot?.items || []).map((item) => itemKey(item)).filter(Boolean)
  return {
    ...workout,
    sets,
    completedItemIds: [...new Set([...(workout.completedItemIds || []), ...keys])],
  }
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

// req-11 / DEC-013, refined by req-25 — the activeWorkout patch that marks an
// exercise done. Since req-11 this fires on completing the last set (was: the
// review screen's "Done" button), so the mark-done transition is a pure, testable
// patch rather than inline in the completion handler. Adds the item key to
// completedItemIds. It deliberately does NOT touch restEndsAt/restPausedRemaining:
// req-25 arms a rest on the last set too (rest-on-overview), and this patch runs
// right after the rest patch — clearing rest here would wipe the armed countdown
// before the overview's RestBar renders. Suppression of rest belongs to the skip
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

function isSkippedSet(set) {
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

// kg + reps to prefill the set-log form, in priority order (req-02 / DEC-002):
//   restore (un-logging via "Previous")  →  carried last live set (NO-history
//   exercise only)  →  history prefill weight + target reps (has-history, and
//   the first set of a no-history exercise). `weighted` gates kg — bodyweight /
//   cardio never seed a weight. `carry` is expected to be null whenever the
//   exercise has history, so the with-history path never carries; the explicit
//   `!hasHistory` guard keeps that scope rule visible and testable. Pure so the
//   prefill decision is inspectable, the way the history-prefill rule is.
export function setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target }) {
  if (fromRestore) {
    return { weight: weighted ? restore.weight : '', reps: restore.reps }
  }
  if (!hasHistory && carry) {
    return { weight: weighted ? carry.weight : '', reps: carry.reps }
  }
  return { weight: weighted ? history.weight : '', reps: target || '' }
}

// Everything the live set-log form starts from, decided from inputs alone — the
// history-is-truth rule made testable outside the component (req-17 / DEC-021).
// weight + reps go through the existing setLogSeed (never invents a kg it doesn't
// have); effort and note come from the restore payload only, else the defaults
// (effort 3 "Moderate", empty note). Same priority order as setLogSeed: restore
// (un-logging via "Previous") wins. Pure, so the prefill decision is inspectable.
export function initialSetFields({ weighted, fromRestore, restore, hasHistory, history, carry, target, weightOverride = null }) {
  const seed = setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target })
  // req-27 — an explicit upcoming-weight edit made during rest overrides the
  // computed seed *weight* for this one set: weight only (never reps), never on a
  // restore, and only when the exercise uses weight. `weightOverride` is a value
  // the lifter typed (possibly '' — an explicit blank), so the no-invent rule
  // holds: with no edit (null) the computed blank / history / carry weight stands.
  const weight = !fromRestore && weighted && weightOverride != null ? weightOverride : seed.weight
  const effort =
    fromRestore && restore.rpe != null && restore.rpe !== ''
      ? rpeOptionValue(restore.rpe) || restore.rpe
      : 3
  const note = fromRestore ? restore.note : ''
  return { weight, reps: seed.reps, effort, note }
}

// req-27 — the pending upcoming-set weight the lifter edited during rest, resolved
// for the set the form is about to seed. `pending` is activeWorkout.nextSetWeight,
// scoped to one { itemId, workIndex }: the override applies ONLY to that exact set,
// so an edit never leaks to another set or a different exercise (whose itemId or
// workIndex won't match). Returns the override weight (a string, possibly '' — an
// explicit blank) or null when there is no override for this set. Pure.
export function pendingWeightFor(pending, { itemId, workIndex }) {
  if (!pending) return null
  if (pending.itemId !== itemId || pending.workIndex !== workIndex) return null
  return pending.weight ?? null
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
