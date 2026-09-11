// No JSX here (the component renders null), so `node --test` can import it
// directly — same reason wake-lock.js stays plain .js. This is the cue half of
// the rest-timer pair (req-31 / DEC-023); wake-lock.js keeps the screen awake,
// this beeps + buzzes the moment a rest runs out.
import { useEffect, useRef, useState } from 'react'
import { useStore } from './store-context.js'

// The whole fire-once decision, as a pure state transition so a test can drive a
// sequence of (restEndsAt, now) states and assert fire/no-fire/once with no React
// and no audio. `prev` is the previous return value (or `undefined` at the first
// observation). We dedupe on the restEndsAt *value*: fire when an armed rest has
// reached its end and this exact restEndsAt hasn't been cued yet, then remember
// it. +30s and pause→resume both mint a *new* restEndsAt, so each re-armed rest
// is allowed to cue again when it lands. Next and pause null out restEndsAt →
// never fires. The first observation adopts the current state without firing (a
// rest already past when we start watching — e.g. a reload after it expired — is
// treated as already-cued so we don't beep for an edge we never saw cross).
export function nextCueState(prev, restEndsAt, now) {
  if (prev === undefined) {
    return { lastCued: restEndsAt != null && now >= restEndsAt ? restEndsAt : null, fire: false }
  }
  const { lastCued } = prev
  const fire = restEndsAt != null && now >= restEndsAt && restEndsAt !== lastCued
  return { lastCued: fire ? restEndsAt : lastCued, fire }
}

// A single shared AudioContext, created lazily. iOS starts it `suspended` and
// only lets a user gesture resume it, so the beep and the unlock (below) must
// share one context. Returns null when the API is absent or construction throws
// — every caller treats null as "no sound", fail-silent.
let audioCtx = null
function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) {
    try {
      audioCtx = new Ctor()
    } catch {
      return null
    }
  }
  return audioCtx
}

// Call from a real user gesture (the set-complete tap that arms the rest) so the
// context is running by the time the rest ends. Fail-silent: no API, no context,
// or a rejected resume() is a no-op.
export function unlockAudio() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch {
    // fail-silent
  }
}

// A short two-tone beep via a Web Audio oscillator (no asset file). Gain is
// ramped, not stepped, so there is no click at start/stop. Fail-silent
// throughout: a suspended/blocked context or any throw produces no sound and no
// error into the workout.
function defaultBeep() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const t0 = ctx.currentTime
    // Two 110ms tones (880Hz then 1175Hz) with a 50ms gap — short, plain, clearly
    // "time's up" rather than a system ping.
    const tones = [
      { freq: 880, start: 0 },
      { freq: 1175, start: 0.16 },
    ]
    for (const { freq, start } of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const s = t0 + start
      gain.gain.setValueAtTime(0.0001, s)
      gain.gain.exponentialRampToValueAtTime(0.2, s + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.11)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(s)
      osc.stop(s + 0.12)
    }
  } catch {
    // fail-silent
  }
}

// A short vibration pattern. Absent on iOS Safari (navigator.vibrate undefined),
// where this simply no-ops and the beep still plays. Fail-silent.
function defaultVibrate() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    navigator.vibrate([120, 60, 120])
  } catch {
    // fail-silent
  }
}

// Rest-end cue (req-31 / DEC-023). Mounted once in the app shell beside
// <WakeLock />. Observes the workout-level rest state (activeWorkout.restEndsAt)
// and, when the live countdown reaches it, fires a beep + a vibration exactly
// once per armed rest. Reads only rest state — never writes it, never touches the
// timer's own state machine.
//
// Fail-silent, always: an unsupported API is a no-op, any throw from audio or
// vibrate is swallowed, and the cue never throws into or disrupts the workout,
// its logging, or its save path.
//
// Renders nothing. Side-effects are injectable so the test can drive the edge
// logic with mocked beep/vibrate.
export function RestEndCue({ beep = defaultBeep, vibrate = defaultVibrate } = {}) {
  const restEndsAt = useStore().activeWorkout?.restEndsAt ?? null
  const [now, setNow] = useState(() => Date.now())
  // undefined = not yet observed. The pure decision's carried state.
  const stateRef = useRef(undefined)

  // Tick only while a rest is armed (restEndsAt set), mirroring useRestCountdown's
  // 250ms cadence. A paused rest has restEndsAt null → no tick and no cue, which
  // is correct: a paused rest is not ending. Re-seeds `now` the moment a rest arms
  // so a freshly-armed rest is evaluated against a current clock, not a stale one.
  useEffect(() => {
    if (restEndsAt == null) return undefined
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [restEndsAt])

  // The edge decision. Runs on mount (seeds without firing) and whenever
  // restEndsAt or the tick changes.
  useEffect(() => {
    const next = nextCueState(stateRef.current, restEndsAt, now)
    stateRef.current = next
    if (next.fire) {
      try {
        beep()
      } catch {
        // fail-silent
      }
      try {
        vibrate()
      } catch {
        // fail-silent
      }
    }
  }, [restEndsAt, now, beep, vibrate])

  return null
}
