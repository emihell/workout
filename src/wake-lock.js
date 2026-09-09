// No JSX here (the component renders null), so `node --test` can import it
// directly — same reason error-boundary.js stays plain .js.
import { useEffect, useRef } from 'react'
import { useStore } from './store-context.js'

// Screen Wake Lock while a workout is active (req-09). Phones sleep after ~30s
// idle; mid-set or mid-rest that dark screen is friction in the one flow this
// app exists to make flawless. While `store.activeWorkout` is set we hold a
// `navigator.wakeLock.request('screen')` sentinel so the screen stays on, and
// release it the moment the workout ends (Finish/Abandon) or the app unmounts.
//
// Not app-wide: browsing routines/schedule/history/settings must NOT hold the
// screen awake — the effect is keyed on whether a workout is active.
//
// Fail-silent, always: an unsupported browser is a no-op, and any request or
// release rejection is swallowed. A wake-lock failure must never throw or
// disrupt the workout, its logging, or its save path (the workout is sacred).
//
// Renders nothing.
export function WakeLock() {
  const active = useStore().activeWorkout != null
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!active) return
    // Feature-detect: absent API → the whole thing is a no-op.
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return

    // Set on cleanup so an in-flight request resolving after unmount releases
    // instead of leaving a dangling lock.
    let cancelled = false

    async function acquire() {
      // Already holding a live lock → nothing to do.
      if (sentinelRef.current && !sentinelRef.current.released) return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          try {
            await sentinel.release()
          } catch {
            // fail-silent
          }
          return
        }
        sentinelRef.current = sentinel
      } catch {
        // fail-silent: request can reject (e.g. tab not visible, no permission)
      }
    }

    async function release() {
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      if (!sentinel) return
      try {
        await sentinel.release()
      } catch {
        // fail-silent
      }
    }

    function onVisibilityChange() {
      // The browser auto-releases the lock when the tab is backgrounded or the
      // screen locks; without this it silently stops working after the first
      // backgrounding. Only re-request if our sentinel is gone/released.
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
      if (sentinelRef.current && !sentinelRef.current.released) return
      sentinelRef.current = null
      acquire()
    }

    acquire()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    return () => {
      cancelled = true
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      release()
    }
  }, [active])

  return null
}
