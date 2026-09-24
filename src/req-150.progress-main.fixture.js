// req-150 — a frozen copy of main's src/progress.js at b74a179 (before the safe-hold), used only by
// req-150.test.js to prove the output is unchanged for numeric targets and non-assisted exercises.
// Never imported by the app.
import { isWeightedType } from './ids.js'
import { ALTERNATING, parseWeightStep } from './weight-step.js'

export function validWeights(exercise, max = 250) {
  if (Array.isArray(exercise?.weightOptions) && exercise.weightOptions.length) {
    return [...exercise.weightOptions].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  }
  if (exercise?.weightStep === ALTERNATING) {
    const out = []
    let weight = 9
    let addFive = true
    while (weight <= max) {
      out.push(weight)
      weight += addFive ? 5 : 4
      addFive = !addFive
    }
    return out
  }
  // req-126 — the shared single-value parser: stored '2,5', '2.5 kg', '5 kg' now read
  // as their increment (they used to be [] → a silent hold). '4/5', 'abc', 'n/a' → [].
  const step = parseWeightStep(exercise?.weightStep)
  if (step == null) return []
  const out = []
  for (let weight = step; weight <= max; weight += step) {
    out.push(Math.round(weight * 100) / 100)
  }
  return out
}

export function moveToValidWeight(weight, exercise, direction) {
  const current = Number(weight) || 0
  const options = validWeights(exercise, Math.max(250, current + 100))
  // req-42 / DEC-030 — no valid increment (e.g. weightStep:'n/a'): hold, never
  // invent a step. The recommendation is computed from history using the exercise's
  // *valid* increments; a 0.5 kg default is a load the config never defines.
  if (!options.length) return current
  if (direction > 0) return options.find((option) => option > current) ?? options.at(-1)
  return [...options].reverse().find((option) => option < current) ?? options[0]
}

function parseReps(value) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function isDurationTarget(value) {
  const t = String(value || '').toLowerCase()
  return t.includes('min') || t.includes('sec') || /s$/.test(t.replace(/\s/g, ''))
}

function isAmrap(value) {
  return String(value || '').toLowerCase().includes('amrap')
}

// Same predicate as workout-log.js isSkippedSet (not imported: workout-log imports
// model, which imports this file).
function isSkipped(set) {
  return String(set?.reps || '').toLowerCase() === 'skipped'
}

function countableReps(value) {
  if (isDurationTarget(value) || isAmrap(value)) return null
  return parseReps(value)
}

// req-112 / DEC-056 — per set. `sets` is POSITIONAL by work-set index: sets[i] is the
// item's i-th working set, and a skipped (or null / not yet logged) entry is left as the
// routine has it — `weights[i]` (the routine's suggestedWeights) and `targets[i]` stay.
// Each logged set is judged against ITS OWN index's target. It used to take only the
// logged sets, so skipping set 1 judged set 2 against set 1's target and dropped a
// weight. The result keeps every routine weight (never shrinks). It only reaches past
// them up to the last logged set; a skipped hole with no routine weight reads 0 (the
// app's "no weight", as a bodyweight set already records).
export function recommendNextPrescription({ targets, weights: routineWeights, sets, exercise }) {
  const nextTargets = [...(targets || [])]
  const baseWeights = routineWeights || []
  const positional = sets || []
  let lastLogged = -1
  positional.forEach((set, index) => {
    if (set && !isSkipped(set)) lastLogged = index
  })
  const weights = Array.from(
    { length: Math.max(baseWeights.length, lastLogged + 1) },
    (_, index) => Number(baseWeights[index]) || 0,
  )
  let movedUp = false
  let movedDown = false
  // req-42 / DEC-030 — computed once (exercise is constant across the sets). With no
  // valid increment the weighted branch holds instead of moving, so action stays
  // 'keep' and the reported weight never contradicts the action.
  const hasIncrements = validWeights(exercise).length > 0

  positional.forEach((set, index) => {
    if (!set || isSkipped(set)) return
    const actualWeight = Number(set.weight) || 0
    const actualReps = parseReps(set.reps)
    const targetReps = countableReps(targets?.[index] ?? targets?.at(-1))
    const rpe = set.rpe == null ? null : Number(set.rpe)
    const missed = actualReps != null && targetReps != null && actualReps < targetReps
    const bodyweight = !isWeightedType(exercise?.type)

    if (bodyweight || actualWeight <= 0) {
      weights[index] = actualWeight
      if (exercise?.type === 'bodyweight' && targetReps != null) {
        if (missed || rpe >= 5) {
          nextTargets[index] = String(Math.max(1, targetReps - 1))
          movedDown = true
        } else if (rpe != null && rpe <= 2) {
          nextTargets[index] = String(targetReps + 1)
          movedUp = true
        }
      }
      return
    }

    if (missed || rpe >= 5) {
      if (hasIncrements) {
        weights[index] = moveToValidWeight(actualWeight, exercise, -1)
        movedDown = true
      } else {
        weights[index] = actualWeight
      }
    } else if (!missed && rpe != null && rpe <= 2) {
      if (hasIncrements) {
        weights[index] = moveToValidWeight(actualWeight, exercise, 1)
        movedUp = true
      } else {
        weights[index] = actualWeight
      }
    } else {
      weights[index] = actualWeight
    }
  })

  while (nextTargets.length < weights.length) {
    nextTargets.push(nextTargets.at(-1) ?? '')
  }

  return {
    weights,
    targets: nextTargets,
    action: movedDown ? 'down' : movedUp ? 'up' : 'keep',
    reason: movedDown
      ? 'Load down.'
      : movedUp
        ? 'Load up.'
        : 'Same load.',
  }
}
