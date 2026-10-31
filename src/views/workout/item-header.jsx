// req-276 — split from views/workout/item.jsx: the exercise screens' title and setup lines.
import {
  ExerciseHead,
  NavLink,
} from '../../ui/index.jsx'
import {
  exerciseName,
} from './workout-helpers.js'
import { equipmentLabel } from '../../equipment-label.js'
import { oneSideLine } from '../../library-hints.js'
import { exerciseEditorPath } from './item-actions.js'

// `aside` (req-80) renders a small control beside the title — the live log screen
// passes the "Add note" toggle here so it sits next to the exercise name.
// req-212 (H5) — the head is the library's ExerciseHead (was ad-hoc markup here).
// req-219 — `eachSide` (a unilateral library entry) adds one quiet line under the head.
// req-240 — `eachSide` is isEachSide (own setting, else library); a timed exercise gets the hold line.
export function ExerciseTitle({ routineId, item, ex, bits, aside, eachSide = false }) {
  const inLibrary = Boolean(item?.exerciseId && ex?.id === item.exerciseId)
  const name = exerciseName(item)
  return (
    <>
      <ExerciseHead
        title={inLibrary ? <NavLink to={exerciseEditorPath(routineId, item)} look="plain">{name}</NavLink> : name}
        aside={aside}
        subtitle={(bits || []).filter(Boolean).join(' · ')}
      />
      {eachSide ? <p className="ui-sub">{oneSideLine(ex)}</p> : null}
    </>
  )
}

// The review's setup lines under the title (the old done view's): equipment, then the routine's
// note for this exercise. Review round 1 — restored (the spec never asked to remove them).
export function ExerciseSetupHeader({ item, ex }) {
  return (
    <>
      {ex?.equipment ? <p className="ui-sub">{equipmentLabel(ex.equipment)}</p> : null}
      {item?.notes ? <p className="ui-sub">{item.notes}</p> : null}
    </>
  )
}
