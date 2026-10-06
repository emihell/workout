import { useEffect, useRef, useState } from 'react'
import { go } from '../../route'
import { leaveWorkoutToToday } from '../../workout-actions'
import { recordButton } from '../../analytics'
import { defaultBeep } from '../../rest-cue.js'
import { summaryPriorWorkout, workoutSummaryStats } from '../../history-queries.js'
import { Button, List, Row, Screen, SectionHeader, Title } from '../../ui/index.jsx'
import { autoFinishArgs } from '../../workout-note.js'

// req-84 — auto-complete a finished routine. When every exercise is done the overview
// mounts this instead of the list: a "great job" summary (volume/duration/sets, each
// with a delta vs the previous SAME-routine workout when one exists) and a ~10s
// countdown that auto-commits the finish. The finish it writes is identical to the
// manual Finish screen's (the active Note and Feel), so this adds no new
// persisted shape — see store.finishWorkout / finish.jsx. req-116: Sets counts only
// non-skipped sets (workoutSummaryStats → loggedSetCount). req-107 — the Note is the
// active workout's note (written on the overview), not '', so it isn't lost silently.
//
// Cancel stops the countdown and returns to the overview with NOTHING finished. req-116 —
// Cancel and Edit both set `autoFinishDismissed` on the active workout, so the summary
// stays dismissed for this workout (a remount or reload doesn't re-arm it). Feel is the
// active workout's overallFeel (chosen on Finish), '' when none was chosen. Edit opens the manual
// Finish screen so Feel/Note can be set. The countdown is a UI-only timer
// (a deadline + 250ms tick, the useRestCountdown pattern) — never the persisted
// restEndsAt, which carries pause/skip semantics.

// req-187 (DEC-103 §1) — no "Update your routine?" section here any more (req-178/182 put
// one in, and req-182 held the countdown while it was open). The routine-kg confirm is a
// sheet on the last exercise's last Complete, answered before this summary mounts (the
// overview waits for the sheet), so the countdown always runs.

const COUNTDOWN_MS = 10000

function signed(n) {
  if (n > 0) return `+${n}`
  return String(n)
}

// req-191 §2 — `countdown` false (the workout became all-done by a skip, endedOnSkip): no
// timer and no "Finishing in"; [Finish] commits the same finish the countdown would, and
// [Keep going] dismisses as before. No Edit (the spec's two buttons; Keep going → the
// overview's Finish link reaches the Finish screen). A completed last set keeps the countdown (default).
export function AutoCompleteSummary({ routineId, active, store, onCancel, countdown = true }) {
  // Captured once at mount so the shown duration is stable, not ticking.
  const [mountNow] = useState(() => Date.now())
  const [deadline] = useState(() => Date.now() + COUNTDOWN_MS)
  const [now, setNow] = useState(() => Date.now())
  const committedRef = useRef(false)
  const [stats] = useState(() => {
    const prior = summaryPriorWorkout(active, store.workouts, store.routines)
    return workoutSummaryStats(active, prior, mountNow)
  })

  // Auto-commit on expiry. committedRef guards the tick from firing finishWorkout
  // twice. Cancel/Edit unmount this component (clearing the interval) before it fires.
  // req-191 review fix 2 — `manual` (the no-countdown summary's [Finish] tap): its own
  // analytics id and no beep (the beep cues a finish the user didn't tap). Same finish write.
  const commit = ({ manual = false } = {}) => {
    if (committedRef.current) return
    committedRef.current = true
    recordButton(manual ? 'summary-finish-workout' : 'auto-finish-workout')
    // Optional cue at an auto-commit — the AudioContext is already unlocked from set-complete
    // taps; defaultBeep is fail-silent if not.
    if (!manual) defaultBeep()
    store.finishWorkout(autoFinishArgs(active))
    leaveWorkoutToToday()
  }

  useEffect(() => {
    if (!countdown) return undefined
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
  const name = active?.snapshot?.routineName || 'Workout'
  const d = stats.deltas
  const rows = [
    // req-189 — grouped as History's "… kg lifted"; req-191 §7 (unconfirmed wording) says what it sums.
    { label: 'Total lifted (all sets added up)', value: `${Number(stats.volume || 0).toLocaleString('en-US')} kg`, delta: d ? `${signed(d.volume)} kg` : null },
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
      {countdown ? (
        <p className="ui-sub" aria-live="polite">
          Finishing in {secondsLeft}s…
        </p>
      ) : (
        <Button variant="primary" block onClick={() => commit({ manual: true })}>
          Finish
        </Button>
      )}
      {countdown ? (
        <Button
          variant="primary"
          block
          onClick={() => {
            recordButton('auto-finish-edit')
            // req-116 — Edit dismisses the summary for this workout (persisted flag), so
            // Back from Finish returns to the overview, not a fresh countdown.
            store.patchActive({ autoFinishDismissed: true })
            go(`/workout/${routineId}/finish`)
          }}
        >
          Edit
        </Button>
      ) : null}
      <Button
        variant="quiet"
        block
        onClick={() => {
          recordButton('auto-finish-cancel')
          onCancel()
        }}
      >
        {/* req-189 (unconfirmed wording) — was "Cancel"; same action (stops the countdown). */}
        Keep going
      </Button>
    </Screen>
  )
}
