# req-31 — rest-end cue (sound + vibration when the rest timer hits zero)

Status: READY
Source: Phase-1 backlog item "Rest-end cue + keep the screen awake" — the wake-lock half
shipped as req-09; this is the remaining cue half. Decision: DEC-023.
Type: In-gym flow (runtime behaviour, no persisted data). Gate: ux-feel → Emilio's hands
before merge (a cue is felt on a real phone, not asserted in a test).

## Why

The rest timer only ticks a number on screen (`RestBar`, `useRestCountdown`, `restEndsAt`
on `activeWorkout`). In a gym you have to watch the phone to know rest is up. Wake-lock
(req-09) keeps the screen on but a lit screen in a pocket still tells you nothing. Emilio
wants a **sound + vibration** cue when rest ends (DEC-023).

This is the counterpart of the wake-lock: mirror that module's shape exactly
(`src/wake-lock.js` + `src/wake-lock.test.js`) — a null-rendering component mounted in the
app shell, fully feature-detected, fail-silent, and unit-tested. Read those two files first;
this req is "the same again, for a beep + a buzz on the rest-end edge."

## Scope

**In:**
1. **A rest-end cue module** — new `src/rest-cue.js` (plain `.js`, no JSX, so `node --test`
   imports it directly, same reason wake-lock is `.js`) exporting a null-rendering
   `RestEndCue` component. Mount it in the app shell alongside `<WakeLock />` (find where
   `WakeLock` is mounted and put `RestEndCue` next to it).
2. **Fire on the natural 1→0 edge, exactly once per armed rest.** The cue fires when the
   live countdown reaches `restEndsAt` (rest ran out on its own). It must **not** fire:
   - on **Next** — `onNext` (`rest.jsx:58`) clears `restEndsAt` deliberately; ending rest
     by hand is not a cue.
   - on **pause** — pause moves the remaining time to `restPausedRemaining` and nulls
     `restEndsAt` (`rest.jsx:42–48`); a paused rest is not ending.
   - **more than once** for the same armed rest.
   Re-arming is allowed to cue again: **+30s** (`onAddTime`) and **pause→resume**
   (`onPauseResume`) both produce a *new* `restEndsAt`, and when that new one lands the cue
   fires for it. So dedupe on the `restEndsAt` value: remember the last `restEndsAt` you
   cued, fire when `now >= restEndsAt` and this `restEndsAt` hasn't been cued yet, then
   record it. A fresh `restEndsAt` (new number) clears the way to fire again.
3. **Sound** — a short beep via the Web Audio API (a brief oscillator, or a tiny embedded
   sample; CC's call — keep it short and plain, no asset file if an oscillator suffices).
   iOS requires an AudioContext to be unlocked by a user gesture before it can produce
   sound: unlock/`resume()` the context inside a real gesture that already happens in the
   flow — the set-complete tap that arms the rest is the natural one (completing a set is
   what starts a rest). CC decides the exact unlock hook; the requirement is only that a
   beep actually plays on a phone where the context was unlocked, and that a locked/blocked
   context fails silently (no throw).
4. **Vibration** — `navigator.vibrate([...])` (a short pattern) alongside the sound.
   Feature-detect: `navigator.vibrate` is absent on iOS Safari, where it must simply no-op
   (sound still plays). No unlock needed.
5. **Fail-silent, always** — mirror wake-lock's contract verbatim: an unsupported API is a
   no-op, any throw from audio or vibrate is swallowed, and the cue never throws into or
   disrupts the workout, its logging, or its save path. Renders nothing.
6. **Keep the edge-detection testable and pure** — the "which `restEndsAt` should fire, and
   has it already" decision is the inspectable logic (DESIGN: logic that fires a
   user-perceptible effect must be testable). Structure it so a unit test can drive a
   sequence of `(restEndsAt, now)` states and assert the fire/no-fire/once outcomes with the
   sound + vibrate side-effects injected/mocked — the way `wake-lock.test.js` mocks
   `navigator.wakeLock`. This is the branch's automated receipt.

**Out of scope (do NOT do):**
- **No settings toggle** (DEC-023). The cue always fires on rest-end during an active
  workout; the phone's own mute governs sound. A toggle is a follow-up only if it feels
  intrusive in use — not built until Emilio asks. Do not add a Settings control or a
  persisted preference.
- **No silent-mode detection.** There is no reliable web API; do not attempt it. The OS
  mute switch silences the sound (correct); vibration is unaffected. (See DEC-023.)
- **No change to the rest timing / state machine.** `restEndsAt`, `restPausedRemaining`,
  `useRestCountdown`, `restAfterSet`, `RestBar` behaviour all stay exactly as they are —
  this req only *observes* the countdown and fires a cue. If a cue-correct implementation
  seems to need a rest-logic change, stop and report it (the code wins — CLAUDE.md).
- **No persisted-data / schema change.** Pure runtime behaviour, no `localStorage` write.
- **No notification API / no background cue.** Screen-foreground sound + vibration only.
  A late fire when the tab returns to the foreground after rest ended while backgrounded is
  acceptable (the 250ms interval is throttled in the background; on return `now` has passed
  `restEndsAt` and the cue fires once) — do not engineer against it.

## Ordered steps

1. Read `src/wake-lock.js` + `src/wake-lock.test.js` and find where `<WakeLock />` mounts.
2. `src/rest-cue.js` — `RestEndCue` component: read `activeWorkout` rest state, tick like
   `useRestCountdown` (reuse the hook if clean, or a minimal effect), detect the 1→0 edge
   with the dedupe-on-`restEndsAt` rule (step 2 of scope), fire sound + vibration, fail-silent.
3. Factor the fire-decision as a pure/injectable unit and wire the audio + vibrate as the
   injected side-effects.
4. Unlock the AudioContext on the set-complete gesture (or the chosen hook); fail-silent.
5. Mount `<RestEndCue />` beside `<WakeLock />` in the app shell.
6. `src/rest-cue.test.js` — mock audio + `navigator.vibrate`; assert: fires once on the
   natural edge; does NOT fire on Next (restEndsAt cleared), on pause, or twice for one
   rest; fires again after +30s / resume (new restEndsAt); no-ops when APIs are absent;
   never throws.
7. `./check`; then a real-phone browser-walk (see below).

## Acceptance criteria (write before implementing)

- [ ] Completing a set with rest configured, then letting the timer run to 0, produces a
      **beep and a vibration** (on a device/browser that supports each) — once.
- [ ] Pressing **Next** to end rest early fires **no** cue.
- [ ] Pausing rest fires no cue; **+30s** and **pause→resume** each let the cue fire when the
      new countdown reaches 0 (re-arm cues again).
- [ ] The cue fires **exactly once** per armed rest (no repeat while `remaining` sits at 0).
- [ ] On a browser without `navigator.vibrate` (iOS Safari) the sound still plays and nothing
      throws; on any unsupported API the cue is a silent no-op.
- [ ] Unit test (`rest-cue.test.js`) covers fire-once / not-on-Next / not-on-pause /
      re-arm-fires-again / no-op-when-unsupported / never-throws, with side-effects mocked
      (the wake-lock.test.js pattern). `./check` green.
- [ ] No Settings control, no persisted preference, no rest-timing change (diff shows only the
      new module + its mount + the unlock hook + tests).

## Notes for the builder

- The visible change at the merge gate: rest ending now beeps + buzzes. Emilio judges the
  feel on a real phone (loudness/length of the beep, the vibration pattern) — those are
  tunable and he may ask to adjust; ship a sensible short default.
- Sound on iOS is the fiddly part (AudioContext unlock + the ringer/mute switch). Get the
  unlock wired to a real gesture and fail-silent if it can't; do **not** chase silent-mode
  detection (DEC-023 — it isn't reliably possible).
- If you find the cue can't be made reliable without touching rest *state* (not just reading
  it), that's a spec conflict — stop and report rather than reshaping the timer.
