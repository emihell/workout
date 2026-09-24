// req-154 (audit F-TRUST-1, DEC-058 §1) — the one parse for a TYPED kg. The kg inputs
// are `inputMode="decimal"` (ui/index.jsx NumberField), and a Swedish keypad types a
// comma: `22,5` means 22.5. Before this, the set-log / set-edit saves ran plain
// Number() on the text, so `22,5` became 0 on the live log and NaN (→ null) in History.
// Pure, no imports: routine-item-parse.js (routine editor Kg, per `/` token),
// weight-step.js (its own deliberately looser pattern) and the logged-set saves
// (views/set-values.js) all normalise through here.

// A non-negative decimal: `20`, `22.5`, `.5`, and `22.` (req-155: a trailing separator is
// the whole number — `22,` / `22.` meant 22, as weight-step.js already reads it). Not `.`,
// `+5`, `1e1`, `0x5`, `-5`. seconds-input.js reads durations with the same shape.
export const DECIMAL_NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)$/
export const KG_NUMBER = DECIMAL_NUMBER
export const NEGATIVE = /^-\s*\d/

// Trim, drop an optional `kg` suffix, and read the first `,` as the decimal point.
// Only the first: `2,5,5` stays unreadable instead of becoming 2.5.
export function normalizeKgText(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s*kg$/i, '')
    .trim()
    .replace(',', '.')
}

// → { empty: true } | { value: number } | { error: string }. `error` is the inline
// message the set forms show; `raw` is echoed as typed.
export function readKg(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { empty: true }
  const token = normalizeKgText(raw)
  if (NEGATIVE.test(token)) return { error: `kg can't be negative.` }
  if (!KG_NUMBER.test(token)) return { error: `Can't read '${raw}' as kg — use a number like 22,5.` }
  return { value: Number(token) }
}

// The inline error for a kg field, or null when it can be saved (a number or empty).
export function kgError(text) {
  return readKg(text).error ?? null
}

// What a save writes for a typed kg: { value } — the number, or `emptyValue` for a
// blank field — or { error } for text that isn't a number. Never 0 or NaN for bad text.
export function kgToSave(text, emptyValue) {
  const read = readKg(text)
  if (read.error) return { error: read.error }
  return { value: read.empty ? emptyValue : read.value }
}
