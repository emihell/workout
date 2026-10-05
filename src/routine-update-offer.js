// req-178 (DEC-096 §3–4) — the "update routine" offer after an exercise: the kg you logged
// today vs the LIVE routine item's kg, per set. Confirmed by a tap, never automatic (Finish
// still never writes the routine, DEC-056), and per routine: it names that routine's item
// only, so Day B's same exercise is untouched. Pure; the overview renders it and
// store.applyRoutineUpdate writes it through routineItemUpdated.
import { isWeightedType } from './ids.js'
import { routineById } from './model.js'
import { isSkippedSet } from './set-rules.js'
import { itemKey, setsForItem, withLoggedSet } from './workout-log.js'

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

// req-182 — the offer's meta line, plain words (unconfirmed wording): "You lifted 32.5 kg ·
// routine says 30 kg", or "… · not in the routine yet" when the routine has no kg there.
export function offerText(offer) {
  const routineHasKg = (offer.from || []).some((kg) => Number(kg) > 0)
  const lifted = `You lifted ${kgListText(offer.to)} kg`
  return routineHasKg ? `${lifted} · routine says ${kgListText(offer.from)} kg` : `${lifted} · not in the routine yet`
}

// req-187 (DEC-103 §1) — the call site's decision: on the set that FINISHES an exercise,
// the offer with that set included (the store's own withLoggedSet, so it is the list the
// store will hold), else null. Not the finishing set → null: no sheet mid-exercise.
// routineUpdateOffer itself is unchanged; this only feeds it the post-Complete workout.
export function offerOnFinishingSet(active, routines, item, setRecord, finishes) {
  if (!finishes || !active) return null
  return routineUpdateOffer(withLoggedSet(active, setRecord), routines, item)
}

// "25" when every set has the same kg, else the per-set list ("25/25/22.5", "—" = none).
function kgSummary(list) {
  const values = (list || []).map((value) => (Number(value) > 0 ? Number(value) : 0))
  if (values.length > 0 && values[0] > 0 && values.every((value) => value === values[0])) return String(values[0])
  return kgListText(list)
}

// req-187 — the sheet's words (unconfirmed wording): title "Update Bench Press?", body
// "You lifted 25 kg · Upper body says 20 kg" (or "… · not in Upper body yet"), and the
// buttons [Keep 20 kg] (or [Keep blank] when the routine has no kg) · [Update routine].
export function offerSheetText(offer, exercise) {
  const routineHasKg = (offer.from || []).some((kg) => Number(kg) > 0)
  const routine = offer.routineName || 'the routine'
  const lifted = `You lifted ${kgSummary(offer.to)} kg`
  return {
    title: `Update ${exercise || 'exercise'}?`,
    body: routineHasKg ? `${lifted} · ${routine} says ${kgSummary(offer.from)} kg` : `${lifted} · not in ${routine} yet`,
    keepLabel: routineHasKg ? `Keep ${kgSummary(offer.from)} kg` : 'Keep blank',
    updateLabel: 'Update routine',
  }
}
