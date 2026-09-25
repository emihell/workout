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

export function slotsOn(schedule, date) {
  const week = loopWeekIndex(schedule, date)
  const weekday = toLocalDate(date).getDay()
  return (schedule?.slots || []).filter((s) => Number(s.week) === week && Number(s.weekday) === weekday)
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

export function remainingInLoop(routines, schedule, fromDate = new Date()) {
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  const start = toLocalDate(fromDate)
  start.setHours(0, 0, 0, 0)
  const items = []
  for (let i = 1; i <= loop * 7; i++) {
    const d = addDays(start, i)
    const week = loopWeekIndex(schedule, d)
    const found = slotsOn(schedule, d)
      .map((slot) => resolveSlot(routines, slot))
      .filter((x) => x.routine)
    for (const x of found) items.push({ date: d, week, ...x })
  }
  return items
}
