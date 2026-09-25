// req-117 — History "Add set" writes nothing until Save. The old addSetToWorkout
// (helpers.js) appended a placeholder set (reps '') and its snapshot item BEFORE the
// edit form opened, so Cancel left it behind: it counted in "N sets" and fed prefill.
// Now the add form opens on its own route (history-set-add) with an unsaved draft, and
// the set + snapshot item are created only by withHistorySet on Save. Pure and
// JSX-free so `node --test` can import it; its only import is the pure set-values.js
// (the exercise record is passed in).

import { historySetFields } from '../set-values.js'

function idOf(obj) {
  return obj?.routineItemId || obj?.id || ''
}

function lastSetFor(workout, exerciseId, routineItemId) {
  return (workout?.sets || [])
    .filter((set) => (routineItemId ? idOf(set) === routineItemId : set.exerciseId === exerciseId))
    .at(-1)
}

// The item key the new set is filed under — unchanged from addSetToWorkout: the given
// item id, else the item of this exercise's last set in the workout, else a history id.
export function historyAddItemId(workout, exerciseId, routineItemId = null) {
  const last = lastSetFor(workout, exerciseId, routineItemId)
  return routineItemId || idOf(last) || `history-${workout?.id}-${exerciseId}`
}

// The route of the add form. Both ids are URI-encoded path segments.
export function historyAddSetPath(workout, exerciseId, routineItemId = null) {
  const itemId = historyAddItemId(workout, exerciseId, routineItemId)
  return `/history/${workout.id}/set/new/${encodeURIComponent(exerciseId)}/${encodeURIComponent(itemId)}`
}

// The unsaved set the form starts from — the same values addSetToWorkout used to
// write as its placeholder (kg from this item's last set in this workout, else 0).
export function historyAddSetDraft(workout, exerciseId, itemId) {
  const last = lastSetFor(workout, exerciseId, itemId)
  return {
    exerciseId,
    routineItemId: itemId,
    setType: 'work',
    weight: last?.weight || 0,
    reps: '',
    rpe: null,
    note: '',
  }
}

// The workout patch Save writes: the new set appended, and — when the snapshot has no
// item for it yet — the same "Added during history correction" item addSetToWorkout
// added. `values` is the SetEditForm's raw state, coerced as HistorySet's Save does
// (historySetFields: weight '' stays '', `22,5` → 22.5, rpe '' → null). req-154 — a kg
// that isn't a number returns null: nothing to write (the form shows the error).
export function withHistorySet(workout, { exerciseId, itemId, exercise, values }) {
  const fields = historySetFields(values)
  if (!fields) return null
  const sets = [
    ...(workout.sets || []),
    {
      exerciseId,
      routineItemId: itemId,
      setType: fields.setType || 'work',
      weight: fields.weight,
      reps: fields.reps,
      rpe: fields.rpe,
      note: fields.note || '',
      // req-163 (req-117 b) — a timed exercise's seconds, when the form showed Duration.
      ...(fields.durationSec !== undefined ? { durationSec: fields.durationSec } : {}),
    },
  ]
  const items = workout.snapshot?.items || []
  const snapshot = workout.snapshot
    ? {
        ...workout.snapshot,
        items: items.some((item) => idOf(item) === itemId)
          ? items
          : [
              ...items,
              {
                routineItemId: itemId,
                exerciseId,
                exerciseName: exercise?.name || 'Deleted exercise',
                equipment: exercise?.equipment || '',
                exerciseType: exercise?.type || 'free',
                weightStep: exercise?.weightStep || 'n/a',
                role: 'main',
                targets: [],
                suggestedWeights: [],
                restSec: 0,
                notes: 'Added during history correction',
                warmup: null,
              },
            ],
      }
    : workout.snapshot
  return { sets, snapshot }
}
