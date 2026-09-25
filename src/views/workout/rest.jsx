import { recordButton } from '../../analytics'
import { useStore } from '../../store-context'
import { RestPill as UIRestPill } from '../../ui/index.jsx'
import { useRestCountdown } from './rest-countdown.js'


// req-78 — the single, persistent rest UI, now a small floating pill (was RestBar).
// Self-contained: reads only activeWorkout rest state, renders nothing when no rest is
// active, and is `position: fixed`, so it can be dropped into any in-workout screen and
// the countdown keeps ticking regardless of which screen shows. Rest no longer blocks
// input (D2: the next set's form is always live), so the pill only shows the time and
// skips the rest on tap — the pause/+30s/next controls of the old blocking bar are gone.
export function RestPill() {
  const store = useStore()
  const active = store.activeWorkout
  const { remainingMs, resting } = useRestCountdown(active)
  if (!active || !resting) return null
  const sec = Math.ceil(remainingMs / 1000)
  const onSkip = () => {
    recordButton('rest-skip')
    store.patchActive({ restEndsAt: null, restPausedRemaining: null })
  }
  return <UIRestPill seconds={sec} onSkip={onSkip} />
}
