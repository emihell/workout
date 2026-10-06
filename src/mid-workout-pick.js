// req-188 / DEC-104 (Emilio, 2026-10-06; amends DEC-059 §1) — what a mid-workout pick (Swap or
// Add exercise) puts in the workout. Pure, so `node --test` drives it; the screens
// (views/workout/mid-workout-picker.jsx) only render it.
//   - the exercise has history → the picker's history prescription (sets, reps, kg, rest);
//   - no history → NOT the routine picker's 3 × 10 / 90 s starting plan: a small step asks for
//     Sets (required, a positive whole number) and Rest in seconds (optional; blank = no rest
//     timer). Reps and kg start blank (DESIGN §1 — nothing invented; the fields start empty).

// A pick from ExercisePicker's onPick needs the step when it has no history.
export function needsSetup(pick) {
  return pick?.source !== 'history'
}

// The step's two fields for one pick, as typed → { item } or { errors: { sets?, rest? } }.
export function noHistoryItem({ sets = '', rest = '' } = {}) {
  const errors = {}
  const setsText = String(sets).trim()
  const restText = String(rest).trim()
  const setsN = /^\d+$/.test(setsText) ? Number(setsText) : NaN
  if (!setsText) errors.sets = 'Enter the number of sets.'
  else if (!(setsN >= 1)) errors.sets = 'Sets must be a whole number, 1 or more.'
  let restSec = 0
  if (restText) {
    if (/^\d+$/.test(restText)) restSec = Number(restText)
    else errors.rest = 'Rest must be whole seconds, or blank for no rest timer.'
  }
  if (errors.sets || errors.rest) return { errors }
  return {
    item: { role: 'main', warmup: null, notes: '', sets: setsN, targets: [], suggestedWeights: [], durations: [], restSec },
  }
}

// Every pick with its item: a history pick keeps the picker's; a no-history pick takes the
// step's values (`values[i]` for picks[i]). → { picks } (each with `item`) or { errors } keyed by
// the pick's index, when any step field is invalid.
export function resolvePicks(picks, values = []) {
  const errors = {}
  const out = (picks || []).map((pick, index) => {
    if (!needsSetup(pick)) return pick
    const result = noHistoryItem(values[index])
    if (result.errors) {
      errors[index] = result.errors
      return pick
    }
    return { ...pick, item: result.item }
  })
  return Object.keys(errors).length ? { errors } : { picks: out }
}

// req-189 / DEC-106 (Emilio, 2026-10-06; amends DEC-104 §2 for Swap only) — a Swap to an
// exercise with no history asks nothing: the new item copies the REPLACED item's set count and
// rest ("the probability of the exercise following the same sets as its replacement is quite
// high"). Reps targets, kg and durations start blank (DESIGN §1 — copied plan shape, never a
// copied or invented number). Add exercise has nothing to copy and keeps the step.
export function swapNoHistoryItem(original) {
  const sets = Math.max(1, Math.floor(Number(original?.sets)) || 1)
  const restSec = Math.max(0, Math.floor(Number(original?.restSec)) || 0)
  return { role: 'main', warmup: null, notes: '', sets, targets: [], suggestedWeights: [], durations: [], restSec }
}

// The Swap's picks with their items: a history pick keeps the picker's; a no-history pick takes
// swapNoHistoryItem(original). Never a step.
export function swapPicks(picks, original) {
  return (picks || []).map((pick) => (needsSetup(pick) ? { ...pick, item: swapNoHistoryItem(original) } : pick))
}
