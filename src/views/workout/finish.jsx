import { useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { buildFinishProgression } from '../../model'
import { beatLastTimeLine, beatLastTimeWins } from '../../beat-last-time'
import { previousSameRoutineWorkouts } from '../../storage'
import { useStore } from '../../store-context'
import { Back, Missing } from '../shared'
import { Button, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
import { activeNote } from '../../workout-note.js'
import { isActiveFor } from './helpers'
import { RestPill } from './rest'

export function WorkoutFinish({ routineId }) {
  const store = useStore()
  if (!isActiveFor(store.activeWorkout, routineId)) {
    return <Missing>Not found.</Missing>
  }
  return <FinishScreen routineId={routineId} />
}

function FinishScreen({ routineId }) {
  const store = useStore()
  const [overallFeel, setOverallFeel] = useState('')
  const active = store.activeWorkout
  // req-107 — ONE workout note: the Note field is the active workout's overallNote
  // (pre-filled from the overview), and edits write straight back through patchActive,
  // so Back to the overview and returning shows the edit. What's saved is the note at
  // Finish. A legacy active workout without the field reads as '' (activeNote).
  const overallNote = activeNote(active)
  const started = active?.startedAt ? new Date(active.startedAt) : new Date()
  const [minutes] = useState(() => Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)))
  const setCount = (active?.sets || []).length
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
    <Screen>
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
      <SectionHeader>Feel</SectionHeader>
      <SegmentedControl
        options={['Easy', 'Good', 'Hard', 'Exhausting']}
        value={overallFeel}
        onChange={setOverallFeel}
        ariaLabel="Feel"
      />
      <Textarea label="Note" value={overallNote} onChange={(e) => store.patchActive({ overallNote: e.target.value })} rows={3} />
      <Button
        variant="primary"
        block
        onClick={() => {
          recordButton('finish-workout')
          store.finishWorkout({ overallNote, overallFeel, progression })
          go('/')
        }}
      >
        Save
      </Button>
    </Screen>
  )
}
