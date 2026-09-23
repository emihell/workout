// req-114 (audit G) — the date cases that depend on the process time zone. NOT picked
// up by ./check's `*.test.js` glob on purpose: dates-tz.test.js runs this file in a
// child process once per zone (TZ=Europe/Stockholm, TZ=America/New_York), because the
// zone is fixed when the process starts. Each case builds its clock from LOCAL parts
// (new Date(y, m, d, h, min)), so "00:30 local" means the same thing in every zone.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCurrentWorkout, otherTodayOccurrences } from './current-workout.js'
import {
  clampLoopWeeks,
  dateKey,
  loopWeekIndex,
  mondayOf,
  planDateFor,
  withDefaultAnchor,
} from './schedule.js'

const TZ = process.env.TZ

describe(`req-114 dates under TZ=${TZ}`, () => {
  it('runs in the zone it was asked for', () => {
    // 2026-01-15 12:00 UTC: Stockholm is UTC+1 (-60), New York UTC-5 (+300).
    const offset = new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset()
    const expected = { 'Europe/Stockholm': -60, 'America/New_York': 300 }[TZ]
    assert.ok(expected !== undefined, `unexpected TZ ${TZ}`)
    assert.equal(offset, expected)
  })

  it('UTC: at 00:30 local the preview plan date is today\'s LOCAL date', () => {
    const now = new Date(2026, 8, 23, 0, 30) // Wed 2026-09-23 00:30 local
    assert.equal(planDateFor(null, now), '2026-09-23')
    assert.equal(planDateFor('2026-09-25', now), '2026-09-25') // a route date wins
    if (TZ === 'Europe/Stockholm') {
      // The old expression (overview.jsx:55) — proves the case exercises the bug.
      assert.equal(now.toISOString().slice(0, 10), '2026-09-22')
    }
  })

  it('a date-only string is a local calendar day (dateKey / mondayOf)', () => {
    assert.equal(dateKey('2026-09-21'), '2026-09-21')
    assert.equal(dateKey(mondayOf('2026-09-23')), '2026-09-21')
    assert.equal(dateKey(mondayOf('2026-09-21')), '2026-09-21')
    assert.equal(dateKey(mondayOf('2026-09-27')), '2026-09-21') // Sunday → prior Monday
    // A timestamp still goes through the local clock, unchanged.
    assert.equal(dateKey(new Date(2026, 8, 21, 23, 59).toISOString()), '2026-09-21')
  })

  it('TZ: same anchor and date → same week index (fixed expected values)', () => {
    const schedule = { loopWeeks: 2, anchor: '2026-09-21', slots: [] }
    // Monday 00:30 and Sunday 23:30 local — the edges a UTC parse flips.
    assert.equal(loopWeekIndex(schedule, new Date(2026, 8, 21, 0, 30)), 0)
    assert.equal(loopWeekIndex(schedule, new Date(2026, 8, 27, 23, 30)), 0)
    assert.equal(loopWeekIndex(schedule, new Date(2026, 8, 28, 0, 30)), 1)
    assert.equal(loopWeekIndex(schedule, new Date(2026, 9, 5, 0, 30)), 0)
    const four = { loopWeeks: 4, anchor: '2026-09-21', slots: [] }
    const weeks = [0, 1, 2, 3, 4, 5].map((w) => loopWeekIndex(four, new Date(2026, 8, 21 + 7 * w, 0, 30)))
    assert.deepEqual(weeks, [0, 1, 2, 3, 0, 1])
  })

  it('anchor: an anchor-less schedule, defaulted, cycles over 5 weeks (not all 0)', () => {
    const now = new Date(2026, 8, 23, 10) // Wed
    const imported = { loopWeeks: 2, slots: [] }
    const bare = [0, 1, 2, 3, 4].map((w) => loopWeekIndex(imported, new Date(2026, 8, 23 + 7 * w, 10)))
    assert.deepEqual(bare, [0, 0, 0, 0, 0]) // the measured bug, before the default
    const anchored = withDefaultAnchor(imported, now)
    assert.equal(anchored.anchor, '2026-09-21')
    const weeks = [0, 1, 2, 3, 4].map((w) => loopWeekIndex(anchored, new Date(2026, 8, 23 + 7 * w, 10)))
    assert.deepEqual(weeks, [0, 1, 0, 1, 0])
    // An existing anchor is untouched (same object back).
    const kept = { loopWeeks: 2, anchor: '2026-08-24', slots: [] }
    assert.equal(withDefaultAnchor(kept, now), kept)
  })

  it('clamp: loopWeeks 6 reads as 4', () => {
    assert.equal(clampLoopWeeks(6), 4)
  })

  it('midnight: the one "current" rule (today OR within 6 h)', () => {
    const at = (...parts) => new Date(...parts)
    const wo = (startedAt) => ({ id: 'a', startedAt: startedAt.toISOString() })
    // started Tue 23:50, now Wed 00:05 → current
    assert.equal(isCurrentWorkout(wo(at(2026, 8, 22, 23, 50)), at(2026, 8, 23, 0, 5)), true)
    // started 5 h 59 m ago on the prior day → current
    const now = at(2026, 8, 23, 3, 0)
    assert.equal(isCurrentWorkout(wo(new Date(now.getTime() - (5 * 60 + 59) * 60000)), now), true)
    // 6 h 01 m ago on the prior day → stale
    assert.equal(isCurrentWorkout(wo(new Date(now.getTime() - (6 * 60 + 1) * 60000)), now), false)
    // started yesterday 08:00, now 09:00 → stale
    assert.equal(isCurrentWorkout(wo(at(2026, 8, 22, 8, 0)), at(2026, 8, 23, 9, 0)), false)
    // started today, 10 h ago → current (the "today" half)
    assert.equal(isCurrentWorkout(wo(at(2026, 8, 23, 0, 30)), at(2026, 8, 23, 10, 30)), true)
    assert.equal(isCurrentWorkout(null, now), false)
  })

  it('"other" occurrences are by occurrence id: same routine, today\'s slot, stays listed', () => {
    const tue = { id: 'slot-tue', routineId: 'r' }
    const wed = { id: 'slot-wed', routineId: 'r' }
    const second = { id: 'slot-wed-2', routineId: 'q' }
    const todays = [
      { slot: wed, routine: { id: 'r' } },
      { slot: second, routine: { id: 'q' } },
    ]
    // Tue 23:50 workout of R (occurrence slot-tue@Tue) viewed on Wed: both Wed slots are other.
    const fromTuesday = { routineId: 'r', occurrenceId: `${tue.id}@2026-09-22` }
    assert.deepEqual(otherTodayOccurrences(todays, fromTuesday, '2026-09-23').map((x) => x.slot.id), ['slot-wed', 'slot-wed-2'])
    // Wed's R in progress: only the second routine is other.
    const fromWednesday = { routineId: 'r', occurrenceId: `${wed.id}@2026-09-23` }
    assert.deepEqual(otherTodayOccurrences(todays, fromWednesday, '2026-09-23').map((x) => x.slot.id), ['slot-wed-2'])
  })
})
