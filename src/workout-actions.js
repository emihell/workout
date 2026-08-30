import { go, hashPath } from './route'
import { dateKey } from './schedule'

export function startOrContinue(store, routineId, options = {}) {
  const config = typeof options === 'string' ? { scheduledFor: options } : options
  const scheduledFor = config.scheduledFor || dateKey(new Date())
  const scheduleSlotId = config.scheduleSlotId || null
  const activeId = store.activeWorkout?.routineId || store.activeWorkout?.sessionId
  if (store.activeWorkout && activeId !== routineId) {
    if (!window.confirm('Save draft?')) return
  }
  if (
    !store.activeWorkout ||
    activeId !== routineId ||
    (config.occurrenceId && store.activeWorkout.occurrenceId !== config.occurrenceId)
  ) {
    store.startWorkout(routineId, scheduledFor, scheduleSlotId, config.plan || null)
  }
  const target = `/workout/${routineId}`
  const here = hashPath(typeof window === 'undefined' ? '/' : window.location.hash)
  const replace = here === target || here.startsWith(`${target}/`)
  go(target, { replace })
}
