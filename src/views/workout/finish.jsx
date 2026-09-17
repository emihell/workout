import { useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { buildFinishProgression } from '../../model'
import { beatLastTimeLine, beatLastTimeWins } from '../../beat-last-time'
import { previousSameRoutineWorkout } from '../../storage'
import { useStore } from '../../store-context'
import { Back, Missing } from '../shared'
import { Button, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
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
  const [overallNote, setOverallNote] = useState('')
  const [overallFeel, setOverallFeel] = useState('')
  const active = store.activeWorkout
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
  // selection the auto-complete summary uses (req-84).
  const prior = previousSameRoutineWorkout(active, store.workouts, store.routines)
  const beatLine = beatLastTimeLine(beatLastTimeWins(active, prior, store.exercises))

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
      <Textarea label="Note" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={3} />
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
