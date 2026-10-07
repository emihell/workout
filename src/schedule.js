export function clampLoopWeeks(n) {
  const v = Number(n) || 1
  return Math.min(4, Math.max(1, Math.round(v)))
}

// req-114 (audit G) — a date-only 'YYYY-MM-DD' string is a LOCAL calendar day.
// `new Date('2026-09-21')` parses it as UTC midnight, which west of UTC is the
// evening before (dateKey('2026-09-21') was 2026-09-20 in New York) and flips the
// loop week of a stored anchor. Timestamps and Date objects pass through unchanged.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function toLocalDate(value) {
  if (typeof value === 'string') {
    const m = DATE_ONLY.exec(value)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return new Date(value)
}

export function mondayOf(date) {
  const d = toLocalDate(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function dateKey(date) {
  const d = toLocalDate(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date, n) {
  const d = toLocalDate(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

export function loopWeekIndex(schedule, date = new Date()) {
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  const anchor = mondayOf(schedule?.anchor || date)
  const monday = mondayOf(date)
  const weeks = Math.round((monday.getTime() - anchor.getTime()) / 86400000 / 7)
  return ((weeks % loop) + loop) % loop
}

export function defaultAnchor(now = new Date()) {
  return dateKey(mondayOf(now))
}

export function defaultSchedule() {
  return {
    loopWeeks: 1,
    anchor: defaultAnchor(),
    slots: [],
  }
}

// req-114 (audit G) — an imported (or hand-edited) schedule may carry no `anchor`,
// and loopWeekIndex then anchors on the QUERIED date, so every week reads as week 0
// and weeks 2–4 never show. Default it to this Monday — what a new schedule gets.
// Called by applyBackup and loadState, NOT migrateState: the default depends on the
// clock, so it must be written once (loadState saves), not recomputed every load.
// Returns the same object when an anchor is already there.
export function withDefaultAnchor(schedule, now = new Date()) {
  if (!schedule || schedule.anchor) return schedule
  return { ...schedule, anchor: defaultAnchor(now) }
}

// req-114 (audit G) — the workout preview's plan date: the route's date, else TODAY
// as a local calendar day (overview.jsx used the UTC date, so 00:00–02:00 in Sweden
// previewed — and minted an adhoc occurrence for — yesterday).
export function planDateFor(date, now = new Date()) {
  return date || dateKey(now)
}

// req-211 (DEC-117 §2) — `schedule.moves` (optional, normalised by migrateState): a one-date
// move `{ id, slotId, from, to }` ('YYYY-MM-DD') takes that slot off `from` and puts it on `to`
// (the same Mon–Sun week). Every other date of the slot is untouched. Absent → no moves.
export function scheduleMoves(schedule) {
  return Array.isArray(schedule?.moves) ? schedule.moves : []
}

// The slots on a calendar date: the loop week's weekday slots, minus any moved away FROM this
// date, plus any moved TO it (whatever their own weekday). Schedule order kept.
export function slotsOn(schedule, date) {
  const key = dateKey(date)
  const week = loopWeekIndex(schedule, date)
  const weekday = toLocalDate(date).getDay()
  const moves = scheduleMoves(schedule)
  const away = new Set(moves.filter((move) => move.from === key).map((move) => move.slotId))
  const into = new Set(moves.filter((move) => move.to === key).map((move) => move.slotId))
  return (schedule?.slots || []).filter(
    (s) => into.has(s.id) || (Number(s.week) === week && Number(s.weekday) === weekday && !away.has(s.id)),
  )
}

// req-211 — the move that put `slotId` on `date`, or null (the slot is on its own day).
export function moveInto(schedule, slotId, date) {
  const key = dateKey(date)
  return scheduleMoves(schedule).find((move) => move.slotId === slotId && move.to === key) || null
}

export function slotsForWeekDay(schedule, week, weekday) {
  return (schedule?.slots || []).filter((s) => Number(s.week) === week && Number(s.weekday) === weekday)
}

export function resolveSlot(routines, slot) {
  const id = slot.routineId
  const routine = (routines || []).find((candidate) => candidate.id === id) || null
  return { slot, routine }
}

export function occurrenceId(slotId, date) {
  return `${slotId}@${dateKey(date)}`
}

export function coveringWorkout(workouts, routineId, scheduledDate, scheduleSlotId = null) {
  const done = (workouts || []).filter((w) => {
    const id = w.routineId
    if (!w.finishedAt || id !== routineId) return false
    if (scheduleSlotId && w.scheduleSlotId && w.scheduleSlotId !== scheduleSlotId) return false
    return true
  })
  if (scheduleSlotId) {
    const exact = done.find(
      (w) =>
        w.scheduleSlotId === scheduleSlotId &&
        (w.scheduledFor === scheduledDate || w.occurrenceId === `${scheduleSlotId}@${scheduledDate}`),
    )
    if (exact) return exact
    const legacyTagged = done.find(
      (w) => !w.scheduleSlotId && w.scheduledFor === scheduledDate,
    )
    if (legacyTagged) return legacyTagged
    return (
      done.find(
        (w) =>
          !w.scheduleSlotId &&
          !w.scheduledFor &&
          dateKey(w.finishedAt) === scheduledDate,
      ) || null
    )
  }
  const tagged = done.find((w) => w.scheduledFor === scheduledDate)
  if (tagged) return tagged
  return done.find((w) => !w.scheduledFor && dateKey(w.finishedAt) === scheduledDate) || null
}

// req-205 (DEC-114) — Home's "Coming up": the next `n` calendar dates AFTER today (today
// is excluded — today's block owns it), every day shown, rest days included. Each row
// names its loop week (0-based) and weekday (0=Sun..6=Sat, getDay — the ScheduleDay
// route's own pair) and the slots on that date whose routine is active (present and not
// archived), in schedule order; `slots` is empty on a rest day (or a day whose only
// workouts are archived/missing). Nearest first; Home reverses it (furthest on top).
// Replaces req-204's `upcomingWorkouts` (the next 3 workout dates, rest days skipped). Pure.
export function comingDays(schedule, routines, today = new Date(), n = 6) {
  const active = new Set((routines || []).filter((routine) => routine && !routine.archivedAt).map((routine) => routine.id))
  return Array.from({ length: n }, (_, k) => {
    const date = addDays(today, k + 1)
    const slots = slotsOn(schedule, date).filter((slot) => active.has(slot.routineId))
    return { dateKey: dateKey(date), week: loopWeekIndex(schedule, date), weekday: date.getDay(), slots }
  })
}
