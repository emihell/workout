// req-155 (DEC-058 §1) — the one parse for a TYPED single duration in seconds: a timed
// set's Duration (ui/index.jsx SetLogForm / DurationTimer) and an exercise's default
// duration (Exercises.jsx). Same discipline as kg-input.js: the fields are
// `inputMode="decimal"`, so a Swedish keypad types `30,5`, which is 30.5 s. Seconds are
// stored whole, so it is rounded half up (Planner's call, req-155): 30,5 → 31. Before,
// `Number("30,5")` was NaN → 0 s logged / the exercise default kept, with no error.
// Not the routine editor's multi-set Duration field: there `,` separates sets (DEC-058 §6).
import { DECIMAL_NUMBER, NEGATIVE } from './kg-input.js'

// → { empty: true } | { value: whole seconds } | { error: string }. An optional `s` suffix.
export function readSeconds(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { empty: true }
  const token = raw.replace(/\s*s$/i, '').trim().replace(',', '.')
  if (NEGATIVE.test(token)) return { error: `Duration can't be negative.` }
  if (!DECIMAL_NUMBER.test(token)) return { error: `Can't read '${raw}' as seconds — use a number like 30.` }
  return { value: Math.floor(Number(token) + 0.5) }
}

// The inline error for a seconds field, or null when it can be saved (a number or empty).
export function secondsError(text) {
  return readSeconds(text).error ?? null
}

// What a save writes: { value } — whole seconds, or `emptyValue` for a blank field — or
// { error } for text that isn't a number. Never 0 or NaN for bad text.
export function secondsToSave(text, emptyValue) {
  const read = readSeconds(text)
  if (read.error) return { error: read.error }
  return { value: read.empty ? emptyValue : read.value }
}

// An exercise's default duration (Exercises.jsx ExerciseEdit): blank → `fallback` (the app
// default); 0 → `fallback` and at least 1 s, as before (`Math.max(1, Number(t) || fallback)`);
// `30,5` → 31; unreadable → { error }, where it used to fall back to the default silently.
export function defaultDurationToSave(text, fallback) {
  const seconds = secondsToSave(text, fallback)
  if (seconds.error) return seconds
  return { value: Math.max(1, seconds.value || fallback) }
}
