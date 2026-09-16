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
export function setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target, override }) {
  if (fromRestore) {
    return { weight: weighted ? restore.weight : '', reps: restore.reps }
  }
  const ov = override || {}
  const baseWeight = !hasHistory && carry ? carry.weight : history.weight
  const baseReps = !hasHistory && carry ? carry.reps : target || ''
  return {
    weight: weighted ? (ov.weight != null ? ov.weight : baseWeight) : '',
    reps: ov.reps != null ? ov.reps : baseReps,
  }
}

// req-83 (N9) — the key a seed override is stored under on `activeWorkout.seedOverrides`.
// Per exercise AND per set kind: warm-up ('wu') and working ('work') sets seed
// independently (the separation the seed already uses), so a warm-up change carries
// only to later warm-up sets and NOT to the first working set (decided default: NO).
export function seedOverrideKey(exerciseId, setType) {
  return `${exerciseId}::${setType === 'wu' ? 'wu' : 'work'}`
}

// A weight/reps normalized the same way the seed sources stringify them, so a value
// re-entered unchanged compares equal (no spurious override). Weight compares
// numerically ('5' === '5.0' === 5); reps compares as trimmed strings (targets can be
// non-numeric, e.g. a duration).
function weightSeedString(weight) {
  return weight != null && weight !== '' && Number(weight) !== 0 ? String(weight) : ''
}
function repsSeedString(reps) {
  return reps != null && reps !== '' ? String(reps) : ''
}
function sameWeight(a, b) {
  return (Number(a) || 0) === (Number(b) || 0)
}
function sameReps(a, b) {
  return repsSeedString(a) === repsSeedString(b)
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
export function nextSeedOverrides(overrides, { exerciseId, setType, weighted, seed, logged }) {
  const map = overrides || {}
  const key = seedOverrideKey(exerciseId, setType)
  const prev = map[key] || {}
  const next = { ...prev }
  if (weighted && !sameWeight(logged.weight, seed.weight)) {
    next.weight = weightSeedString(logged.weight)
  }
  if (!sameReps(logged.reps, seed.reps)) {
    next.reps = repsSeedString(logged.reps)
  }
  if (next.weight === prev.weight && next.reps === prev.reps) return map
  return { ...map, [key]: next }
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
