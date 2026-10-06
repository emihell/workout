// req-193 — a frozen copy of main's validWeights / moveToValidWeight (src/progress.js at
// 6832eda) and the parseWeightStep they read (src/weight-step.js at 6832eda), used only by
// req-193.test.js to prove that with no lightest weight the series is byte-identical to
// main. Never imported by the app.
import { normalizeKgText } from './kg-input.js'

const ALTERNATING = 'Alt 4/5'
const STEP_NUMBER = /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/

function parseWeightStep(text) {
  const token = normalizeKgText(text)
  if (!STEP_NUMBER.test(token)) return null
  const n = Number(token)
  return Number.isFinite(n) && n > 0 ? n : null
}

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
