import { useEffect, useState } from 'react'
import { finishTimeFor } from '../../workout-log.js'

// req-227 — the finish time a finish screen (Finish, the auto-complete summary) shows and
// saves. `now` is refreshed on a FINISH_TICK_MS tick while mounted, and (review round 1) on
// visibilitychange → visible, pageshow and focus: a locked / backgrounded phone suspends the
// interval, so coming back must not leave hours-old minutes on screen.
export const FINISH_TICK_MS = 30000
// A `now` older than this at Save means the screen was demonstrably stale (the tick or a
// refresh would have replaced it) → re-derive with the tap's time instead.
export const FINISH_STALE_MS = FINISH_TICK_MS + 5000

// The value Save stores: the shown one, unless `now` is stale (pure, for the guard's tests).
export function finishedAtForSave(active, shownNow, tapNow = Date.now()) {
  const at = tapNow - shownNow > FINISH_STALE_MS ? tapNow : shownNow
  return finishTimeFor(active, at).finishedAt
}

export function useFinishTime(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') refresh()
    }
    const t = setInterval(refresh, FINISH_TICK_MS)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return {
    finish: finishTimeFor(active, now),
    finishedAtForSave: () => finishedAtForSave(active, now),
  }
}
