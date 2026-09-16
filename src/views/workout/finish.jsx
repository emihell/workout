import { useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { buildFinishProgression } from '../../model'
import { useStore } from '../../store-context'
import { Back, Missing } from '../shared'
import { Button, List, Row, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
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
  // auto-complete path, so both persist byte-identical progression.
  const progression = buildFinishProgression(store.exercises, active)

  const name = active?.snapshot?.routineName || active?.snapshot?.sessionName

  return (
    <Screen>
      <Back to={`/workout/${routineId}`} />
      <RestPill />
      <Title>Finish</Title>
      <p className="ui-sub">
        {name} — {minutes} min · {setCount} sets
      </p>
      <SectionHeader>Next time</SectionHeader>
      {progression.length === 0 ? (
        <p className="ui-sub">None.</p>
      ) : (
        <List>
          {progression.map((item) => {
            const none = item.reason === 'Skipped.' || item.reason === 'None.'
            const next = none
              ? item.reason
              : item.to.length
                ? `${item.to.join('/')} kg`
                : (item.targetsTo || []).filter(Boolean).join('/') || item.reason
            return (
              <Row key={item.routineItemId} value={next}>
                {item.name}
              </Row>
            )
          })}
        </List>
      )}
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
