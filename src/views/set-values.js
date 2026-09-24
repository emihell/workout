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

// WorkoutSetEdit's patch. `showLoad` false (cardio / bodyweight): the kg field isn't
// shown, so the stored weight is left as it is rather than re-read.
export function activeSetPatch({ weight, reps, rpe, note }, { showLoad = true } = {}) {
  const patch = { reps, rpe: effortValue(rpe), note }
  if (!showLoad) return patch
  const kg = kgToSave(weight, 0)
  return kg.error ? null : { weight: kg.value, ...patch }
}

// HistorySet's (and History add set's) set fields. A blank kg stays ''.
export function historySetFields({ weight, reps, rpe, note, setType }) {
  const kg = kgToSave(weight, '')
  if (kg.error) return null
  return { setType, weight: kg.value, reps, rpe: effortValue(rpe), note }
}
