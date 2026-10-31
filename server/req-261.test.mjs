// req-261 AC4 — `plan build` C4 refuses Sets above MAX_SETS (20), the app's ceiling, and says so.
// Pure: buildPlan on an in-memory state, no data dir.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fullState } from '../src/test-support/full-state.js'
import { MAX_SETS } from '../src/routine-item-parse.js'
import { buildPlan } from './plan-build.mjs'

const LIBRARY = JSON.parse(readFileSync(new URL('../src/library/exercises.json', import.meta.url), 'utf8'))
const build = (n) =>
  buildPlan(
    { ...fullState(), activeWorkout: null },
    {
      kind: 'workout-plan-changes',
      version: 1,
      changes: [{ op: 'item.set', routine: 'Upper', exercise: 'Chest Press', set: { sets: n, targets: Array(n).fill('10'), suggestedWeights: Array(n).fill(20) } }],
    },
    { library: LIBRARY, makeId: (p) => `${p}-t`, now: '2026-10-31T12:00:00.000Z' },
  )

test('AC4 — plan build: sets 20 builds; sets 21 is refused by C4, naming 20', () => {
  assert.equal(MAX_SETS, 20)
  const ok = build(20)
  assert.deepEqual(ok.refusals, [])
  assert.ok(ok.file, 'a plan file for 20 sets')
  const over = build(21)
  assert.equal(over.file, null)
  assert.equal(over.refusals.length, 1, over.refusals.join('\n'))
  assert.match(over.refusals[0], /sets must be a whole number from 1 to 20 \(got 21\)/)
})
