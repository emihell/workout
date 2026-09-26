// req-178 (DEC-096 §3–4) — the "update routine" offer after an exercise: the kg you logged
// today vs the LIVE routine item's kg, per set. Confirmed by a tap, never automatic (Finish
// still never writes the routine, DEC-056), and per routine: it names that routine's item
// only, so Day B's same exercise is untouched. Pure; the overview renders it and
// store.applyRoutineUpdate writes it through routineItemUpdated.
import { isWeightedType } from './ids.js'
import { routineById } from './model.js'
import { isSkippedSet } from './set-rules.js'
import { itemKey, setsForItem } from './workout-log.js'

// Two kg lists equal as numbers (0 / '' / missing = no weight) and in length.
export function sameKgList(a, b) {
  const x = a || []
  const y = b || []
  if (x.length !== y.length) return false
  return x.every((value, i) => (Number(value) || 0) === (Number(y[i]) || 0))
}

// → { routineId, routineName, itemId, from, to } | null. `to` is the routine's kg with each
// logged, non-skipped work set's kg (> 0) at its index, up to the routine item's set count.
// null: nothing differs, all skipped, a mid-workout replacement, an unweighted exercise, or
// the routine / its item no longer there (deleted or archived).
export function routineUpdateOffer(active, routines, item) {
  if (!active || !item || item.addedMidWorkout) return null
  if (!isWeightedType(item.exerciseType)) return null
  const routine = routineById(routines, active.routineId || active.snapshot?.routineId)
  if (!routine || routine.archivedAt) return null
  const live = (routine.exercises || []).find((candidate) => candidate.id === itemKey(item))
  if (!live) return null
  const sets = Math.max(1, Number(live.sets) || 1)
  const from = Array.isArray(live.suggestedWeights) ? live.suggestedWeights : []
  const to = [...from]
  const work = setsForItem(active.sets, item).filter((set) => set.setType !== 'wu')
  work.forEach((set, i) => {
    const kg = Number(set.weight)
    if (i >= sets || isSkippedSet(set) || !(kg > 0)) return
    while (to.length < i) to.push(0)
    to[i] = kg
  })
  if (sameKgList(from, to)) return null
  return { routineId: routine.id, routineName: routine.name, itemId: live.id, from, to }
}

// "105/105/100" — a set with no weight reads "—" (req-113).
export function kgListText(list) {
  return (list || []).map((value) => (Number(value) > 0 ? String(Number(value)) : '—')).join('/')
}
