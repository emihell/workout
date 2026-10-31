import { rpeOptionValue } from './ids.js'
import { cardioBits, hasCardioFields } from './cardio-set.js'
import { DEFAULT_DURATION_SEC, isAddedMidWorkout, isSkippedSet } from './set-rules.js'
import { itemIsMarkedDone, itemKey, itemLoggingState, setsForItem, workCountFor } from './workout-items.js'

// req-109 — the overview's "skipped" state: the item has sets and every one of them is
// skipped. Derived from the sets alone (no stored marker); one logged set → not skipped.
export function itemAllSkipped(workout, item) {
  const logged = setsForItem(workout?.sets, item)
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
// req-194 — `cardio` (a cardio form only): the raw Duration / Level / Distance text and the
// unit (+ `watched`: Duration holds the stopwatch's time). The running stopwatch is NOT here
// (review fix 1): it is activeWorkout.stopwatch, see startStopwatchPatch.
export function setDraftFromForm(key, { weight, reps, effort, durationSec, cardio } = {}, note = '') {
  return {
    key,
    weight: weight ?? '',
    reps: reps ?? '',
    effort: effort ?? '',
    ...(durationSec != null ? { durationSec } : {}),
    ...(cardio != null ? { cardio: { ...cardio } } : {}),
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
    // req-194 — a cardio form's drafted fields + running stopwatch; absent when not drafted.
    ...(d.cardio && typeof d.cardio === 'object' ? { cardio: d.cardio } : {}),
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

// req-194 review fix 1 — the cardio stopwatch: ONE optional field on the active workout,
// `stopwatch: { draftKey, startedAt, baseSec }` — the set it runs for (setDraftKey), its
// start (epoch ms) and the seconds it resumed from. Separate from `setDraft` (one draft for
// the whole workout, replaced by the next exercise's typing), so another exercise's edits
// can't drop it. Load path: loadState → migrateState → workoutSnapshot, whose snapshotted
// branch spreads `...workout` (kept as is); finishedState strips it; withLoggedSet clears it
// on Done / Skip set of its own set. At most one exists: a second Start is refused while
// the first one's set is still the current set of an exercise not done (stopwatchOwner);
// a stale one (that exercise skipped / swapped / done elsewhere) is taken over.

// The stopwatch running for the set `key`, or null. req-194 re-review — only while it is
// live (stopwatchOwner: its set is still the current set of an exercise not done), so a
// stale one (its item skipped / swapped / done) never shows as running, even if that set's
// key comes back (Add set after Skip exercise).
export function stopwatchFor(workout, key) {
  const watch = workout?.stopwatch
  if (!watch || typeof watch !== 'object' || watch.draftKey !== key) return null
  return stopwatchOwner(workout) ? watch : null
}

// The snapshot item whose CURRENT set the stopwatch runs for, while that exercise isn't
// done — else null (no stopwatch, or a stale one).
export function stopwatchOwner(workout) {
  const key = workout?.stopwatch?.draftKey
  if (!key) return null
  for (const item of workout?.snapshot?.items || []) {
    if (itemIsMarkedDone(workout, item)) continue
    const state = itemLoggingState(workout, item)
    if (state.plannedDone) continue
    if (setDraftKey(item, state.needsWu ? 'wu' : 'work', state.currentWorkIndex) === key) return item
  }
  return null
}

// The patch that starts the stopwatch for the set `key` (from `baseSec`, at `now`), or
// null when another set's stopwatch is still live (refused — stop that one first).
export function startStopwatchPatch(workout, key, baseSec = 0, now = Date.now()) {
  const owner = stopwatchOwner(workout)
  if (owner && workout.stopwatch.draftKey !== key) return null
  return { stopwatch: { draftKey: key, startedAt: now, baseSec: Math.max(0, Math.floor(Number(baseSec) || 0)) } }
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

// req-106 — the start-of-exercise preview: one entry per set of the item (warm-up
// first when there is one), each holding EXACTLY what that set's log form would
// prefill if you reached it now. At the start nothing is logged, so restore and carry
// are null; weight/reps go through initialSetFields with the same history / target /
// session seed-override inputs the form uses (DESIGN §1 — a set with no history has no
// kg, never a guessed or copied one). `historyFor({ setType, workIndex })` is the
// caller's historySetPrefill bound to the exercise's last finished sets (a callback so
// this module stays free of history-queries.js). Timed work sets carry their target seconds
// in place of reps, as the form does.
// req-186 — `workLogged` (optional) is this item's logged work sets this session: when
// given, an upcoming work set's kg follows the same in-session carry its form will use
// (carryForSet — DEC-002 / req-152; still below the routine kg). Absent = the req-106
// start-of-exercise preview (nothing logged, no carry), as before.
// req-217 — `eachSide` (the exercise's library entry is unilateral, library-hints.js): reps read
// "12 each side".
// req-10 — `setupSeed` (setupSeedFor below): the first-time setup's set-2 seed, applied to the
// work set it names, so the list shows what that set's form will prefill.
export function setPreview({ item, ex, weighted, hasHistory, historyFor, seedOverrides, workLogged = null, eachSide = false, setupSeed = null }) {
  const overrides = seedOverrides || {}
  const uniformReps = uniformRepsTargets(item)
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
      carry: workLogged ? carryForSet(setType, workLogged) : null,
      target: setTargetFor(item, setType, workIndex),
      override: overrides[seedOverrideKey(item.exerciseId, setType)],
      routineKg: routineKgFor(item, setType, workIndex),
      uniformReps,
      setup: setupSeed && setType === 'work' && Number(setupSeed.workIndex) === workIndex ? setupSeed : null,
    })
    const timed = Boolean(ex?.hasDuration) && setType === 'work'
    const entry = {
      setType,
      workIndex,
      label: setType === 'wu' ? 'Warm-up' : String(workIndex + 1),
      weight: fields.weight,
      reps: timed ? '' : fields.reps,
      durationSec: timed ? durationTargetFor(item, ex, workIndex) : null,
    }
    return { ...entry, text: setPreviewText(entry, weighted, eachSide) }
  })
}

// req-106 — one preview line: "1 · 20 kg × 8". A weighted set with no kg shows "—" in
// the kg slot (absent, not invented); bodyweight shows the reps alone; a timed set
// shows its seconds ("30s", as formatSetLine does) in place of reps.
// req-217 — `eachSide`: a reps amount reads "12 each side" (a set = both sides, reps per side);
// a blank "—" is unchanged. req-240 — seconds too: "30s each side" (a hold per side).
export function setPreviewText({ label, weight, reps, durationSec }, weighted, eachSide = false) {
  const amount = durationSec != null ? eachSideReps(`${durationSec}s`, eachSide) : reps ? eachSideReps(reps, eachSide) : '—'
  const body = weighted ? `${weight ? `${weight} kg` : '—'} × ${amount}` : amount
  return `${label} · ${body}`
}

// req-186 (DEC-103 §4) — the log screen's set list, kept for the whole exercise. One row
// per set of the item (warm-up first), each:
//   done     → what was LOGGED (a skipped set reads "skipped"), `setIndex` = its index in
//              workout.sets;
//   current  → the set the form is on; upcoming → not reached yet. Both show what that
//              set's form would prefill (setPreview, with the in-session carry), so a
//              blank kg stays "—" (DESIGN §1).
// `highlighted` marks the one row the screen is on: the current set, or — while Previous
// is showing a logged set (`viewingIndex`, an index into workout.sets) — that set.
export function setListRows({ workout, item, ex, weighted, hasHistory, historyFor, viewingIndex = null, eachSide = false }) {
  const state = itemLoggingState(workout, item)
  const sets = workout?.sets || []
  const wuSet = state.logged.find((set) => set.setType === 'wu') || null
  const currentSlot = state.plannedDone ? null : state.needsWu ? 'wu|0' : `work|${state.currentWorkIndex}`
  const slots = setPreview({
    item,
    ex,
    weighted,
    hasHistory,
    historyFor,
    seedOverrides: workout?.seedOverrides,
    workLogged: state.workLogged,
    eachSide,
    setupSeed: setupSeedFor(workout, item),
  })
  return slots.map((slot) => {
    const logged = slot.setType === 'wu' ? wuSet : state.workLogged[slot.workIndex] || null
    if (logged) {
      const setIndex = sets.indexOf(logged)
      return {
        key: `${slot.setType}|${slot.workIndex}`,
        status: 'done',
        setIndex,
        text: loggedSetRowText(slot.label, logged, weighted, ex?.type === 'cardio' && !ex?.hasDuration, eachSide),
        highlighted: viewingIndex != null && viewingIndex === setIndex,
      }
    }
    const key = `${slot.setType}|${slot.workIndex}`
    const status = key === currentSlot ? 'current' : 'upcoming'
    return {
      key,
      status,
      setIndex: -1,
      text: slot.text,
      highlighted: viewingIndex == null && status === 'current',
    }
  })
}

// req-186 — a done row: the logged values in the preview's own shape ("1 · 20 kg × 8").
// req-194 — `cardio` (a non-timed cardio exercise) or a set carrying level / distance: its
// cardio fields, "1 · 12:30 · level 8 · 1.5 km"; an old cardio set (none) keeps its reps text.
// req-217 — `eachSide`: the logged reps read "12 each side" (setPreviewText).
export function loggedSetRowText(label, set, weighted, cardio = false, eachSide = false) {
  if (isSkippedSet(set)) return `${label} · skipped`
  const bits = cardio || hasCardioFields(set) ? cardioBits(set) : []
  if (bits.length) return `${label} · ${bits.join(' · ')}`
  const durationSec = set?.durationSec != null && set.durationSec !== '' ? Number(set.durationSec) : null
  const weight = set?.weight != null && Number(set.weight) !== 0 ? String(set.weight) : ''
  return setPreviewText({ label, weight, reps: set?.reps != null ? String(set.reps) : '', durationSec }, weighted, eachSide)
}

// req-217 (DEC-119 §6) — a unilateral exercise's reps are per side: "12" → "12 each side". Display
// only; the stored reps stay "12". Blank stays blank. req-240 — also takes "30s" (timed sets).
export function eachSideReps(reps, eachSide = true) {
  const text = reps == null ? '' : String(reps)
  return eachSide && text.trim() !== '' ? `${text} each side` : text
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
  const at = items.findIndex((item) => setsForItem([last], item).length > 0)
  const owner = at >= 0 ? items[at] : null
  if (owner && !done(owner)) return owner
  const next = at >= 0 ? items[at + 1] : null
  if (owner && isSkippedSet(last) && next && isAddedMidWorkout(next) && next.replacesItemId === itemKey(owner) && !done(next)) {
    return next
  }
  const lastReal = sets.findLast((set) => !isSkippedSet(set))
  const realOwner = items.find((item) => setsForItem([lastReal], item).length > 0)
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

// req-186 — the pill's rest clock: whole seconds ("45s") under a minute, m:ss ("1:12")
// from 60 s.
export function restClockText(seconds) {
  const sec = Math.max(0, Math.ceil(Number(seconds) || 0))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
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
  const started = setsForItem(workout?.sets || [], item).some((set) => !isSkippedSet(set))
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
