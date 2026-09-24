import { useState } from 'react'
import { leaveWorkoutToToday } from '../../workout-actions'
import { recordButton } from '../../analytics'
import { buildFinishProgression } from '../../model'
import { beatLastTimeLine, beatLastTimeWins } from '../../beat-last-time'
import { previousSameRoutineWorkouts } from '../../storage'
import { useStore } from '../../store-context'
import { Back } from '../shared'
import { Button, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
import { anythingLogged, loggedSetCount } from '../../workout-log'
import { activeFeel, activeNote } from '../../workout-note.js'
import { abandonWorkout, isActiveFor, NotInWorkout } from './helpers'
import { RestPill } from './rest'

export function WorkoutFinish({ routineId }) {
  const store = useStore()
  if (!isActiveFor(store.activeWorkout, routineId)) return <NotInWorkout routineId={routineId} />
  return <FinishScreen routineId={routineId} />
}

function FinishScreen({ routineId }) {
  const store = useStore()
  const active = store.activeWorkout
  // req-116 — Feel lives on the active workout (its existing overallFeel, like the
  // req-107 note), written through patchActive, so Back and returning keeps the choice
  // and the auto-complete path saves it. A legacy active workout reads as '' (activeFeel).
  const overallFeel = activeFeel(active)
  // req-107 — ONE workout note: the Note field is the active workout's overallNote
  // (pre-filled from the overview), and edits write straight back through patchActive,
  // so Back to the overview and returning shows the edit. What's saved is the note at
  // Finish. A legacy active workout without the field reads as '' (activeNote).
  const overallNote = activeNote(active)
  const started = active?.startedAt ? new Date(active.startedAt) : new Date()
  const [minutes] = useState(() => Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)))
  // req-116 — only non-skipped sets count (a logged warm-up counts); the auto-complete
  // summary counts the same way (workoutSummaryStats → loggedSetCount).
  const setCount = loggedSetCount(active)
  // req-116 / DEC-058 §4 — nothing logged (every set skipped, or none at all): warn,
  // make Abandon the primary action, and keep "Save anyway" as the secondary one.
  const empty = !anythingLogged(active)
  // req-40 — the saved core comes from the ONE shared progressionForItem helper
  // (identical to the History recalc path); req-84 — the same builder now feeds the
  // auto-complete path, so both persist byte-identical progression. req-96 removed the
  // "Next time" SURFACE (inert without RPE logging) but the progression is still
  // computed and persisted on finish (below) — only its display was dropped.
  const progression = buildFinishProgression(store.exercises, active)

  // req-96 — a quiet "you beat last time" line: any exercise heavier / more reps /
  // longer than the previous same-routine workout. Pure + inspectable; silent when
  // there's no prior or nothing improved (never a "you did worse"). Same prior-workout
  // selection the auto-complete summary uses (req-84). req-111 — the whole prior list,
  // so an exercise entirely skipped last time compares against the one before (DEC-053).
  const priors = previousSameRoutineWorkouts(active, store.workouts, store.routines)
  const beatLine = beatLastTimeLine(beatLastTimeWins(active, priors, store.exercises))

  const name = active?.snapshot?.routineName || active?.snapshot?.sessionName

  return (
    <Screen className="ui-screen--rest">
      <Back to={`/workout/${routineId}`} />
      <RestPill />
      <Title>Finish</Title>
      <p className="ui-sub">
        {name} — {minutes} min · {setCount} sets
      </p>
      {beatLine ? (
        <p className="ui-beat">
          <span className="ui-beat__mark" aria-hidden="true">↑</span>
          {beatLine}
        </p>
      ) : null}
      {empty ? (
        <p className="ui-sub" role="status">
          <strong>Nothing logged.</strong> No set in this workout was logged — abandon it, or save it anyway.
        </p>
      ) : null}
      <SectionHeader>Feel</SectionHeader>
      <SegmentedControl
        options={['Easy', 'Good', 'Hard', 'Exhausting']}
        value={overallFeel}
        onChange={(feel) => store.patchActive({ overallFeel: feel })}
        ariaLabel="Feel"
      />
      <Textarea label="Note" value={overallNote} onChange={(e) => store.patchActive({ overallNote: e.target.value })} rows={3} />
      {empty ? (
        <Button variant="primary" block onClick={() => abandonWorkout(store)}>
          Abandon
        </Button>
      ) : null}
      <Button
        variant={empty ? 'secondary' : 'primary'}
        block
        onClick={() => {
          recordButton('finish-workout')
          store.finishWorkout({ overallNote, overallFeel, progression })
          leaveWorkoutToToday()
        }}
      >
        {empty ? 'Save anyway' : 'Save'}
      </Button>
    </Screen>
  )
}
