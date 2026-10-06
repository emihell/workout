// req-194 (DEC-108 §4) — a cardio set's own fields: a duration (stopwatch or typed), a
// machine Level and a Distance with its unit. All optional on the stored set, all absent
// when blank (nothing invented, DESIGN §1). Older cardio sets keep their typed `reps` text
// and none of these keys; they render as before.
//
// Stored shape (on a set record, alongside weight/reps/rpe/note):
//   durationSec   whole seconds (the same key a timed set uses)
//   level         a number (e.g. 8; 8,5 → 8.5)
//   distance      a number, in `distanceUnit`
//   distanceUnit  'm' | 'km' (present only with `distance`)
//
// Pure and JSX-free so `node --test` imports it. Callers: ui/index.jsx SetLogForm (live
// cardio form + stopwatch), views/set-edit.jsx SetEditForm (active set edit + History edit /
// add), views/set-values.js (the save patches), ids.js formatSetLine (History / done list)
// and workout-log.js loggedSetRowText (the log screen's set list).
import { DECIMAL_NUMBER, NEGATIVE } from './kg-input.js'

export const DISTANCE_UNITS = ['m', 'km']
export const CARDIO_KEYS = ['durationSec', 'level', 'distance', 'distanceUnit']

// 750 → "12:30"; 3725 → "1:02:05"; 0 → "0:00".
export function clockText(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function readNumber(raw) {
  const token = raw.replace(',', '.')
  if (NEGATIVE.test(token)) return { negative: true }
  if (!DECIMAL_NUMBER.test(token)) return null
  return { value: Number(token) }
}

// A typed cardio duration → { empty } | { value: whole seconds } | { error }.
//   "12:30" → 750 · "1:02:05" → 3725 · "20" / "20 min" → 1200 (a bare number is MINUTES,
//   the unit cardio is timed in) · "20,5" → 1230 · "90 s" / "90s" → 90.
export function readDuration(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { empty: true }
  const bad = { error: `Can't read '${raw}' as a duration — use 12:30 or 20 min.` }
  if (raw.includes(':')) {
    const parts = raw.split(':').map((p) => p.trim())
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return bad
    const nums = parts.map(Number)
    if (nums.slice(1).some((n) => n >= 60)) return bad
    const sec = nums.reduce((acc, n) => acc * 60 + n, 0)
    return { value: sec }
  }
  const unit = raw.match(/^(.*?)\s*(min|m|s|sec)?$/i)
  const num = readNumber(unit[1].trim())
  if (num?.negative) return { error: `Duration can't be negative.` }
  if (!num) return bad
  const seconds = /^s/i.test(unit[2] || '') ? num.value : num.value * 60
  return { value: Math.floor(seconds + 0.5) }
}

export function readLevel(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { empty: true }
  const num = readNumber(raw)
  if (num?.negative) return { error: `Level can't be negative.` }
  if (!num) return { error: `Can't read '${raw}' as a level — use a number like 8.` }
  return { value: num.value }
}

export function readDistance(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { empty: true }
  const num = readNumber(raw)
  if (num?.negative) return { error: `Distance can't be negative.` }
  if (!num) return { error: `Can't read '${raw}' as a distance — use a number like 1500.` }
  return { value: num.value }
}

// The cardio form's raw text → what a save writes, or the inline errors.
//   { values: { durationSec, level, distance, distanceUnit } } — each null when blank
//   { errors: { duration?, level?, distance? } }               — nothing is saved
// `durationRequired` (the live log's Done): a blank duration is "Enter duration".
export function cardioValues({ duration, level, distance, distanceUnit }, { durationRequired = false } = {}) {
  const d = readDuration(duration)
  const l = readLevel(level)
  const x = readDistance(distance)
  const errors = {}
  if (d.error) errors.duration = d.error
  else if (d.empty && durationRequired) errors.duration = 'Enter duration'
  if (l.error) errors.level = l.error
  if (x.error) errors.distance = x.error
  if (Object.keys(errors).length) return { errors }
  const unit = DISTANCE_UNITS.includes(distanceUnit) ? distanceUnit : 'm'
  return {
    values: {
      durationSec: d.empty ? null : d.value,
      level: l.empty ? null : l.value,
      distance: x.empty ? null : x.value,
      distanceUnit: x.empty ? null : unit,
    },
  }
}

// A set with the cardio `values` applied: a value sets its key, null removes it (blank →
// absent). Other keys are untouched. Returns a new object.
export function withCardioValues(set, values) {
  const next = { ...set }
  for (const key of CARDIO_KEYS) {
    if (!(key in values)) continue
    if (values[key] == null) delete next[key]
    else next[key] = values[key]
  }
  return next
}

// The same as a merge patch for a reducer that spreads it over the stored set
// (activeSetUpdatedState): a blank field is `undefined`, which the spread copies and
// JSON.stringify (persistence.js saveState / export) drops — absent once saved.
export function cardioPatch(values) {
  const patch = {}
  for (const key of CARDIO_KEYS) if (key in values) patch[key] = values[key] == null ? undefined : values[key]
  return patch
}

// What the cardio form shows for a stored set (edit / Previous): blank where absent.
export function cardioFormText(set, fallbackUnit = 'm') {
  return {
    duration: set?.durationSec != null && set.durationSec !== '' ? clockText(set.durationSec) : '',
    level: set?.level != null && set.level !== '' ? String(set.level) : '',
    distance: set?.distance != null && set.distance !== '' ? String(set.distance) : '',
    distanceUnit: DISTANCE_UNITS.includes(set?.distanceUnit) ? set.distanceUnit : fallbackUnit,
  }
}

// The unit the Distance field starts on: the one this exercise's last finished set with a
// distance used (`sets`: that workout's sets, lastSetsForExercise), else metres.
export function lastDistanceUnit(sets) {
  const found = [...(sets || [])].reverse().find((s) => s?.distance != null && DISTANCE_UNITS.includes(s.distanceUnit))
  return found ? found.distanceUnit : 'm'
}

// "12:30 · level 8 · 1.5 km" — the bits of a set's cardio fields, [] when it has none.
export function cardioBits(set) {
  const bits = []
  if (set?.durationSec != null && set.durationSec !== '') bits.push(clockText(set.durationSec))
  if (set?.level != null && set.level !== '') bits.push(`level ${set.level}`)
  if (set?.distance != null && set.distance !== '') bits.push(`${set.distance} ${set.distanceUnit || 'm'}`)
  return bits
}

export function hasCardioFields(set) {
  return set?.level != null || set?.distance != null
}
