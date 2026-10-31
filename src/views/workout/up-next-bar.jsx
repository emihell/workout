// req-276 — split from views/workout/item.jsx: the Up next bar.
import { useEffect, useState } from 'react'
import { recordButton } from '../../analytics'
import {
  Actions,
  Button,
  NavLink,
} from '../../ui/index.jsx'
import {
  exerciseName,
  swapExercisePath,
} from './workout-helpers.js'
import { UP_NEXT_MS } from '../../up-next.js'

// req-223 (DEC-125 §2) — "Up next: {name}", a 5 s "Starting in N…" countdown, and Skip · Swap
// · Start now. Shown on ARRIVAL only (up-next.js). The countdown writes nothing and starts
// nothing: at 0 it only hides the bar (onHide), as Start now does. Its timer is UI-only (a
// deadline + 250 ms tick, auto-complete.jsx's pattern), cleared on unmount — leaving the screen,
// logging a set (the parent stops rendering it), Skip or Swap.
export function UpNextBar({ item, routineId, onHide, onSkip }) {
  const [deadline] = useState(() => Date.now() + UP_NEXT_MS)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= deadline) {
        clearInterval(t)
        onHide()
      }
    }, 250)
    return () => clearInterval(t)
    // deadline is set once; onHide only sets the parent's state. Run-once interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  return (
    <div className="ui-up-next" role="group" aria-label="Up next">
      <p className="ui-up-next__name">Up next: {exerciseName(item)}</p>
      <p className="ui-sub" aria-live="polite">
        Starting in {secondsLeft}…
      </p>
      {/* DESIGN §4 — Skip and Swap are lateral, Start now (forward) on the right. Swap is
          navigation, so a link wearing the button look beside the real Buttons (DEC-040). */}
      <Actions
        lateral={
          <>
            <Button variant="secondary" onClick={onSkip}>
              Skip
            </Button>
            <NavLink to={swapExercisePath(routineId, item)} look="secondary">
              Swap
            </NavLink>
          </>
        }
        forward={
          <Button
            variant="primary"
            onClick={() => {
              recordButton('up-next-start-now')
              onHide()
            }}
          >
            Start now
          </Button>
        }
      />
    </div>
  )
}
