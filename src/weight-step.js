// req-126 / DEC-059 §2 — the exercise weight step: a single kg increment, or the
// alternating 4/5 machine series. The STORED form is unchanged ('2.5', 'Alt 4/5',
// 'n/a'); nothing on disk is rewritten. Pure (no imports): progress.js reads it and
// both editors (Exercises.jsx, workout/setup.jsx) build their fields from it.

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
  const token = String(text ?? '').trim().replace(/\s*kg$/i, '').trim().replace(',', '.')
  if (!STEP_NUMBER.test(token)) return null
  const n = Number(token)
  return Number.isFinite(n) && n > 0 ? n : null
}

function isEmptyStep(stored) {
  const text = String(stored ?? '').trim()
  return !text || text.toLowerCase() === NO_STEP
}

// Editor fields from a stored value. `unreadable` holds the raw stored text when it is
// neither empty, the alternating series, nor a number — the editor shows it with a note
// and leaves it on disk unless the user edits the step.
export function weightStepFields(stored) {
  if (stored === ALTERNATING) return { amount: '', alternating: true, unreadable: null }
  if (isEmptyStep(stored)) return { amount: '', alternating: false, unreadable: null }
  const text = String(stored).trim()
  if (parseWeightStep(text) != null) return { amount: text, alternating: false, unreadable: null }
  return { amount: text, alternating: false, unreadable: text }
}

// The editor's inline note, or null. `4/5`-shaped text is offered as the alternating
// series (req-126 2b).
export function weightStepNote(fields) {
  if (fields.alternating) return null
  const text = String(fields.amount ?? '').trim()
  if (!text || parseWeightStep(text) != null) return null
  const looksAlternating = /^(?:alt\s*)?4\s*\/\s*5$/i.test(text)
  return looksAlternating
    ? `Can't read '${text}' — enter an increment, or tick Alternating (4/5)?`
    : `Can't read '${text}' — enter an increment`
}

// What Save writes. `touched` is false until the user changes the number or the
// checkbox: an untouched step is `{ unchanged: true }` — Save leaves the field exactly as
// stored, whatever its shape (an unreadable 'abc', '', null, or absent), so nothing is
// silently replaced. Otherwise { value } or { error }.
export function weightStepToSave(fields, { stored, touched }) {
  if (!touched) return { unchanged: true, value: stored }
  if (fields.alternating) return { value: ALTERNATING }
  const text = String(fields.amount ?? '').trim()
  if (!text) return { value: NO_STEP }
  const n = parseWeightStep(text)
  if (n == null) return { error: weightStepNote(fields) }
  return { value: String(n) }
}

// The exercise detail line: "Increment 2.5 kg" / "Alternating 4/5"; nothing for no
// step; an unreadable value shows as stored (never hidden).
export function describeWeightStep(stored) {
  if (stored === ALTERNATING) return 'Alternating 4/5'
  if (isEmptyStep(stored)) return null
  const n = parseWeightStep(stored)
  return n == null ? String(stored).trim() : `Increment ${n} kg`
}
