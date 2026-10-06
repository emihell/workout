// req-195 / DEC-108 §5 — doneInTodayBlock: which of today's finished workouts today's
// block lists as "· Done ✓" rows (a slot already showing Done is not repeated).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doneInTodayBlock } from './history-queries.js'

const TODAY = '2026-10-06'
const slotA = { id: 'slot-a' }
const routineA = { id: 'r-a', name: 'Upper' }
const at = (h) => new Date(2026, 9, 6, h, 0, 0).toISOString()

test('an unscheduled workout finished today is listed', () => {
  const w = { id: 'w1', routineId: 'r-b', finishedAt: at(9) }
  assert.deepEqual(doneInTodayBlock([w], [], TODAY).map((x) => x.id), ['w1'])
})

test('a workout covering a rendered slot today is not listed again', () => {
  const covered = { id: 'w1', routineId: 'r-a', scheduleSlotId: 'slot-a', scheduledFor: TODAY, finishedAt: at(9) }
  const extra = { id: 'w2', routineId: 'r-b', finishedAt: at(11) }
  assert.deepEqual(
    doneInTodayBlock([covered, extra], [{ slot: slotA, routine: routineA }], TODAY).map((x) => x.id),
    ['w2'],
  )
})

test('two done today are both listed, oldest-finished first', () => {
  const ws = [
    { id: 'late', routineId: 'r-b', finishedAt: at(18) },
    { id: 'early', routineId: 'r-c', finishedAt: at(8) },
  ]
  assert.deepEqual(doneInTodayBlock(ws, [], TODAY).map((x) => x.id), ['early', 'late'])
})

test('nothing finished today → nothing listed (prior days and in-progress excluded)', () => {
  const ws = [
    { id: 'old', routineId: 'r-b', finishedAt: new Date(2026, 9, 5, 9).toISOString() },
    { id: 'open', routineId: 'r-b', startedAt: at(9) },
  ]
  assert.deepEqual(doneInTodayBlock(ws, [{ slot: slotA, routine: routineA }], TODAY), [])
  assert.deepEqual(doneInTodayBlock(undefined, undefined, TODAY), [])
})
