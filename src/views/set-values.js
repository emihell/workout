// req-154 — what each logged-set save writes, from the set forms' RAW field text. Pure
// and JSX-free so `node --test` can import it; the four callers (item.jsx completeSet
// and WorkoutSetEdit, history/edit.jsx HistorySet, history/add-set.js withHistorySet)
// keep their own "empty" value, as SetEditForm's header describes:
//   - live log / active set edit: a blank kg is 0 (as before);
//   - History edit / add: a blank kg stays '' (as before).
// A kg that isn't a number returns null — "don't save". The forms (SetLogForm,
// SetEditForm) already refuse Complete/Save with an inline error (kg-input.js kgError),
// so null here is the backstop: bad text is never written as 0 or NaN.
import { kgToSave } from '../kg-input.js'
import { secondsToSave } from '../seconds-input.js'
import { isSkippedSet } from '../set-rules.js'
import { nextSeedOverrides } from '../workout-log.js'
import { cardioPatch } from '../cardio-set.js'

function effortValue(rpe) {
  return rpe === '' || rpe == null ? null : Number(rpe)
}

// The live log's kg for one set: 0 for an unweighted exercise, else the typed kg
// (blank → 0), or null when it can't be read.
export function liveSetWeight(text, weighted) {
  if (!weighted) return 0
  const kg = kgToSave(text, 0)
  return kg.error ? null : kg.value
}

// req-186 (DEC-103 §4) — Save on a logged set viewed via Previous on the live log screen:
// the SetLogForm's values ({ weight, reps, effort, durationSec }) as the set patch, read
// the way completeSet reads them (blank kg → 0, unweighted → 0; a timed work set keeps its
// seconds and no reps). Unreadable kg → null (don't save).
// Review fixes: `initialEffort` is what the form showed — rpe is written ONLY when the
// effort was actually changed (a reps-only edit never rescales a stored rpe, e.g. 1 → 2,
// via the segment mapping); a hidden effort (null) never writes rpe. `set` is the stored
// record: editing a skipped set into a real one clears its 'skipped' note, and writes the
// effort the form SHOWED even if untouched (re-review fix 2: the shown value is what the
// user confirmed; a skipped record has no rpe of its own to keep).
// req-194 — `cardio` (the cardio form's parsed values): each field set, or `undefined` when
// blank (cardioPatch), so a cleared Level / Distance is absent once saved.
export function liveSetEditPatch({ weight, reps, effort, durationSec, cardio }, { weighted, timed = false, initialEffort, set } = {}) {
  const kg = liveSetWeight(weight, weighted)
  if (kg == null) return null
  const patch = { weight: kg, reps: timed ? '' : reps || '' }
  if (timed && durationSec != null) patch.durationSec = durationSec
  if (cardio) Object.assign(patch, cardioPatch(cardio))
  const unskipped = isSkippedSet(set) && !isSkippedSet(patch)
  const shown = effort != null && effort !== ''
  if (shown && (unskipped || String(effort) !== String(initialEffort))) patch.rpe = Number(effort)
  if (unskipped && set.note === 'skipped') patch.note = ''
  return patch
}

// req-186 review fix 2 — everything Save on a viewed set writes: the set patch, and the
// session seed overrides re-run for that set the way completeSet runs them (DEC-052: an
// in-session kg change carries to the remaining sets). `presentedWeight` is the kg the
// viewed form showed (the logged one) — the comparison base, as `seed` is for Complete.
// `seedOverrides` is the SAME map when the kg didn't change (caller skips the write).
// Re-review fix 1 — only the item's LATEST logged set of that set type re-runs the carry
// (as completeSet would have: it is the set the carry came from). Editing an earlier set
// (set 1 while set 2 set the carry) leaves the carry alone. `sets` / `setIndex`: the
// active workout's sets and the viewed set's index in them.
export function viewedSetSave(values, { weighted, timed = false, initialEffort, set, presentedWeight, seedOverrides, sets = [], setIndex = -1 }) {
  const setPatch = liveSetEditPatch(values, { weighted, timed, initialEffort, set })
  if (!setPatch) return null
  const type = set.setType === 'wu' ? 'wu' : 'work'
  const sameKind = (other) =>
    (other.routineItemId || '') === (set.routineItemId || '') &&
    other.exerciseId === set.exerciseId &&
    (other.setType === 'wu' ? 'wu' : 'work') === type
  const latest = !sets.slice(setIndex + 1).some(sameKind)
  if (!latest) return { setPatch, seedOverrides }
  const overrides = nextSeedOverrides(seedOverrides, {
    exerciseId: set.exerciseId,
    setType: set.setType === 'wu' ? 'wu' : 'work',
    weighted,
    seed: { weight: presentedWeight },
    logged: { weight: setPatch.weight },
  })
  return { setPatch, seedOverrides: overrides }
}

// WorkoutSetEdit's patch. `showLoad` false (cardio / bodyweight): the kg field isn't
// shown, so the stored weight is left as it is rather than re-read.
// req-194 — `cardio` (SetEditForm's parsed cardio values, a cardio set only): merged as
// cardioPatch (blank → undefined → absent once saved).
export function activeSetPatch({ weight, reps, rpe, note, cardio }, { showLoad = true } = {}) {
  const patch = { reps, rpe: effortValue(rpe), note, ...(cardio ? cardioPatch(cardio) : {}) }
  if (!showLoad) return patch
  const kg = kgToSave(weight, 0)
  return kg.error ? null : { weight: kg.value, ...patch }
}

// HistorySet's (and History add set's) set fields. A blank kg stays ''.
// req-163 (req-117 b) — a `durationSec` in the values (the form showed Duration: a timed
// exercise's work set) is saved as whole seconds (`30,5` → 31); blank → null (no
// duration). Absent (the field wasn't shown) → no durationSec key, so the stored one is
// left as it is.
// req-194 — `cardio` (a cardio set's parsed values) passes through as `fields.cardio`; the
// callers apply it with withCardioValues (cardio-set.js), which removes a blank field's key.
export function historySetFields({ weight, reps, rpe, note, setType, durationSec, cardio }) {
  const kg = kgToSave(weight, '')
  if (kg.error) return null
  const fields = { setType, weight: kg.value, reps, rpe: effortValue(rpe), note, ...(cardio ? { cardio } : {}) }
  if (durationSec === undefined) return fields
  const seconds = secondsToSave(durationSec, null)
  if (seconds.error) return null
  return { ...fields, durationSec: seconds.value }
}

// req-163 (DEC-087 §2, req-117 b) — what History's set form shows for a set of this
// exercise, decided the way the live forms decide it: Effort only on a work set of a
// non-cardio exercise; Duration only on a work set of a timed exercise. The exercise's
// kind comes from the workout's snapshot item (frozen at Start, as History records it),
// else the exercise record.
export function historySetKind(item, exercise) {
  const type = item?.exerciseType || exercise?.type
  const timed = item?.hasDuration ?? Boolean(exercise?.hasDuration)
  return {
    showEffort: (setType) => setType !== 'wu' && type !== 'cardio',
    showDuration: (setType) => Boolean(timed) && setType !== 'wu',
    cardio: type === 'cardio',
    // req-194 — a cardio exercise that isn't timed: Duration (clock) / Level / Distance.
    cardioFields: type === 'cardio' && !timed,
  }
}
