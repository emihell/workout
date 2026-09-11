# req-31 — rest-end cue (sound + vibration)

Branch `req-31`. Type: in-gym flow, no persisted data. Gate: ux-feel (Emilio, real phone).

## Technical

### What changed

- **`src/rest-cue.js`** (new) — mirrors `src/wake-lock.js`: a null-rendering `RestEndCue`
  component mounted in the app shell, fully feature-detected, fail-silent. Three exports:
  - `nextCueState(prev, restEndsAt, now)` — the pure fire-once decision. `prev` is the
    prior return (or `undefined` at first observation). Dedupes on the `restEndsAt` **value**:
    fires when `restEndsAt != null && now >= restEndsAt && restEndsAt !== lastCued`, then
    records `lastCued`. A new `restEndsAt` (from +30s / pause→resume) is a new value, so it
    is allowed to fire again. First observation adopts current state without firing — a rest
    already past when we start watching (reload after it expired) is seeded as already-cued,
    so we never beep for an edge we never saw cross.
  - `unlockAudio()` — resumes a shared lazily-created `AudioContext`. Called from a user
    gesture so iOS lets audio play later. Fail-silent.
  - `RestEndCue({ beep, vibrate })` — reads `activeWorkout.restEndsAt`, ticks at 250ms
    (mirroring `useRestCountdown`) only while a rest is armed, runs `nextCueState` in an
    effect, and fires the injected side-effects once on the edge. Defaults: `defaultBeep`
    (a short two-tone 880→1175 Hz Web Audio beep, ramped gain so no click) and
    `defaultVibrate` (`navigator.vibrate([120,60,120])`, absent → no-op).
- **`src/App.jsx`** — `<RestEndCue />` mounted directly beside `<WakeLock />` in the shell.
- **`src/views/workout/item.jsx`** — `unlockAudio()` called at the top of `completeSet`
  (the set-complete tap that arms the rest — the natural in-flow gesture). Not in `skipSet`
  (skip clears rest, never cues) — but see the note below.

No change to `restEndsAt`, `restPausedRemaining`, `useRestCountdown`, `restPatchAfterSet`,
`RestBar`, or any persisted data. The cue only *observes* the countdown.

### Why paused / Next don't fire, for free

Both `onNext` and pause null out `restEndsAt` (`rest.jsx:42-48`, `:58-61`). The decision
only fires on a non-null `restEndsAt` reaching its end, so a nulled `restEndsAt` can never
fire — no special-casing needed. +30s and pause→resume mint a *new* `restEndsAt`, which the
value-dedupe treats as a fresh armed rest.

### What I verified — receipts

Acceptance criteria run as tests (`node --test src/rest-cue.test.js`, 16/16 pass):

- **fires once on the natural 1→0 edge; no repeat while remaining sits at 0** —
  `nextCueState` "fires once on the natural 1→0 edge…" + component "fires beep + vibrate
  once when a rest reaches its end, and not again for the same rest".
- **no cue on Next** — `nextCueState` "does not fire when Next clears restEndsAt" + component
  "does not fire when rest ends via Next".
- **no cue on pause; +30s / resume re-arm and cue again** — `nextCueState` "does not fire on
  pause" + "re-arms and fires again for a new restEndsAt" + "+30s: a larger restEndsAt
  arriving before the edge defers, then fires once".
- **no-op when APIs absent; never throws** — component "never throws when the injected beep
  throws (fail-silent)" + "default side-effects fail silently" (unlockAudio no-op with no
  AudioContext / no window). `defaultVibrate` feature-detects `navigator.vibrate`.
- **diff shows only the new module + its mount + the unlock hook + tests** —
  `git diff --stat`: `App.jsx` (+2), `item.jsx` (+5), plus new `rest-cue.js` / `rest-cue.test.js`.

Full gate green:

```
# tests 141 / pass 141 / fail 0
check: green — lint, 14 test file(s), and the build all passed.
```

### Choices the spec left open (→ candidates for DEC/log)

- **Beep**: a two-tone 880→1175 Hz Web Audio beep, ~270ms total, gain 0.2 with ramps (no
  click), no asset file. Spec said "short and plain, CC's call" and that loudness/length are
  tunable — this is the sensible short default; easy to change if it feels wrong.
- **Vibration pattern**: `[120, 60, 120]` (buzz-gap-buzz). Tunable.
- **Unlock hook**: `completeSet` only, not `skipSet` or the RestBar +30s/resume taps. Once
  the AudioContext is resumed within any gesture it stays running for the session, and
  `completeSet` is what arms the first cueable rest, so one unlock there covers the workout.
  (A skip clears rest and never cues, so it needs no unlock.)

## Workflow

- **No deviation from scope.** Built exactly the in-scope list; touched nothing out of scope.
  No settings toggle, no silent-mode detection, no rest-state change, no schema change.
- **One design choice worth recording as a refinement of DEC-023's dedupe rule:** the
  first-observation seed. The spec's dedupe ("remember the last `restEndsAt` you cued") left
  open what happens on a *fresh mount* over an already-expired-but-uncleared `restEndsAt`
  (rest expires but nothing clears `restEndsAt` until Next / next set / pause — so a reload
  in that window would, under a naive `lastCued = null` start, beep with no rest visible).
  `nextCueState` seeds `lastCued` to a past `restEndsAt` on first observation so it only cues
  rests whose end it actually witnesses. The spec's allowed "late fire on foreground return"
  case is preserved (same mounted instance — `lastCued` persists across the background, the
  rest was pending when last seen). Flagging it for Emilio to fold into DEC-023 if he agrees.
- **No spec conflict.** A correct cue needed only reading rest state, never reshaping it.

## Ready to look at (merge gate — real phone)

1. **what it does** — When a rest timer counts down to 0 on its own, the app now plays a
   short beep and vibrates (once). Ending rest by hand (Next) or pausing is silent. It's a
   permanently-mounted, null-rendering component beside the wake-lock; no UI, no setting.

2. **what to test** (open the app on branch `req-31`, on your phone):
   1. Complete a set with rest configured, let the timer run to 0 → beep + vibration, once? (iOS
      vibration won't fire — that's expected; the beep should.)
   2. Complete a set, then hit **Next** before it reaches 0 → no beep/buzz?
   3. Let a rest run to 0 and confirm it does **not** keep beeping while it sits at 0?
   4. Pause a rest and let real time pass the old end → silent? Then **Resume** and let it
      reach 0 → beeps again?
   5. Hit **+30s** near the end, let the new countdown reach 0 → beeps (for the new end)?
   6. Phone ringer/mute switch off → beep silenced but the app keeps working normally?

3. **what I could not verify myself** — everything audible/tactile: that the AudioContext
   actually unlocks and beeps on iOS, the beep's loudness/pitch/length, and the vibration
   pattern's feel. All node-level logic (fire-once, not-on-Next/pause, re-arm, fail-silent)
   is unit-tested, but a beep is felt, not asserted — this is the ux-feel gate. Tell me if the
   tone or the vibration wants tuning.
