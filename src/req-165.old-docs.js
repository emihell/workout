// req-165 — two stored docs from before the cleanup, for the "loads to the same v9 state
// as main" check: (1) a legacy v8 doc with `session*` keys at every level the old model
// used and a stale `plannedWorkouts` entry; (2) a v9 doc still carrying a stale plan.
// Built from src/db.json so they're realistic; JSX-free, imported by req-165.test.js and
// by the one-off script that recorded main's output (req-165.golden.json).
import { readFileSync } from 'node:fs'

const db = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))

function sessionize(doc) {
  const d = structuredClone(doc)
  for (const slot of d.schedule.slots) {
    slot.sessionId = slot.routineId
    delete slot.routineId
  }
  for (const w of d.workouts) {
    w.sessionId = w.routineId
    delete w.routineId
    if (w.snapshot) {
      w.snapshot.sessionId = w.snapshot.routineId
      w.snapshot.sessionName = w.snapshot.routineName
      delete w.snapshot.routineId
      delete w.snapshot.routineName
      for (const item of w.snapshot.items || []) {
        item.sessionItemId = item.routineItemId
        delete item.routineItemId
      }
    }
    for (const set of w.sets || []) {
      set.sessionItemId = set.routineItemId
      delete set.routineItemId
    }
  }
  return d
}

const plan = (routine, extra = {}) => ({
  id: 'plan-stale',
  date: '2025-10-20',
  occurrenceId: 'slot-sess-upper@2025-10-20',
  scheduleSlotId: 'slot-sess-upper',
  items: routine.exercises.slice(0, 2).map((item) => ({ ...item, sessionItemId: item.id })),
  ...extra,
})

const upper = db.routines.find((r) => r.id === 'sess-upper')

export const OLD_V8 = (() => {
  const d = sessionize(db)
  d.plannedWorkouts = [plan(upper, { sessionId: 'sess-upper', sessionName: 'Upper Body' })]
  // an in-progress workout of the old shape, too
  const w = structuredClone(d.workouts[0])
  d.activeWorkout = { ...w, id: 'wo-live-old', finishedAt: null, completedSessionItemIds: [w.snapshot.items[0].sessionItemId], sets: w.sets.slice(0, 2) }
  return d
})()

export const OLD_V9_WITH_PLAN = (() => {
  const d = structuredClone(db)
  d.schemaVersion = 9
  d.plannedWorkouts = [plan(upper, { routineId: 'sess-upper', routineName: 'Upper Body' })]
  return d
})()
