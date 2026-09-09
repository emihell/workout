# req-09 — keep the screen awake during an active workout (Screen Wake Lock)

**Status: READY** — scope confirmed (active workout only, Emilio 2026-09-09); no open decisions.
Independent of all other reqs.

**Gate: device-verified → Emilio's hands before merge** (DEC-009 spirit). The wiring — the lock is
requested when a workout becomes active, released when it ends, re-acquired after the tab is
backgrounded — the planning session can verify in the browser (mock/observe `navigator.wakeLock`).
But the actual effect (a real phone's screen not dimming/sleeping mid-workout) is only provable on
an idle mobile device, which the planning session cannot do. So planning builds + verifies the
wiring, then **stops for Emilio's real-device check** before merge. (This is a distinct gate
reason — *device-only-verifiable* — alongside ux-feel and persisted-data.)

## Why

The in-gym workout is mobile-only (DEC-010). Phones sleep after ~30s idle; mid-set or mid-rest the
screen goes dark and the user has to wake it to log the next set — friction in exactly the flow
this app exists to make flawless. The Screen Wake Lock API (`navigator.wakeLock.request('screen')`)
holds the screen on; it's supported on Android Chrome and iOS Safari 16.4+, needs HTTPS (Pages is),
and carries over to the planned native app. [measured] — no wake-lock code in `src/` today; rest
ticking already only runs while the log screen is foregrounded, so nothing keeps the screen alive.

## The behaviour

- **Only while a workout is active** (`store.activeWorkout != null`) — across every in-workout
  screen and during rests. Not app-wide: browsing routines/schedule/history/settings must NOT hold
  the screen awake.
- Acquire the lock when a workout becomes active; **release** it when the workout ends (Finish /
  Abandon → `activeWorkout` back to null) or the app unmounts.
- **Re-acquire on `visibilitychange` → visible** while a workout is still active: the browser
  auto-releases the lock when the tab is backgrounded or the screen locks, so it must be requested
  again on return, or it silently stops working after the first backgrounding.
- **Graceful + fail-silent:** if `navigator.wakeLock` is unsupported, do nothing (no error). Any
  request/release rejection is swallowed — a wake-lock failure must never disrupt the workout, its
  logging, or its save path (same principle as req-08 analytics: the workout is sacred).

## Scope

- A small shell-level `WakeLock` component or hook (mounted inside `StoreProvider` alongside
  `SaveFailedBanner` in `App.jsx`), reading `useStore().activeWorkout`, managing the sentinel in an
  effect keyed on whether a workout is active, plus a `visibilitychange` listener. CC's exact
  structure.
- No UI. No setting/toggle (always on during an active workout; revisit if users ever ask).

## Out of scope

- Audible / haptic rest-end cue — the *other* half of the backlog line; a separate req.
- Keeping the screen awake outside a workout, or a user preference to disable it.
- Any fallback hack for unsupported browsers (NoSleep-style video loops) — unsupported just
  degrades to normal sleep.

## Ordered steps

1. `WakeLock` component/hook in the app shell: effect that, while `activeWorkout` is present,
   requests `navigator.wakeLock.request('screen')` and stores the sentinel; releases and clears it
   when `activeWorkout` goes null or on unmount. All wrapped so nothing throws.
2. Add a `visibilitychange` listener that re-requests the lock when the document becomes visible
   and a workout is still active; remove the listener on cleanup.
3. Feature-detect `navigator.wakeLock` — absent → the whole thing is a no-op.

## Acceptance criteria (written before implementation)

- **Requested on active, released on end (wiring):** with `navigator.wakeLock` mocked, the sentinel
  is requested when `activeWorkout` transitions to present and `sentinel.release()` is called when
  it transitions to null. Prove with a component/effect test (react-test-renderer, per DEC-007) +
  a mocked `navigator.wakeLock`.
- **Re-acquire on visibility (failure-mode of the API):** simulate the sentinel being released
  (as backgrounding does) then a `visibilitychange` to visible while active → a new request is
  made. Test with the mock.
- **Unsupported / throwing is silent (failure case, required):** with `navigator.wakeLock`
  undefined, and separately with `request` rejecting, nothing throws and the workout is unaffected.
- **Scoped:** the lock is not requested when there is no active workout (asserted in the test:
  `activeWorkout` null → no request).
- **No regression:** `./check` green (paste the line).
- **Real-device check (Emilio, the gate):** on a phone, start a workout and leave it idle through
  the normal auto-sleep timeout — the screen stays on; finish/abandon the workout and the screen
  resumes normal sleeping. Also confirm backgrounding the tab and returning mid-workout keeps it
  working. This is what makes it mergeable; the planning session cannot verify it.

## Notes

Splits the "rest-end cue + keep the screen awake" backlog line — this is the keep-awake half; the
rest-end cue stays a separate item. Pairs with DEC-010 (mobile-primary). The wiring pattern
(request/release/re-acquire on visibility) is the same one the future native app will replace with
a native keep-awake, so the seam is worth keeping tidy.
