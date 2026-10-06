// req-126 / DEC-059 §2 — the exercise weight step: a single kg increment, or the
// alternating 4/5 machine series. The STORED form is unchanged ('2.5', 'Alt 4/5',
// 'n/a'); nothing on disk is rewritten. Pure (no imports): progress.js reads it and
// both editors (Exercises.jsx, workout/setup.jsx) build their fields from it.
// req-193 / DEC-108 §6 — "Two step sizes": any two increments, stored 'Steps A/B' (A is
// added first, then B, alternating). The legacy 'Alt 4/5' stays valid and keeps its
// meaning: 5 first, then 4 (from 9 with no lightest weight, progress.js).
// The optional `lightestWeight` (kg, a number) is the stack's first weight.

import { normalizeKgText } from './kg-input.js'

export const ALTERNATING = 'Alt 4/5'
export const NO_STEP = 'n/a'

// Same number shape as req-118's Kg field, but ONE value: `/` is an error here, not a
// set separator (so this is deliberately not routine-item-parse's parseKg). A leading
// '+' and a trailing '.' are accepted because main's Number() read them ('+2.5', '2.')
// and the old free-text editor saved them verbatim; '1e1', '0x5', negatives still fail.
const STEP_NUMBER = /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/

// One increment in kg, or null. Comma is a decimal point (DEC-058 §1); an optional
// `kg` suffix; must be > 0.
export function parseWeightStep(text) {
  const token = normalizeKgText(text)
  if (!STEP_NUMBER.test(token)) return null
  const n = Number(token)
  return Number.isFinite(n) && n > 0 ? n : null
}

// req-193 — the two step sizes in the order they are ADDED, or null. Two stored forms:
// - 'Steps A/B' (what the editor writes): A first, then B. Comma decimals read ('Steps 2,5/5').
// - the exact legacy 'Alt 4/5' (ALTERNATING): 5 first, then 4 — the series main always ran
//   (9, 14, 18 …), so it reads [5, 4]. Anything else ('alt 4/5', 'Alt 2.5/5', '4/5') → null.
const STEP_TOKEN = '(\\d+(?:[.,]\\d+)?)'
const TWO_STEPS = new RegExp(`^Steps ${STEP_TOKEN}/${STEP_TOKEN}$`)
export const LEGACY_TWO_STEPS = [5, 4]
export function parseTwoSteps(stored) {
  if (stored === ALTERNATING) return [...LEGACY_TWO_STEPS]
  const match = typeof stored === 'string' ? TWO_STEPS.exec(stored) : null
  if (!match) return null
  const steps = [parseWeightStep(match[1]), parseWeightStep(match[2])]
  return steps.every((n) => n != null) ? steps : null
}

export function twoStepsValue(first, second) {
  return `Steps ${first}/${second}`
}

export const MAX_LIGHTEST_WEIGHT = 250

// req-193 — a stored lightestWeight as a number, or null (absent / null / '' / unreadable /
// not > 0). Lenient like parseWeightStep: '7,5' reads 7.5.
export function parseLightestWeight(stored) {
  if (stored == null || stored === '') return null
  if (typeof stored === 'number') return Number.isFinite(stored) && stored > 0 ? stored : null
  return parseWeightStep(stored)
}

function isEmptyStep(stored) {
  const text = String(stored ?? '').trim()
  return !text || text.toLowerCase() === NO_STEP
}

// Editor fields from a stored value. `unreadable` holds the raw stored text when it is
// neither empty, the alternating series, nor a number — the editor shows it with a note
// and leaves it on disk unless the user edits the step.
// req-193: with Two step sizes on, `amount` is the first step and `second` the second.
export function weightStepFields(stored) {
  const two = parseTwoSteps(stored)
  if (two) return { amount: String(two[0]), second: String(two[1]), alternating: true, unreadable: null }
  if (isEmptyStep(stored)) return { amount: '', second: '', alternating: false, unreadable: null }
  const text = String(stored).trim()
  if (parseWeightStep(text) != null) return { amount: text, second: '', alternating: false, unreadable: null }
  return { amount: text, second: '', alternating: false, unreadable: text }
}

// req-193 — the note for one of the two step boxes; blank is an error only once Save was tried.
function twoStepNote(text, tried) {
  const value = String(text ?? '').trim()
  if (!value) return tried ? 'Enter both step sizes' : null
  return parseWeightStep(value) == null ? `Can't read '${value}' — enter a step size` : null
}

// The editor's inline note, or null. `4/5`-shaped text is offered as the alternating
// series (req-126 2b).
export function weightStepNote(fields, { tried = false } = {}) {
  if (fields.alternating) return twoStepNote(fields.amount, tried) ?? twoStepNote(fields.second, tried)
  const text = String(fields.amount ?? '').trim()
  if (!text || parseWeightStep(text) != null) return null
  const looksAlternating = /^(?:alt\s*)?4\s*\/\s*5$/i.test(text)
  return looksAlternating
    ? `Can't read '${text}' — enter a step, or tick Two step sizes?`
    : `Can't read '${text}' — enter an increment`
}

// What Save writes. `touched` is false until the user changes the number or the
// checkbox: an untouched step is `{ unchanged: true }` — Save leaves the field exactly as
// stored, whatever its shape (an unreadable 'abc', '', null, or absent), so nothing is
// silently replaced. Otherwise { value } or { error }.
export function weightStepToSave(fields, { stored, touched }) {
  if (!touched) return { unchanged: true, value: stored }
  if (fields.alternating) {
    const note = weightStepNote(fields, { tried: true })
    if (note) return { error: note }
    const first = parseWeightStep(fields.amount)
    const second = parseWeightStep(fields.second)
    // req-193 re-review — the legacy pair re-saved (untick/re-tick, retyped 5 / 4) keeps
    // 'Alt 4/5': 'Steps 5/4' would count from 0 (5, 9, 14) instead of the stored 9, 14, 18.
    if (stored === ALTERNATING && first === LEGACY_TWO_STEPS[0] && second === LEGACY_TWO_STEPS[1]) {
      return { value: ALTERNATING }
    }
    return { value: twoStepsValue(first, second) }
  }
  const text = String(fields.amount ?? '').trim()
  if (!text) return { value: NO_STEP }
  const n = parseWeightStep(text)
  if (n == null) return { error: weightStepNote(fields) }
  return { value: String(n) }
}

// The exercise detail line: "Increment 2.5 kg" / "Two steps 5/4 kg" (in the order added); nothing for no
// step; an unreadable value shows as stored (never hidden).
export function describeWeightStep(stored) {
  const two = parseTwoSteps(stored)
  if (two) return `Two steps ${two[0]}/${two[1]} kg`
  if (isEmptyStep(stored)) return null
  const n = parseWeightStep(stored)
  return n == null ? String(stored).trim() : `Increment ${n} kg`
}

// req-193 — the "Lightest weight (kg)" box. The editor's inline note, or null (blank is
// fine: no lightest weight). abc / negative / 0 / over 250 kg block Save.
export function lightestWeightNote(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const token = normalizeKgText(raw)
  if (/^-\s*\d/.test(token)) return 'Lightest weight must be more than 0 kg'
  const n = parseWeightStep(raw)
  if (n == null) {
    return Number(token) === 0 && STEP_NUMBER.test(token)
      ? 'Lightest weight must be more than 0 kg'
      : `Can't read '${raw}' — enter a weight in kg`
  }
  if (n > MAX_LIGHTEST_WEIGHT) return `Lightest weight can't be over ${MAX_LIGHTEST_WEIGHT} kg`
  return null
}

export function lightestWeightText(stored) {
  return stored == null ? '' : String(stored)
}

// What Save writes for the lightest weight. Untouched → { unchanged: true } (the key, or its
// absence, stays as stored). Blank → null (cleared). Otherwise { value: number } or { error }.
export function lightestWeightToSave(text, { stored, touched }) {
  if (!touched) return { unchanged: true, value: stored }
  const note = lightestWeightNote(text)
  if (note) return { error: note }
  const raw = String(text ?? '').trim()
  return { value: raw ? parseWeightStep(raw) : null }
}

export function describeLightestWeight(stored) {
  const n = parseLightestWeight(stored)
  return n == null ? null : `Lightest ${n} kg`
}
