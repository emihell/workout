export function clampLoopWeeks(n) {
  const v = Number(n) || 1
  return Math.min(4, Math.max(1, Math.round(v)))
}

export function mondayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function dateKey(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date, n) {
  const d = new Date(date)
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

export function defaultSchedule() {
  return {
    loopWeeks: 1,
    anchor: dateKey(mondayOf(new Date())),
    slots: [],
  }
}

export function slotsOn(schedule, date) {
  const week = loopWeekIndex(schedule, date)
  const weekday = new Date(date).getDay()
  return (schedule?.slots || []).filter((s) => Number(s.week) === week && Number(s.weekday) === weekday)
}

export function slotsForWeekDay(schedule, week, weekday) {
  return (schedule?.slots || []).filter((s) => Number(s.week) === week && Number(s.weekday) === weekday)
}

export function resolveSlot(routines, slot) {
  const id = slot.routineId || slot.sessionId
  const routine = (routines || []).find((candidate) => candidate.id === id) || null
  return { slot, routine }
}

export function occurrenceId(slotId, date) {
  return `${slotId}@${dateKey(date)}`
}

export function nextDateForSlot(schedule, slot, fromDate = new Date(), includeToday = true) {
  const start = new Date(fromDate)
  start.setHours(0, 0, 0, 0)
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  for (let offset = includeToday ? 0 : 1; offset <= loop * 7; offset++) {
    const date = addDays(start, offset)
    if (
      loopWeekIndex(schedule, date) === Number(slot.week) &&
      date.getDay() === Number(slot.weekday)
    ) {
      return date
    }
  }
  return null
}

export function coveringWorkout(workouts, routineId, scheduledDate, scheduleSlotId = null) {
  const done = (workouts || []).filter((w) => {
    const id = w.routineId || w.sessionId
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

export function nextOccurrence(routines, schedule, routineId, workouts = [], fromDate = new Date()) {
  const start = new Date(fromDate)
  start.setHours(0, 0, 0, 0)
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  for (let i = 0; i < (loop + 1) * 7; i++) {
    const d = addDays(start, i)
    const key = dateKey(d)
    const found = slotsOn(schedule, d)
      .map((slot) => resolveSlot(routines, slot))
      .filter((x) => x.routine?.id === routineId)
    if (found.length && !coveringWorkout(workouts, routineId, key)) {
      return { date: d, key, ...found[0] }
    }
  }
  return null
}

export function remainingInLoop(routines, schedule, fromDate = new Date()) {
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  const start = new Date(fromDate)
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

export function nextScheduled(routines, schedule, fromDate = new Date()) {
  const start = new Date(fromDate)
  start.setHours(0, 0, 0, 0)
  const loop = clampLoopWeeks(schedule?.loopWeeks)
  for (let i = 1; i <= loop * 7; i++) {
    const d = addDays(start, i)
    const found = slotsOn(schedule, d)
      .map((slot) => resolveSlot(routines, slot))
      .filter((x) => x.routine)
    if (found.length) return { date: d, items: found }
  }
  return null
}
