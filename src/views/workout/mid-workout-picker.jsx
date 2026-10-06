import { useState } from 'react'
import { useStore } from '../../store-context'
import { needsSetup, resolvePicks, swapPicks } from '../../mid-workout-pick.js'
import { Actions, Button, Field, NavLink, SectionHeader } from '../../ui/index.jsx'
import { ExercisePicker } from '../ExercisePicker'

const NO_HISTORY = 'No history — you set sets and rest next'
// req-189 (DEC-106) — on a Swap a no-history pick takes the replaced exercise's sets and rest.
const NO_HISTORY_SWAP = 'No history — same sets and rest'

// req-188 / DEC-104 — the picker for Swap (max 1) and Add exercise (multi). The picker writes
// nothing (onPick). History picks go straight through with their history prescription; when
// any pick has no history, one step lists each of them and asks for Sets (required) and Rest
// (optional) — fields start empty, reps and kg stay blank. Only on the step's confirm (or
// straight away when nothing needs it) are records created (a library pick → a new exercise,
// an archived "Use mine" → restored, as the routine picker's add does) and `onDone` called
// with [{ exerciseId, item }]. Cancel / Back on either screen create, add and swap nothing.
// req-189 (DEC-106) — `copyFrom` (Swap passes the replaced item): no step at all; a no-history
// pick copies that item's sets and rest (mid-workout-pick.js swapPicks). Add passes none.
export function MidWorkoutPicker({ max = Infinity, addLabel, cancelTo, onDone, copyFrom = null }) {
  const store = useStore()
  const [pending, setPending] = useState(null) // the picks awaiting the step
  const [values, setValues] = useState([])
  const [errors, setErrors] = useState({})

  const commit = (picks) => {
    const added = picks.map((pick) => {
      let exerciseId
      if (pick.kind === 'library') exerciseId = store.addExercise(pick.data)
      else if (pick.restore) exerciseId = store.restoreExercise(pick.exerciseId)
      else exerciseId = pick.exerciseId
      return { exerciseId, item: pick.item }
    })
    onDone(added)
  }

  if (!pending) {
    return (
      <ExercisePicker
        cancelTo={cancelTo}
        max={max}
        addLabel={addLabel}
        startingLabel={copyFrom ? NO_HISTORY_SWAP : NO_HISTORY}
        onPick={(picks) => {
          if (!picks.length) return
          if (copyFrom) commit(swapPicks(picks, copyFrom))
          else if (picks.some(needsSetup)) {
            setValues(picks.map(() => ({ sets: '', rest: '' })))
            setPending(picks)
          } else commit(picks)
        }}
      />
    )
  }

  const set = (index, field, value) =>
    setValues((list) => list.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)))
  const save = () => {
    const result = resolvePicks(pending, values)
    if (result.errors) return setErrors(result.errors)
    commit(result.picks)
  }

  return (
    <>
      <p className="ui-sub">No history yet. Set the sets and rest; reps and kg you enter as you log.</p>
      {pending.map((pick, index) =>
        needsSetup(pick) ? (
          <section key={`${pick.kind}-${pick.exerciseId || pick.name}`}>
            <SectionHeader>{pick.name}</SectionHeader>
            <Field
              label="Sets"
              inputMode="numeric"
              className="ui-input--num"
              value={values[index]?.sets ?? ''}
              onChange={(e) => set(index, 'sets', e.target.value)}
              required
            />
            {errors[index]?.sets ? (
              <p className="ui-field-error" role="alert">
                {errors[index].sets}
              </p>
            ) : null}
            <Field
              label="Rest (seconds)"
              inputMode="numeric"
              className="ui-input--num"
              value={values[index]?.rest ?? ''}
              onChange={(e) => set(index, 'rest', e.target.value)}
            />
            {errors[index]?.rest ? (
              <p className="ui-field-error" role="alert">
                {errors[index].rest}
              </p>
            ) : (
              <p className="ui-field-note">Blank = no rest timer.</p>
            )}
          </section>
        ) : null,
      )}
      <Actions
        className="ui-picker-bar"
        retreat={<NavLink to={cancelTo} look="secondary">Cancel</NavLink>}
        forward={
          <Button variant="primary" onClick={save}>
            {addLabel(pending.length)}
          </Button>
        }
      />
    </>
  )
}
