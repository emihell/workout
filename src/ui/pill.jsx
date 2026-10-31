// req-276 — split from ui/index.jsx: the workout pill.
import { workoutPillLines } from './workout-pill.js'
import { cx } from './cx.js'

// ---- Molecules (compose the atoms) ----

// WorkoutPill (req-186, DEC-103 §3; was RestPill, req-78) — one floating pill for the
// whole workout. Resting: the rest clock; rest over (or none armed): "GO" (req-244: the
// counts sit on a second line), set apart by .ui-restpill--go (a pulse; static under reduced motion). The
// whole pill is one tap-target that opens the current exercise — it no longer skips the
// rest (that moved to "Skip rest" on the exercise screen). Presentational: the real
// screen wires onOpen; the showcase passes a stub.
// req-192 (DEC-108 §3) — `skip`: resting, on the current exercise's own log screen, a tap
// skips the rest; the pill then says so on line 2 (req-244: "Tap to skip rest").
// req-222 (DEC-125 §3) — the whole-workout count, after the set count; not shown while
// `skip` (DEC-108 §3).
export function WorkoutPill({ clock = null, set = null, exercise = null, go = false, skip = false, onOpen }) {
  const { top, bottom, label } = workoutPillLines({ clock, set, exercise, go, skip })
  return (
    <button
      type="button"
      className={cx('ui-restpill', go && 'ui-restpill--go')}
      onClick={onOpen}
      aria-label={label}
    >
      <span className="ui-restpill__time">{top}</span>
      {bottom ? <span className="ui-restpill__sub">{bottom}</span> : null}
    </button>
  )
}
