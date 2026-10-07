import { cardioBits, hasCardioFields } from './cardio-set.js'

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const LOOP_WEEKS = [1, 2, 3, 4]

// req-192 (DEC-108 §2) — labels Medium / Failure (were Moderate / Max). Stored values
// unchanged: 2 / 3 / 4 / 5, read by progress.js exactly as before.
export const RPE_OPTIONS = [
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Failure' },
]

export function rpeLabel(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  if (n <= 2) return 'Easy'
  if (n >= 5) return 'Failure'
  return RPE_OPTIONS.find((opt) => opt.value === n)?.label || ''
}

export function rpeOptionValue(stored) {
  const n = Number(stored)
  if (!Number.isFinite(n) || n === 0) return ''
  if (n <= 2) return 2
  if (n >= 5) return 5
  return n
}

export const EXERCISE_TYPES = ['machine', 'free', 'bodyweight', 'cardio']

// req-44 — one pure "does this exercise type carry external load?" predicate,
// unifying the four drifted spellings (item.jsx usesWeight/usesLoad, model.js
// weighted, the inverse of progress.js bodyweight). Takes the raw type string; a
// missing/unknown type reads as weighted (matches every prior spelling, which only
// excluded the two explicit non-loaded types).
export function isWeightedType(type) {
  return type !== 'bodyweight' && type !== 'cardio'
}

export const ROUTINE_ROLES = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'main', label: 'Main' },
  { value: 'finisher', label: 'Finisher' },
  { value: 'cardio', label: 'Cardio' },
]

export function roleLabel(role) {
  return ROUTINE_ROLES.find((item) => item.value === (role || 'main'))?.label || 'Main'
}

// req-93 — in the in-workout flow, 'main' is the default and carries no information
// (most exercises are main), so it is shown name-only. roleTag returns a label ONLY
// for non-main roles (warm-up, finisher, cardio); main / absent role → '' (falsy, so
// callers filtering by Boolean drop it). roleLabel itself is unchanged (req-179: the
// item editor has no role picker now, but stored finisher/cardio still read); req-103 extends the rule to the
// routine editor's exercise rows via routineItemMeta below.
// req-202 — an item's warm-up flag (the exercise starts with a warm-up set), as a tag on an
// item line. "Warm-up set" stays for a set that IS one (formatSetLine, the set type).
export const WITH_WARMUP = 'with warm-up'

export function roleTag(role) {
  return (role || 'main') === 'main' ? '' : roleLabel(role)
}

// req-103 — the muted second line of a routine-editor exercise row:
// `[role tag] · with warm-up · N sets · kg` (req-202: was "Warm-up set", which read as one set). Main is unlabelled (roleTag); empty parts are
// dropped so a minimal item reads just `1 set` with no stray separators. kg shows
// only when some suggested weight is > 0, joined by a no-break space so `kg` never
// wraps alone. req-113 — a weight that is 0, empty or missing means "no weight" (DESIGN
// §1), so it prints as `—`, never `0`: [0, 40] → `—/40 kg`.
//
// req-209 §5 — the plan reads "{sets} × {reps} · {kg} kg" ("4 × 15 · 14 kg"), or
// "{sets} × {duration}" for a timed exercise (`timed`: the exercise's hasDuration), so an
// edit to reps shows on the row. kg prints once when every set shares it; the slash form
// stays only when kg differ per set. Reps that differ per set read "12/10/8". An item
// without a target for every set keeps "N sets" (never invented).
export function routineItemMeta(item, { timed = false } = {}) {
  const sets = item.sets || 1
  const perSetOf = (list) => Array.from({ length: sets }, (_, i) => list?.[i])
  const kgValues = perSetOf(item.suggestedWeights).map((weight) => (Number(weight) > 0 ? String(weight) : '\u2014'))
  const kg = (item.suggestedWeights || []).slice(0, sets).some((weight) => Number(weight) > 0)
    ? `${new Set(kgValues).size === 1 ? kgValues[0] : kgValues.join('/')}\u00a0kg`
    : ''
  const perSet = timed
    ? perSetOf(item.durations).map((value) => (Number(value) > 0 ? `${Number(value)}s` : ''))
    : perSetOf(item.targets).map((value) => (value == null ? '' : String(value).trim()))
  const amount = perSet.every(Boolean) ? (new Set(perSet).size === 1 ? perSet[0] : perSet.join('/')) : ''
  const plan = amount ? `${sets} \u00d7 ${amount}` : `${sets} ${sets === 1 ? 'set' : 'sets'}`
  return [roleTag(item.role), item.warmup ? WITH_WARMUP : '', plan, kg].filter(Boolean).join(' · ')
}

export function weekdayName(value) {
  return WEEKDAYS.find((d) => d.value === Number(value))?.label ?? ''
}

// req-163 (DEC-087 §2) — a warm-up or cardio set carries no effort (req-156), so its
// label is never shown, even on an OLD set stored with rpe 3 before req-156: display only,
// the stored value is not rewritten. `cardio` comes from the caller (the set alone doesn't
// know its exercise's type).
// req-194 — `cardioFields`: a non-timed cardio exercise, whose duration reads as a clock.
//
// req-209 §3 — ONE set format, "{kg} kg × {reps}" ("14 kg × 15 · Easy"), used by the History
// exercise page, History › By exercise (topSetText) and the in-workout log list; the
// History detail's inline rows (historyGroupSetsText) build on setParts below.
export function formatSetLine(set, { cardio = false, cardioFields = false } = {}) {
  const bits = []
  if (set.setType === 'wu') bits.push('Warm-up set')
  const value = setValueText(set, { cardio, cardioFields })
  if (value) bits.push(value)
  if (set.rpe && set.setType !== 'wu' && !cardio) bits.push(rpeLabel(set.rpe) || 'logged')
  return bits.join(' · ') || 'logged'
}

// req-209 — a set's logged values, split: `kg` ("14 kg", or '' with no weight), `amount`
// (reps "15", a timed set's "30s", or a cardio set's "12:30 · level 8") and whether it is
// cardio (whose parts join with " · ", never "×"). Logged values only. Pure.
export function setParts(set, { cardio = false, cardioFields = false } = {}) {
  const kg = set.weight != null && set.weight !== '' && Number(set.weight) !== 0 ? `${set.weight} kg` : ''
  const amount = []
  // req-194 — a cardio set's duration / level / distance: "12:30 · level 8 · 1.5 km"
  // (cardio-set.js). An old cardio set has none of them and shows its typed reps as before.
  // Review fix 5 — a cardio set with a logged time reads as cardio even when the caller passes
  // only `cardio` (a timed cardio exercise's seconds then read as a clock too, "0:30").
  const timedCardio = cardio && set.durationSec != null && set.durationSec !== ''
  const isCardio = Boolean(cardioFields || timedCardio || hasCardioFields(set))
  if (isCardio) amount.push(...cardioBits(set))
  // req-85 — a timed set logs seconds in place of reps; show it as e.g. "30s".
  else if (set.durationSec != null && set.durationSec !== '') amount.push(`${set.durationSec}s`)
  if (set.reps != null && set.reps !== '') amount.push(`${set.reps}`)
  return { kg, amount: amount.join(' · '), cardio: isCardio }
}

// req-209 §3 — "{kg} kg × {reps}"; either part alone when the other is absent.
export function setValueText(set, options) {
  const { kg, amount, cardio } = setParts(set, options)
  if (kg && amount) return cardio ? `${kg} · ${amount}` : `${kg} × ${amount}`
  return kg || amount
}
