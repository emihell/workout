import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dateKey } from './schedule.js'

// req-38 (F-CODE-2) — startWorkout stamped `performedOn` and the default plan `date`
// with the UTC `new Date().toISOString().slice(0,10)`; every other day key in the app
// is local via dateKey (schedule.js), so near midnight for an off-UTC user the record
// landed a day off. The fix swaps both store sites to `dateKey(new Date())`.
//
// The store lives in store.jsx and can't be imported under the project's plain
// `node --test` runner (no JSX transform — that's why no test imports it), so this
// proves the fix two ways it CAN reach: (1) the exact substituted expression is
// local-not-UTC, deterministically, at a real boundary instant; (2) a source guard
// that both store sites now use it and the UTC slice is gone (enforces the grep
// acceptance and fails if either line is reverted).
process.env.TZ = 'Pacific/Kiritimati' // UTC+14, no DST — a stable large offset

const RealDate = Date
const FIXED_UTC = '2026-03-10T20:00:00Z' // 2026-03-10 in UTC, 2026-03-11 local (+14)
const LOCAL_DAY = '2026-03-11'
const UTC_SLICE = '2026-03-10'

describe('req-38 day key is stamped in local time, not UTC', () => {
  before(() => {
    // Pin only the no-arg `new Date()` to the boundary instant; everything else stays
    // real. This makes the local-vs-UTC difference deterministic without a refactor.
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(FIXED_UTC)
        else super(...args)
      }
    }
    FixedDate.now = () => RealDate.now()
    FixedDate.parse = RealDate.parse
    FixedDate.UTC = RealDate.UTC
    globalThis.Date = FixedDate
  })
  after(() => {
    globalThis.Date = RealDate
  })

  it('dateKey(new Date()) is the LOCAL day, and differs from the old UTC slice', () => {
    // The expression the store now uses:
    assert.equal(dateKey(new Date()), LOCAL_DAY)
    // The expression it used before — a different calendar day at this instant:
    assert.equal(new Date().toISOString().slice(0, 10), UTC_SLICE)
    // So the swap is a real behaviour change near a day boundary, not a no-op:
    assert.notEqual(LOCAL_DAY, UTC_SLICE)
    assert.match(dateKey(new Date()), /^\d{4}-\d{2}-\d{2}$/)
  })

  // req-164 — Start's reducer moved to state-reducers.js (startedWorkoutState): the store
  // reads the clock once (`now = new Date()`) and the reducer stamps both day keys from it.
  it('store.jsx stamps both day keys via dateKey(new Date()), with no UTC slice left', () => {
    const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')
    const reducers = readFileSync(fileURLToPath(new URL('./state-reducers.js', import.meta.url)), 'utf8')
    // The acceptance grep, enforced as a test: no UTC day-slice anywhere in either.
    for (const text of [src, reducers]) {
      assert.equal(
        /toISOString\(\)\.slice\(0,\s*10\)/.test(text),
        false,
        'no day key from the UTC toISOString slice',
      )
    }
    // Both sites (plan.date default + performedOn) use the canonical local key of `now`.
    assert.match(src, /const now = new Date\(\)\s*setState\(\(s\) => startedWorkoutState\(s, \{[^}]*\bnow\b[^}]*\}\)\)/)
    const body = reducers.slice(reducers.indexOf('export function startedWorkoutState'), reducers.indexOf('\n}\n', reducers.indexOf('export function startedWorkoutState')))
    const localStamps = body.match(/dateKey\(now\)/g) || []
    assert.equal(localStamps.length, 2, 'expected dateKey(now) at both sites')
    assert.match(reducers, /import\s*\{[^}]*\bdateKey\b[^}]*\}\s*from\s*'\.\/schedule\.js'/)
  })
})

// req-25 / req-78 — the rest-timer bug (a stale timer double-counting after Previous)
// is prevented by removeActiveSet clearing the armed rest when a logged set is undone:
// going back drops restEndsAt/restPausedRemaining, so re-completing arms a fresh timer
// rather than double-counting. req-78 reworks the rest surface but must NOT touch this,
// so lock it as a source guard (store.jsx can't be imported under `node --test`).
describe('req-25 store.removeActiveSet clears the armed rest (no double timer)', () => {
  const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')

  // req-164 — the updater moved to state-reducers.js (activeSetRemovedState); the pin
  // follows it (and state-reducers' behaviour is tested in req-164.test.js).
  it('removeActiveSet resets restEndsAt and restPausedRemaining to null', () => {
    const body = src.match(/removeActiveSet\(index\)\s*\{[\s\S]*?\n {6}\},/)
    assert.ok(body, 'removeActiveSet method not found in store.jsx')
    assert.match(body[0], /setState\(\(s\) => activeSetRemovedState\(s, index\)\)/)
    const reducers = readFileSync(fileURLToPath(new URL('./state-reducers.js', import.meta.url)), 'utf8')
    const reducer = reducers.match(/export function activeSetRemovedState\(s, index\) \{[\s\S]*?\n\}/)
    assert.ok(reducer, 'activeSetRemovedState not found')
    assert.match(reducer[0], /restEndsAt:\s*null/, 'removeActiveSet must clear restEndsAt')
    assert.match(reducer[0], /restPausedRemaining:\s*null/, 'removeActiveSet must clear restPausedRemaining')
  })
})

describe('req-83 store wiring for live seed overrides', () => {
  const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')

  // req-164 — Start's reducer moved to state-reducers.js (startedWorkoutState).
  it('startWorkout seeds an empty seedOverrides map on the new active workout', () => {
    const body = src.match(/startWorkout\([\s\S]*?\n {6}\},/)
    assert.ok(body, 'startWorkout method not found in store.jsx')
    assert.match(body[0], /startedWorkoutState\(s, /)
    const reducers = readFileSync(fileURLToPath(new URL('./state-reducers.js', import.meta.url)), 'utf8')
    const reducer = reducers.match(/export function startedWorkoutState\([\s\S]*?\n\}/)
    assert.ok(reducer, 'startedWorkoutState not found')
    assert.match(reducer[0], /seedOverrides:\s*\{\}/, 'startWorkout must init seedOverrides: {}')
  })

  // req-112 — the finish reducer moved to workout-log.finishedState; the seedOverrides
  // drop is now asserted behaviourally there (finish-routine.test.js). This guard
  // checks the store delegates to it, so that test covers what the store does.
  it('finishWorkout delegates to finishedState (which drops seedOverrides)', () => {
    const body = src.match(/finishWorkout\(args\)\s*\{[\s\S]*?\n {6}\},/)
    assert.ok(body, 'finishWorkout method not found in store.jsx')
    assert.match(body[0], /setState\(\(s\) => finishedState\(s, args\)\)/)
  })
})

// req-112 / DEC-056 — Finish never writes the routine. The only routine write from a
// finished workout is the explicit History recalc (recalculatedState).
describe('req-112 store: no routine write at Finish', () => {
  const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')

  it('store.jsx no longer applies progression anywhere; recalc goes through recalculatedState', () => {
    assert.equal(/applyProgressionToRoutines/.test(src), false)
    const body = src.match(/recalculateFuturePlans\(workoutId\)\s*\{[\s\S]*?\n {6}\},/)
    assert.ok(body, 'recalculateFuturePlans not found in store.jsx')
    assert.match(body[0], /recalculatedState\(s, workoutId\)/)
  })
})
