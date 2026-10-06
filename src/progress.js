import { isWeightedType } from './ids.js'
import { ALTERNATING, parseLightestWeight, parseTwoSteps, parseWeightStep } from './weight-step.js'
import { isSkippedSet } from './set-rules.js'

export function validWeights(exercise, max = 250) {
  if (Array.isArray(exercise?.weightOptions) && exercise.weightOptions.length) {
    return [...exercise.weightOptions].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  }
  // req-193 — a lightest weight set: the series counts from it (lightest, + step, …; two
  // step sizes alternate, the first first). No readable step → [] (hold, DEC-030): the
  // lightest weight alone never invents a step. Blank → everything below, unchanged.
  const lightest = parseLightestWeight(exercise?.lightestWeight)
  if (lightest != null) {
    const steps = parseTwoSteps(exercise?.weightStep) ?? [parseWeightStep(exercise?.weightStep)]
    return steps[0] == null ? [] : stepSeries(lightest, steps, max)
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
  // req-193 — 'Steps A/B', no lightest weight: count from 0 like a single step does (0
  // itself is not a weight), so 'Steps 4/5' → 4, 9, 13 … (the legacy 'Alt 4/5' returned above).
  const two = parseTwoSteps(exercise?.weightStep)
  if (two) return stepSeries(0, two, max).slice(1)
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

// req-193 — start, start + steps[0], + steps[1], … up to max, each rounded to 0.01 kg the
// way the single-step series always was (the running sum itself is not rounded).
function stepSeries(start, steps, max) {
  const out = []
  let index = 0
  for (let weight = start; weight <= max; weight += steps[index++ % steps.length]) {
    out.push(Math.round(weight * 100) / 100)
  }
  return out
}

// req-193 — the editors' preview of what the recommendation would move through, from the
// same inputs recommendNextPrescription reads: a bodyweight (or cardio) type or an assisted
// exercise never moves kg; otherwise the first `count` values of validWeights (weightOptions
// included), so the step order (and the legacy 'Alt 4/5' from 9) is visible. No series →
// the hold, said plainly (DEC-030).
export const NO_SERIES_TEXT = 'No step set — suggestions hold'
export const SAME_KG_TEXT = 'Suggestions keep the same kg'
export function weightSeriesPreview(exercise, count = 5) {
  if (!isWeightedType(exercise?.type) || isAssistedExercise(exercise)) return SAME_KG_TEXT
  const series = validWeights(exercise)
  if (!series.length) return NO_SERIES_TEXT
  const more = series.length > count ? ' …' : ''
  return `Weights: ${series.slice(0, count).join(', ')}${more}`
}

export function moveToValidWeight(weight, exercise, direction) {
  const current = Number(weight) || 0
  const options = validWeights(exercise, Math.max(250, current + 100))
  // req-42 / DEC-030 — no valid increment (e.g. weightStep:'n/a'): hold, never
  // invent a step. The recommendation is computed from history using the exercise's
  // *valid* increments; a 0.5 kg default is a load the config never defines.
  if (!options.length) return current
  if (direction > 0) return options.find((option) => option > current) ?? options.at(-1)
  // req-193 — below the lightest weight there is no lighter option: hold at the current kg.
  // On main this returned options[0], so a failed set below the stack's first weight
  // suggested a jump UP (reachable once a lightest weight is set).
  if (current < options[0]) return current
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

function countableReps(value) {
  if (isDurationTarget(value) || isAmrap(value)) return null
  return parseReps(value)
}

// req-150 / DEC-075 — hold instead of guessing. No new rule: where the app can't judge a set
// correctly, that set keeps its kg and target, whatever the effort. req-149 sets real rules.
// A target the app can't read as a single whole number (a range "8-12", AMRAP, a duration,
// any other text) holds. An empty or missing target is "not set" and is judged as before.
export function unreadableTarget(value) {
  const text = String(value ?? '').trim()
  return text !== '' && !/^\d+$/.test(text)
}

// Assisted machines/bands: the kg is assistance (more = easier), so the normal step would move
// the wrong way. Interim detection by library id or name, until req-149's flag.
export const ASSISTED_LIBRARY_IDS = ['own-assisted-pull-up', 'own-assisted-dip', 'Band_Assisted_Pull-Up']
export function isAssistedExercise(exercise) {
  return ASSISTED_LIBRARY_IDS.includes(exercise?.libraryId) || /assisted/i.test(String(exercise?.name ?? ''))
}

export const HOLD_REASONS = {
  target: "Target isn't a single number — kept as is.",
  assisted: 'Assisted: kept as is.',
  lightest: 'Already at the lightest weight — kept as is.',
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
    if (set && !isSkippedSet(set)) lastLogged = index
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
  const assisted = isAssistedExercise(exercise)
  const held = new Set()

  positional.forEach((set, index) => {
    if (!set || isSkippedSet(set)) return
    const actualWeight = Number(set.weight) || 0
    // req-150 — a held set keeps what was done (its kg; its target stays in nextTargets).
    if (assisted || unreadableTarget(targets?.[index] ?? targets?.at(-1))) {
      weights[index] = actualWeight
      held.add(assisted ? 'assisted' : 'target')
      return
    }
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
        // req-193 — at or below the first option "down" can't move: say so (action keep, a
        // reason), never "Load down." with the same kg. Main reported 'down' here.
        const next = moveToValidWeight(actualWeight, exercise, -1)
        weights[index] = next
        if (next === actualWeight) held.add('lightest')
        else movedDown = true
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

  const base = movedDown
    ? 'Load down.'
    : movedUp
      ? 'Load up.'
      : 'Same load.'
  // req-150 — a held set says why; with nothing held the reason is exactly as before.
  const holdNote = [...held].map((why) => HOLD_REASONS[why]).join(' ')
  return {
    weights,
    targets: nextTargets,
    action: movedDown ? 'down' : movedUp ? 'up' : 'keep',
    reason: holdNote ? `${base} ${holdNote}` : base,
  }
}
