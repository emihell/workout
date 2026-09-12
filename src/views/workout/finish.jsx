import { useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { progressionForItem } from '../../model'
import { isSkippedSet } from '../../workout-log'
import { useStore } from '../../store-context'
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
    // req-40 — the saved core ({ routineItemId, sets, recommendation, to, targetsTo })
    // comes from the ONE shared helper, identical to the History recalc path. Only the
    // display-only fields below are computed here.
    const core = progressionForItem(store.exercises, active, item)
    const skippedForItem = (active?.sets || []).some(
      (set) => set.routineItemId === core.routineItemId && isSkippedSet(set),
    )
    return {
      routineItemId: core.routineItemId,
      exerciseId: item.exerciseId,
      name: item.exerciseName,
      from: item.suggestedWeights || [],
      to: core.to,
      targetsFrom: item.targets || [],
      targetsTo: core.targetsTo,
      action: core.recommendation.action,
      reason: core.sets.length ? core.recommendation.reason : skippedForItem ? 'Skipped.' : 'None.',
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
