import { useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { recommendNextPrescription } from '../../progress'
import { exerciseById } from '../../storage'
import { useStore } from '../../store-context'
import { itemKey } from '../../workout-log'
import { Back, Missing } from '../shared'
import { Button, List, Row, Screen, SectionHeader, SegmentedControl, Textarea, Title } from '../../ui/index.jsx'
import { isActiveFor } from './helpers'
import { RestBar } from './rest'

export function WorkoutFinish({ routineId }) {
  const store = useStore()
  if (!isActiveFor(store.activeWorkout, routineId)) {
    return <Missing>Not found.</Missing>
  }
  return <FinishScreen />
}

function FinishScreen() {
  const store = useStore()
  const [overallNote, setOverallNote] = useState('')
  const [overallFeel, setOverallFeel] = useState('')
  const active = store.activeWorkout
  const started = active?.startedAt ? new Date(active.startedAt) : new Date()
  const [minutes] = useState(() => Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)))
  const setCount = (active?.sets || []).length
  const items = active?.snapshot?.items || []
  const progression = items.map((item) => {
    const exercise =
      exerciseById(store.exercises, item.exerciseId) ||
      { type: item.exerciseType, weightStep: item.weightStep }
    const sets = (active?.sets || []).filter(
      (set) =>
        set.setType !== 'wu' &&
        set.routineItemId === itemKey(item) &&
        String(set.reps).toLowerCase() !== 'skipped',
    )
    const recommendation = recommendNextPrescription({
      targets: item.targets,
      sets,
      exercise,
    })
    const skippedForItem = (active?.sets || []).some(
      (set) =>
        set.routineItemId === itemKey(item) &&
        String(set.reps).toLowerCase() === 'skipped',
    )
    return {
      routineItemId: itemKey(item),
      exerciseId: item.exerciseId,
      name: item.exerciseName,
      from: item.suggestedWeights || [],
      to: sets.length ? recommendation.weights : item.suggestedWeights || [],
      targetsFrom: item.targets || [],
      targetsTo: recommendation.targets,
      action: recommendation.action,
      reason: sets.length ? recommendation.reason : skippedForItem ? 'Skipped.' : 'None.',
    }
  })

  const name = active?.snapshot?.routineName || active?.snapshot?.sessionName

  return (
    <Screen>
      <Back />
      <RestBar />
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
