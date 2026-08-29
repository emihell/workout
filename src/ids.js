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
  { value: 1, label: 'Very Easy' },
  { value: 2, label: 'Light' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Failure' },
]

export const EXERCISE_TYPES = ['machine', 'free', 'bodyweight', 'cardio']

export function weekdayName(value) {
  return WEEKDAYS.find((d) => d.value === Number(value))?.label ?? ''
}

export function parseTargets(text, setCount) {
  const n = Number(setCount) || 1
  const parts = String(text || '')
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return Array.from({ length: n }, () => '')
  if (parts.length === 1) return Array.from({ length: n }, () => parts[0])
  const out = [...parts]
  while (out.length < n) out.push(out[out.length - 1])
  return out.slice(0, n)
}

export function formatTargets(targets) {
  return (targets || []).join('/')
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatSetLine(set) {
  const bits = []
  if (set.setType === 'wu') bits.push('WU')
  if (set.weight != null && set.weight !== '' && Number(set.weight) !== 0) {
    bits.push(`${set.weight} kg`)
  }
  if (set.reps != null && set.reps !== '') bits.push(`${set.reps}`)
  if (set.rpe) bits.push(`RPE ${set.rpe}`)
  return bits.join(' · ') || 'logged'
}
