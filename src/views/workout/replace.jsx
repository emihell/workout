import { useEffect, useRef, useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { itemIsMarkedDone, itemKey, itemLoggingState } from '../../workout-log'
import { Back } from '../shared'
import { Actions, Button, Field, List, NavLink, Row, Screen, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemLogPath, MissingItem } from './helpers'
import { RestPill } from './rest'

// req-109 — the Replace exercise picker (reached from the item's log screen). Lists the
// library's exercises, archived ones excluded, with the RoutineExercisePick search.
// Picking one is an action (it writes): the original's remaining sets are logged
// skipped and a blank item for the picked exercise is inserted directly after it, for
// this workout only (store.replaceItem), and the picker lands on the new item's log
// screen (req-124). Back / Cancel change nothing. An exercise that
// is already done can't be replaced (re-open it first), so a done item bounces back to
// the overview.
export function WorkoutItemReplace({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const done = Boolean(item && (itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone))
  const [query, setQuery] = useState('')
  // req-124 — a pick marks the original done (skipped), which would re-fire the bounce
  // below and override the navigation to the new item; a picked screen never bounces.
  const picked = useRef(false)

  useEffect(() => {
    if (done && !picked.current) go(`/workout/${routineId}`, { replace: true })
  }, [done, routineId])

  if (!mine || !item || done) return <MissingItem />

  const backTo = itemLogPath(routineId, item)
  const q = query.trim().toLowerCase()
  const matches = (store.exercises || []).filter((ex) => {
    if (ex.archivedAt) return false
    if (!q) return true
    return `${ex.name} ${ex.equipment} ${ex.muscles}`.toLowerCase().includes(q)
  })

  function pick(exerciseId) {
    recordButton('replace-exercise')
    picked.current = true
    // req-124 — land on the new exercise's log screen (replacing the picker in history).
    const newKey = store.replaceItem(itemKey(item), exerciseId)
    go(itemLogPath(routineId, { id: newKey }), { replace: true })
  }

  return (
    <Screen>
      <Back to={backTo} />
      <RestPill />
      <p className="ui-sub">{exerciseName(item)}</p>
      <Title>Replace exercise</Title>
      <Field label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      {matches.length === 0 ? <p className="ui-sub">No matches.</p> : null}
      <List>
        {matches.map((ex) => (
          <Row
            key={ex.id}
            action={
              <Button variant="secondary" onClick={() => pick(ex.id)}>
                Replace
              </Button>
            }
          >
            {ex.name} — {ex.equipment}
          </Row>
        ))}
      </List>
      <Actions retreat={<NavLink to={backTo} look="quiet">Cancel</NavLink>} />
    </Screen>
  )
}
