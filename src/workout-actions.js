import { go } from './route'
import { dateKey } from './schedule'

export function startOrContinue(store, sessionId, options = {}) {
  const config = typeof options === 'string' ? { scheduledFor: options } : options
  const scheduledFor = config.scheduledFor || dateKey(new Date())
  const scheduleSlotId = config.scheduleSlotId || null
  if (store.activeWorkout && store.activeWorkout.sessionId !== sessionId) {
    if (!window.confirm('Save the workout in progress as a draft and start this one?')) return
  }
  if (
    !store.activeWorkout ||
    store.activeWorkout.sessionId !== sessionId ||
    (config.occurrenceId && store.activeWorkout.occurrenceId !== config.occurrenceId)
  ) {
    store.startWorkout(sessionId, scheduledFor, scheduleSlotId, config.plan || null)
  }
  go(`/workout/${sessionId}`)
}
