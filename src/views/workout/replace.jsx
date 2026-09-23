import { useEffect, useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { itemIsMarkedDone, itemKey, itemLoggingState } from '../../workout-log'
import { Back, NavLink } from '../shared'
import { Button, Field, List, Row, Screen, Title } from '../../ui/index.jsx'
import { exerciseName, findItem, isActiveFor, itemLogPath, MissingItem } from './helpers'
import { RestPill } from './rest'

// req-109 — the Replace exercise picker (reached from the item's log screen). Lists the
// library's exercises, archived ones excluded, with the RoutineExercisePick search.
// Picking one is an action (it writes): the original's remaining sets are logged
// skipped and a blank item for the picked exercise is inserted directly after it, for
// this workout only (store.replaceItem). Back / Cancel change nothing. An exercise that
// is already done can't be replaced (re-open it first), so a done item bounces back to
// the overview.
export function WorkoutItemReplace({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const done = Boolean(item && (itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone))
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (done) go(`/workout/${routineId}`, { replace: true })
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
    store.replaceItem(itemKey(item), exerciseId)
    go(`/workout/${routineId}`, { replace: true })
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
      <div className="ui-actions">
        <NavLink to={backTo} className="ui-btn ui-btn--quiet">
          Cancel
        </NavLink>
      </div>
    </Screen>
  )
}
