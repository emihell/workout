// req-118 (audit A, DEC-058 §1, §6, §7) — the routine item editor's Sets / Reps / Kg /
// Duration fields, parsed by position. Pure: the view (Routine.jsx ExerciseFields) only
// shows the errors this returns and saves `value` when there are none.
//
// - Separators: Reps and Duration split on `/` and `,` (whole numbers, §6). Kg splits on
//   `/` only; `,` is a decimal point there (§1): `20/22,5` → [20, 22.5].
// - A bad or negative token is an error at its position — never dropped or shifted
//   (the old split-and-filter turned `abc/20/-5` into [20, -5]).
// - `kg` / `s` suffixes are stripped (`20kg`, `30s`). Reps keeps text targets
//   (`AMRAP`, `8-12`, `30s`) as they are.
// - Sets is authoritative: a list longer than Sets is an error; a shorter one repeats
//   its last value (Reps as before, Kg per §7, Duration likewise). Blank Sets falls back
//   to the longest list (or 1).
// - An empty field is "not set": `[]`, so the exercise default / history applies —
//   never `[0]` (a 0 s duration target beat the exercise default, workout-log.js:406).

import { KG_NUMBER, normalizeKgText } from './kg-input.js'

const WHOLE = /^\d+$/
const NEGATIVE = /^-\s*\d/

function tokens(text, separator) {
  const raw = String(text ?? '').trim()
  if (!raw) return []
  return raw.split(separator).map((token) => token.trim())
}

function repeatTo(list, count) {
  if (list.length === 0) return []
  const out = [...list]
  while (out.length < count) out.push(out[out.length - 1])
  return out
}

// Each field parser returns { list, error }; error names the 1-based position.
export function parseReps(text) {
  const parts = tokens(text, /[/,]/)
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) return { list: [], error: { position: i + 1, message: `Set ${i + 1} is empty.` } }
    if (NEGATIVE.test(parts[i])) {
      return { list: [], error: { position: i + 1, message: `Set ${i + 1} can't be negative.` } }
    }
  }
  return { list: parts, error: null }
}

function parseNumbers(parts, { suffix, pattern, decimalComma }) {
  const list = []
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].replace(suffix, '').trim()
    const normal = decimalComma ? normalizeKgText(token) : token
    if (!token) return { list: [], error: { position: i + 1, message: `Set ${i + 1} is empty.` } }
    if (NEGATIVE.test(token)) {
      return { list: [], error: { position: i + 1, message: `Set ${i + 1} can't be negative.` } }
    }
    if (!pattern.test(normal)) {
      return { list: [], error: { position: i + 1, message: `Set ${i + 1} ("${parts[i]}") isn't a number.` } }
    }
    list.push(Number(normal))
  }
  return { list, error: null }
}

export function parseKg(text) {
  return parseNumbers(tokens(text, '/'), { suffix: /\s*kg$/i, pattern: KG_NUMBER, decimalComma: true })
}

export function parseDurations(text) {
  return parseNumbers(tokens(text, /[/,]/), { suffix: /\s*s$/i, pattern: WHOLE, decimalComma: false })
}

// → { value: { sets, targets, suggestedWeights, durations }, errors: { sets?, reps?, kg?, duration? } }
// `errors` is empty when the item can be saved. Duration is parsed only when `timed`;
// otherwise `value.durations` is null and the caller keeps the item's own.
export function parseRoutineItem({ sets, reps, kg, duration, timed = false }) {
  const errors = {}
  const r = parseReps(reps)
  const k = parseKg(kg)
  const d = timed ? parseDurations(duration) : { list: [], error: null }
  if (r.error) errors.reps = r.error
  if (k.error) errors.kg = k.error
  if (d.error) errors.duration = d.error

  const setsText = String(sets ?? '').trim()
  let count
  if (!setsText) {
    count = Math.max(r.list.length, k.list.length, d.list.length, 1)
  } else if (WHOLE.test(setsText) && Number(setsText) > 0) {
    count = Number(setsText)
  } else {
    errors.sets = { position: null, message: 'Sets must be a whole number, 1 or more.' }
    count = 1
  }

  if (!errors.sets) {
    const tooLong = (list, noun) =>
      list.length > count
        ? { position: count + 1, message: `${count} ${count === 1 ? 'set' : 'sets'}, ${list.length} ${noun} given.` }
        : null
    const checks = [['reps', r.list, 'reps'], ['kg', k.list, 'kg values'], ['duration', d.list, 'durations']]
    for (const [field, list, noun] of checks) {
      const error = errors[field] ? null : tooLong(list, noun)
      if (error) errors[field] = error
    }
  }

  return {
    errors,
    value: {
      sets: count,
      targets: repeatTo(r.list, count),
      suggestedWeights: repeatTo(k.list, count),
      durations: timed ? repeatTo(d.list, count) : null,
    },
  }
}
