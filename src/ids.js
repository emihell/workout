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

export const FOCUS_OPTIONS = [
  'Machines',
  'Free weights',
  'Bodyweight',
  'Cardio',
  'Mobility',
  'Mixed',
]

export const RPE_OPTIONS = [
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Moderate' },
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
  { value: 'warmup', label: 'WU routine' },
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
// callers filtering by Boolean drop it). roleLabel itself is unchanged (the item
// editor's role picker still lists every role); req-103 extends the rule to the
// routine editor's exercise rows via routineItemMeta below.
export function roleTag(role) {
  return (role || 'main') === 'main' ? '' : roleLabel(role)
}

// req-103 — the muted second line of a routine-editor exercise row:
// `[role tag] · WU set · N sets · kg`. Main is unlabelled (roleTag); empty parts are
// dropped so a minimal item reads just `1 set` with no stray separators. kg shows
// only when some suggested weight is > 0, joined by a no-break space so `kg` never
// wraps alone. req-113 — a weight that is 0, empty or missing means "no weight" (DESIGN
// §1), so it prints as `—`, never `0`: [0, 40] → `—/40 kg`.
export function routineItemMeta(item) {
  const sets = item.sets || 1
  const weights = item.suggestedWeights || []
  const kg = weights.some((weight) => Number(weight) > 0)
    ? `${Array.from(weights, (weight) => (Number(weight) > 0 ? weight : '—')).join('/')}\u00a0kg`
    : ''
  return [roleTag(item.role), item.warmup ? 'WU set' : '', `${sets} ${sets === 1 ? 'set' : 'sets'}`, kg]
    .filter(Boolean)
    .join(' · ')
}

export function weekdayName(value) {
  return WEEKDAYS.find((d) => d.value === Number(value))?.label ?? ''
}

export function parseTargets(text, setCount) {
  const n = Number(setCount) || 1
  const parts = String(text || '')
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return []
  if (parts.length === 1) return Array.from({ length: n }, () => parts[0])
  const out = [...parts]
  while (out.length < n) out.push(out[out.length - 1])
  return out.slice(0, n)
}

export function formatTargets(targets) {
  return (targets || []).map((value) => String(value).trim()).filter(Boolean).join('/')
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatSetLine(set) {
  const bits = []
  if (set.setType === 'wu') bits.push('WU set')
  if (set.weight != null && set.weight !== '' && Number(set.weight) !== 0) {
    bits.push(`${set.weight} kg`)
  }
  // req-85 — a timed set logs seconds in place of reps; show it as e.g. "30s".
  if (set.durationSec != null && set.durationSec !== '') bits.push(`${set.durationSec}s`)
  if (set.reps != null && set.reps !== '') bits.push(`${set.reps}`)
  if (set.rpe) bits.push(rpeLabel(set.rpe) || 'logged')
  return bits.join(' · ') || 'logged'
}
