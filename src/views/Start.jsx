import { weekdayName } from '../ids'
import { go } from '../route'
import { clampLoopWeeks, coveringWorkout, dateKey, remainingInLoop } from '../schedule'
import { useStore } from '../store-context'
import { RoutineNewForm } from './Routine'
import { Back } from './shared'
import { Button, List, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'

export function StartWorkout() {
  const store = useStore()
  const routines = (store.routines || []).filter((routine) => !routine.archivedAt)
  const loop = clampLoopWeeks(store.schedule?.loopWeeks)
  const upcoming = remainingInLoop(routines, store.schedule)

  return (
    <Screen>
      <Back />
      <Title>Start</Title>

      {(store.draftWorkouts || []).length ? (
        <>
          <SectionHeader>Drafts</SectionHeader>
          <List>
            {store.draftWorkouts.map((draft) => (
              <Row
                key={draft.id}
                value={
                  <Button
                    onClick={() => {
                      store.resumeDraft(draft.id)
                      go(`/workout/${draft.routineId || draft.sessionId}`)
                    }}
                  >
                    Resume
                  </Button>
                }
              >
                {draft.snapshot?.routineName || draft.snapshot?.sessionName || 'Workout'} — {(draft.sets || []).length} sets
              </Row>
            ))}
          </List>
        </>
      ) : null}

      <SectionHeader>Scheduled</SectionHeader>
      {upcoming.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {upcoming.map((item) => {
          const when = dateKey(item.date)
          const done = coveringWorkout(store.workouts, item.routine.id, when, item.slot.id)
          const meta = `${loop > 1 ? `Week ${item.week + 1} · ` : ''}${weekdayName(item.date.getDay())}`
          return done ? (
            <Row key={`${item.slot.id}-${when}`} value={`Done ${dateKey(done.finishedAt)}`}>
              {item.routine.name} — {meta}
            </Row>
          ) : (
            <Row key={`${item.slot.id}-${when}`} to={`/workout/${item.routine.id}/${item.slot.id}/${when}`}>
              {item.routine.name} — {meta}
            </Row>
          )
        })}
      </List>

      <SectionHeader>Any routine</SectionHeader>
      {routines.length === 0 ? (
        <RoutineNewForm
          onSave={({ name, focus }) => {
            const id = store.addRoutine({ name, focus })
            go(`/workout/${id}`)
          }}
          onCancel={() => go('/')}
        />
      ) : (
        <List>
          {routines.map((routine) => (
            <Row key={routine.id} to={`/workout/${routine.id}`}>
              {routine.name} — {routine.focus}
            </Row>
          ))}
        </List>
      )}
    </Screen>
  )
}
