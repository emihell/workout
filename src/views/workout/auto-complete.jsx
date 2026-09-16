import { useEffect, useRef, useState } from 'react'
import { go } from '../../route'
import { recordButton } from '../../analytics'
import { buildFinishProgression } from '../../model'
import { defaultBeep } from '../../rest-cue.js'
import { previousSameRoutineWorkout, workoutSummaryStats } from '../../storage'
import { Button, List, Row, Screen, SectionHeader, Title } from '../../ui/index.jsx'

// req-84 — auto-complete a finished routine. When every exercise is done the overview
// mounts this instead of the list: a "great job" summary (volume/duration/sets, each
// with a delta vs the previous SAME-routine workout when one exists) and a ~10s
// countdown that auto-commits the finish. The finish it writes is identical to the
// manual Finish screen's (empty Feel/Note, buildFinishProgression), so this adds no
// new persisted shape — see store.finishWorkout / finish.jsx.
//
// Cancel stops the countdown and returns to the overview with NOTHING finished (the
// parent suppresses the summary until the screen remounts). Edit opens the manual
// Finish screen so Feel/Note/progression can be set. The countdown is a UI-only timer
// (a deadline + 250ms tick, the useRestCountdown pattern) — never the persisted
// restEndsAt, which carries pause/skip semantics.

const COUNTDOWN_MS = 10000

function signed(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

export function AutoCompleteSummary({ routineId, active, store, onCancel }) {
  // Captured once at mount so the shown duration is stable, not ticking.
  const [mountNow] = useState(() => Date.now())
  const [deadline] = useState(() => Date.now() + COUNTDOWN_MS)
  const [now, setNow] = useState(() => Date.now())
  const committedRef = useRef(false)
  const [stats] = useState(() => {
    const prior = previousSameRoutineWorkout(active, store.workouts, store.routines)
    return workoutSummaryStats(active, prior, mountNow)
  })

  // Auto-commit on expiry. committedRef guards the tick from firing finishWorkout
  // twice. Cancel/Edit unmount this component (clearing the interval) before it fires.
  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    recordButton('auto-finish-workout')
    // Optional cue at commit — the AudioContext is already unlocked from set-complete
    // taps; defaultBeep is fail-silent if not.
    defaultBeep()
    const progression = buildFinishProgression(store.exercises, active)
    store.finishWorkout({ overallNote: '', overallFeel: '', progression })
    go('/')
  }

  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= deadline) {
        clearInterval(t)
        commit()
      }
    }, 250)
    return () => clearInterval(t)
    // deadline is set once; commit closes over stable store/active. Run-once interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  const name = active?.snapshot?.routineName || active?.snapshot?.sessionName || 'Workout'
  const d = stats.deltas
  const rows = [
    { label: 'Volume', value: `${stats.volume} kg`, delta: d ? `${signed(d.volume)} kg` : null },
    { label: 'Duration', value: `${stats.duration} min`, delta: d ? `${signed(d.duration)} min` : null },
    { label: 'Sets', value: String(stats.sets), delta: d ? signed(d.sets) : null },
  ]

  return (
    <Screen>
      <Title subtitle={name}>Great job!</Title>
      <SectionHeader>{d ? 'vs last time' : 'This workout'}</SectionHeader>
      <List>
        {rows.map((r) => (
          <Row key={r.label} value={r.delta ? `${r.value}  (${r.delta})` : r.value}>
            {r.label}
          </Row>
        ))}
      </List>
      <p className="ui-sub" aria-live="polite">
        Finishing in {secondsLeft}s…
      </p>
      <Button
        variant="primary"
        block
        onClick={() => {
          recordButton('auto-finish-edit')
          go(`/workout/${routineId}/finish`)
        }}
      >
        Edit
      </Button>
      <Button
        variant="quiet"
        block
        onClick={() => {
          recordButton('auto-finish-cancel')
          onCancel()
        }}
      >
        Cancel
      </Button>
    </Screen>
  )
}
