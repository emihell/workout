import { useState } from 'react'
import { leaveWorkoutToToday } from '../../workout-actions'
import { recordButton } from '../../analytics'
import { improvementList } from '../../beat-last-time'
import { previousSameRoutineWorkouts } from '../../history-queries.js'
import { useStore } from '../../store-context'
import { Back } from '../shared'
import { Button, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
import { anythingLogged, loggedSetCount } from '../../workout-log'
import { finishSkippedLines } from '../../finish-unfinished.js'
import { activeFeel, activeNote } from '../../workout-note.js'
import { ImprovementLines, NotInWorkout } from './helpers'
import { abandonWorkout, isActiveFor } from './workout-helpers.js'
import { WorkoutPill } from './rest'

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
  // req-176 — one quiet line per exercise Save will add skipped sets to, derived from
  // what Save writes (finish-unfinished.js → withSkippedUnloggedSets). Empty when every
  // planned set was logged.
  const skippedLines = finishSkippedLines(active)
  // req-158 (DEC-085 §3) — Finish computes and stores no progression record; the
  // recommendation is computed only by History recalc (progressionFromWorkout).

  // The previous same-routine workouts (req-111: the whole list, so an exercise entirely
  // skipped last time compares against the one before, DEC-053).
  const priors = previousSameRoutineWorkouts(active, store.workouts, store.routines)
  // req-210 (DEC-117 §1) — per exercise, the small "↑ N%" on DEC-050's axis; silent when
  // there's no prior or nothing improved. The req-96 one-line celebration it replaced is gone
  // (req-210 follow-up, product owner).
  const improvements = improvementList(active, priors, store.exercises)

  const name = active?.snapshot?.routineName

  return (
    <Screen className="ui-screen--rest">
      <Back to={`/workout/${routineId}`} />
      <WorkoutPill />
      <Title>Finish</Title>
      <p className="ui-sub">
        {name} — {minutes} min · {setCount} {setCount === 1 ? 'set' : 'sets'}
      </p>
      {skippedLines.map((line, i) => (
        <p key={i} className="ui-sub">
          {line}
        </p>
      ))}
      <ImprovementLines list={improvements} />
      {empty ? (
        <p className="ui-sub" role="status">
          <strong>Nothing logged.</strong> No set in this session was logged — abandon it, or save it anyway.
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
          store.finishWorkout({ overallNote, overallFeel })
          leaveWorkoutToToday()
        }}
      >
        {empty ? 'Save anyway' : 'Save'}
      </Button>
    </Screen>
  )
}
