// req-270 — split from workout-log.js: where the workout stands.
import { isAddedMidWorkout, isSkippedSet } from './set-rules.js'
import { restClockText } from './set-display.js'
import { itemIsMarkedDone, itemKey, itemLoggingState, setsForItem } from './workout-items.js'
import { restRemaining } from './workout-timers.js'

// req-109 — the overview's "skipped" state: the item has sets and every one of them is
// skipped. Derived from the sets alone (no stored marker); one logged set → not skipped.
export function itemAllSkipped(workout, item) {
  const logged = setsForItem(workout?.sets, item, workout?.snapshot?.items)
  return logged.length > 0 && logged.every(isSkippedSet)
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

// req-191 §2 — the workout became all-done by a skip: its newest set record is a skipped
// one (Skip exercise, or a set-level Skip of the last set). Derived from the records, no
// stored flag. The auto-complete summary then shows without its countdown, so a mis-tapped
// Skip never finishes the workout on its own; a completed last set keeps the countdown.
export function endedOnSkip(workout) {
  const sets = workout?.sets || []
  return sets.length > 0 && isSkippedSet(sets[sets.length - 1])
}

// req-212 — the review's primary: the next exercise not done, in list order after this one,
// wrapping to the top for one skipped earlier; null when none is left (→ Finish).
export function nextNotDoneItem(workout, item) {
  const items = workout?.snapshot?.items || []
  const at = items.findIndex((candidate) => itemKey(candidate) === itemKey(item))
  const ordered = at < 0 ? items : [...items.slice(at + 1), ...items.slice(0, at)]
  return (
    ordered.find(
      (candidate) => itemKey(candidate) !== itemKey(item) && !itemIsMarkedDone(workout, candidate) && !itemLoggingState(workout, candidate).plannedDone,
    ) || null
  )
}

// req-186 (DEC-103 §3) — the workout pill's "current exercise". Review fix 1 — rule:
//   - nothing LOGGED (no non-skipped set; loggedSetCount's meaning, DEC-058 §4) → null
//     (a Skip exercise / Swap alone writes only skipped records). The pill still shows then:
//     since req-222 workoutPillState falls back to the first not-done item;
//   - the item of the most recent set record (completeSet appends), if it isn't done —
//     a set-level Skip on an exercise in progress keeps it current;
//   - that item done AND its last record skipped AND a replacement (addedMidWorkout)
//     sits right after it in the snapshot (replaceItemPatch inserts it there) and isn't
//     done → the replacement: a Swap points the pill at the swapped-in exercise. req-188
//     review — "replacement" means `replacesItemId` is that item's key: an Add exercise item
//     appended after it (none) is not one, so Skip on the last routine item keeps the pill;
//   - else the item of the most recent NON-skipped set, if it isn't done (a Skip
//     exercise on B doesn't pull the pill back to an untouched A while C is in progress);
//   - else the first not-done item in snapshot order. All done → null.
// "Done" is the overview's test: marked done, or every planned set logged.
export function currentWorkoutItem(workout) {
  const items = workout?.snapshot?.items || []
  const sets = workout?.sets || []
  if (!sets.some((set) => !isSkippedSet(set))) return null
  const done = (item) => itemIsMarkedDone(workout, item) || itemLoggingState(workout, item).plannedDone
  const last = sets[sets.length - 1]
  const at = items.findIndex((item) => setsForItem([last], item, items).length > 0)
  const owner = at >= 0 ? items[at] : null
  if (owner && !done(owner)) return owner
  const next = at >= 0 ? items[at + 1] : null
  if (owner && isSkippedSet(last) && next && isAddedMidWorkout(next) && next.replacesItemId === itemKey(owner) && !done(next)) {
    return next
  }
  const lastReal = sets.findLast((set) => !isSkippedSet(set))
  const realOwner = items.find((item) => setsForItem([lastReal], item, items).length > 0)
  if (realOwner && !done(realOwner)) return realOwner
  return items.find((item) => !done(item)) || null
}

// req-186 — "set N/M" for an item: the set the log form is on, counting a warm-up as a
// set (the counting of item.jsx setProgressLabel, which this replaces; the title no longer
// shows it). Clamped to M once every set is logged.
export function itemSetPosition(workout, item) {
  const state = itemLoggingState(workout, item)
  const hasWu = Boolean(item?.warmup)
  const total = (hasWu ? 1 : 0) + state.workCount
  const current = state.needsWu ? 1 : Math.min(total, (hasWu ? 1 : 0) + state.currentWorkIndex + 1)
  return { current, total }
}

// req-261 — the item the pill is on: currentWorkoutItem, else (before any logged set) the
// first not-done item in snapshot order; null when everything is done. One pick for the pill
// and its "N/M" (workoutPosition), so the words and the item can't disagree.
function pillItem(workout) {
  const done = (candidate) => itemIsMarkedDone(workout, candidate) || itemLoggingState(workout, candidate).plannedDone
  return currentWorkoutItem(workout) || (workout?.snapshot?.items || []).find((candidate) => !done(candidate)) || null
}

// req-186 — everything the workout pill shows, pure: null when there's no current
// exercise; else the item, "set N/M", and either the rest clock (resting) or GO.
// req-203 §7 (Lena s20) — once the last set of an exercise is logged the pill moves on to
// the next exercise, which has nothing logged yet; "set 1/3" there read as the exercise
// just finished. So an item with no logged (non-skipped) set carries no set count:
// `setText` is '' and the label is the clock or GO alone. The count returns with its
// first logged set.
// req-222 (DEC-125 §3) — the pill shows from the start: before any logged set (where
// currentWorkoutItem stays null) its item is the first not-done item in snapshot order, so
// a fresh workout reads "GO · 1/7". And it carries the whole-workout count (`countText`,
// workoutPosition): "GO · set 2/4 · 3/7", resting "1:12 · set 2/4 · 3/7", "GO · 3/7"
// before a set of the current item. All done (or no items) → null, as before.
export function workoutPillState(workout, now) {
  const item = pillItem(workout)
  if (!item) return null
  const { current, total } = itemSetPosition(workout, item)
  const { remainingMs, resting } = restRemaining(workout, now)
  const started = setsForItem(workout?.sets || [], item, workout?.snapshot?.items).some((set) => !isSkippedSet(set))
  const setText = started ? `set ${current}/${total}` : ''
  const clock = resting ? restClockText(remainingMs / 1000) : null
  const lead = resting ? clock : 'GO'
  const position = workoutPosition(workout)
  const countText = position ? `${position.current}/${position.total}` : ''
  return {
    item,
    current,
    total,
    resting,
    go: !resting,
    clock,
    setText,
    countText,
    label: [lead, setText, countText].filter(Boolean).join(' · '),
  }
}

// req-189 — an item a Swap replaced: some item in the snapshot carries `replacesItemId` = its
// key (replacementItem sets it, on a Swap item only). Derived; no stored marker. Moved here from
// views/workout/row-label.js (req-222), which re-exports it.
export function itemSwappedAway(workout, item) {
  const key = itemKey(item)
  return Boolean(key) && (workout?.snapshot?.items || []).some((other) => other.replacesItemId === key)
}

// req-222 (DEC-125 §3) — "how far along" the whole workout is, for the pill's "N/M":
//   M = snapshot items minus originals a Swap replaced (the replacement counts instead; an
//       Add exercise item counts; a plain Skip exercise still counts — it is done);
//   N = the 1-based place, among the counted items, of the item the pill is on (pillItem).
// req-261 (DEC-155 §2) — N is the open row's place, not done + 1 (it read "Ex 1 of 9" on item
// 2). Nothing open (all done), or the pill's item not among the counted → min(M, done + 1).
// `done` = done items among the counted (skipped included; the overview's done test).
// No counted items → null.
// req-227 — a swapped-away original that is NOT done (reopened by Add set on its review) is
// work left, so it counts again (in M, and as current); a swapped-away done one stays out.
export function workoutPosition(workout) {
  const done = (item) => itemIsMarkedDone(workout, item) || itemLoggingState(workout, item).plannedDone
  const counted = (workout?.snapshot?.items || []).filter((item) => !itemSwappedAway(workout, item) || !done(item))
  if (counted.length === 0) return null
  const doneCount = counted.filter(done).length
  const open = pillItem(workout)
  const at = open ? counted.indexOf(open) : -1
  const current = at >= 0 ? at + 1 : Math.min(counted.length, doneCount + 1)
  return { current, total: counted.length, done: doneCount }
}
