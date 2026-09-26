// req-179 (DEC-099) — the routine item form's pure parts: the role a "Warm-up exercise"
// switch saves, and the "Different … per set" fields that feed the unchanged
// routine-item-parse.js. The view (Routine.jsx ExerciseFields / PerSetField) only renders.

// Roles the form can no longer pick but must not silently rewrite (req-179 Change 2).
const KEPT_ROLES = new Set(['finisher', 'cardio'])

// Switch on → 'warmup'. Off → 'main', except a stored finisher/cardio stays as it is.
export function savedRole(storedRole, switchOn) {
  if (switchOn) return 'warmup'
  return KEPT_ROLES.has(storedRole) ? storedRole : 'main'
}

// A stored per-set list → the fields' starting state. The switch starts on only when
// the stored values differ between sets; one value (or none) is the single field.
export function perSetStart(list) {
  const values = Array.from(list || [], (value) => String(value ?? '').trim())
  return { different: new Set(values).size > 1, single: values[0] ?? '', perSet: values }
}

// The number of per-set fields: Sets when it is a whole number ≥ 1, else the stored
// list's length (the parser reports the bad Sets itself), at least 1.
export function perSetCount(setsText, fallback = 1) {
  const text = String(setsText ?? '').trim()
  return /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : Math.max(1, fallback)
}

// Field i's value: what was typed there, else the last one before it (a field that
// appears when Sets grows starts as the previous set, as the parser would repeat it).
export function perSetValues(perSet, count) {
  const out = []
  for (let i = 0; i < count; i++) out.push(perSet[i] ?? (i > 0 ? out[i - 1] : ''))
  return out
}

// → the slash text routine-item-parse.js reads. Off: the single value (repeated by the
// parser). On: one token per set, so a cleared Set 2 is "Set 2 is empty."; all blank is
// "not set" (''), as an empty single field is.
export function perSetText({ different, single, perSet }, count) {
  if (!different) return single
  const values = perSetValues(perSet, count)
  return values.every((value) => !String(value).trim()) ? '' : values.join('/')
}
