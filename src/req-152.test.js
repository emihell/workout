// req-152 — four fixes from Planner's browser run (QA-1..4). QA-2 (rest pill vs the top
// row) is CSS and measured in the browser (reports/req-152.md), plus a source guard here.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { historyHasSetAt, historySetPrefill } from './storage.js'
import { carryForSet, initialSetFields, withOneMoreSet } from './workout-log.js'
import { historyGroupMeta } from './views/history/helpers.js'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// ---- QA-1 / DEC-081 — the exits to Today replace ----
// req-153 — the behaviour tests (go's replace, the Finish/Abandon exits via
// leaveWorkoutToToday, the visit stack) moved to req-153.test.js, against a fake browser
// history. This guard STAYS as a source check, because it pins which function three .jsx
// screens call, and `node --test` can't load .jsx to exercise them; what the function
// does is behaviour-tested there.
describe('the three ways out of a workout to Today use leaveWorkoutToToday (QA-1)', () => {
  it('finish Save, auto-complete commit and abandon call it right after the store write', () => {
    // req-153 review — pin the ORDER too: the exit follows finishWorkout / abandonWorkout.
    assert.match(read('./views/workout/finish.jsx'), /store\.finishWorkout\([^)]*\)\s*\n\s*leaveWorkoutToToday\(\)/)
    assert.match(read('./views/workout/auto-complete.jsx'), /store\.finishWorkout\(autoFinishArgs[^\n]*\n\s*leaveWorkoutToToday\(\)/)
    assert.match(read('./views/workout/workout-helpers.js'), /store\.abandonWorkout\(\)\n\s*leaveWorkoutToToday\(\)/)
  })
})

// ---- QA-3 — Add set on a done exercise prefills the kg just logged ----
// The seed chain item.jsx runs, driven with the Leg Press repro: last time 4 working
// sets, today logged 30/60/70/70, then Add set → the 5th set (work index 4).
describe('Add set prefill (QA-3)', () => {
  const lastTime = {
    sets: [30, 60, 70, 70].map((weight) => ({ setType: 'work', weight, reps: 10, exerciseId: 'lp' })),
  }
  const today = [30, 60, 70, 70].map((weight) => ({ setType: 'work', weight, reps: 10, exerciseId: 'lp' }))
  const seedAt = ({ weighted = true, last = lastTime, logged = today, item }) => {
    const at = { setType: 'work', workIndex: 4 }
    return initialSetFields({
      weighted,
      fromRestore: false,
      restore: null,
      hasHistory: Boolean(last),
      historyHasSet: historyHasSetAt(last, at),
      history: historySetPrefill(last, at),
      carry: carryForSet('work', logged),
      target: item.targets[4],
    })
  }
  const item = withOneMoreSet({ exerciseId: 'lp', sets: 4, targets: [10, 10, 10, 10], suggestedWeights: [30, 60, 70, 70] })

  it('done at [30,60,70,70] → Add set → kg 70, reps = its appended target', () => {
    assert.equal(item.sets, 5)
    const seed = seedAt({ item })
    assert.equal(seed.weight, '70')
    assert.equal(seed.reps, 10)
  })

  it('a set history DOES have keeps its history kg (carry ignored — unchanged)', () => {
    const at = { setType: 'work', workIndex: 1 }
    const seed = initialSetFields({
      weighted: true, fromRestore: false, restore: null, hasHistory: true,
      historyHasSet: historyHasSetAt(lastTime, at), history: historySetPrefill(lastTime, at),
      carry: carryForSet('work', [{ setType: 'work', weight: 99 }]), target: 10,
    })
    assert.equal(seed.weight, '60')
  })

  it('failure case: bodyweight, no weight history → kg stays blank (nothing invented)', () => {
    const bw = withOneMoreSet({ exerciseId: 'pu', sets: 3, targets: [8, 8, 8], suggestedWeights: [] })
    const logged = [0, 0, 0].map(() => ({ setType: 'work', weight: 0, reps: 8 }))
    assert.equal(seedAt({ weighted: false, last: null, logged, item: bw }).weight, '')
    // …and weighted-but-no-kg-anywhere (logged at 0) is blank too, never the suggestion.
    assert.equal(seedAt({ weighted: true, last: null, logged, item: bw }).weight, '')
  })

  it('historyHasSetAt: index within / beyond last time, warm-up, no history', () => {
    assert.equal(historyHasSetAt(lastTime, { setType: 'work', workIndex: 3 }), true)
    assert.equal(historyHasSetAt(lastTime, { setType: 'work', workIndex: 4 }), false)
    assert.equal(historyHasSetAt(lastTime, { setType: 'wu', workIndex: 0 }), false)
    assert.equal(historyHasSetAt(null, { setType: 'work', workIndex: 0 }), false)
  })
})

// ---- QA-4 — History detail says "skipped" ----
describe('History detail exercise meta (QA-4)', () => {
  // req-153 review — a source pin that stays: detail.jsx is .jsx (node can't load it), and
  // this is the only link between the screen and the behaviour-tested historyGroupRowMeta.
  it('detail.jsx renders each row through historyGroupRowMeta', () => {
    assert.match(read('./views/history/detail.jsx'), /historyGroupRowMeta\(snapshotItem, group\.items\)/)
  })
  it('all sets skipped → "· skipped" (the overview word), no count', () => {
    assert.equal(historyGroupMeta({ role: 'main', warmup: true }, 0, { skipped: true }), 'Warm-up set · skipped')
  })
  it('2 of 4 skipped → the logged count, no "skipped"', () => {
    const meta = historyGroupMeta({ role: 'main' }, 2, { skipped: false })
    assert.equal(meta, '2 sets')
    assert.doesNotMatch(meta, /skipped/)
  })
})

// ---- QA-2 — every screen that hosts the rest pill reserves its footprint ----
// req-153 — these two STAY as source guards: the overlap is layout, and node has no
// layout engine (no rects to compare). The rects are measured in the browser at 320 /
// 375 / 430px (reports/req-152.md); these only stop the class or the CSS silently going.
describe('rest pill clears the top row (QA-2 source guard; rects measured in the browser)', () => {
  it('each <Screen> rendering <RestPill /> carries ui-screen--rest', () => {
    for (const rel of ['./views/workout/item.jsx', './views/workout/overview.jsx', './views/workout/finish.jsx']) {
      const lines = read(rel).split('\n')
      lines.forEach((line, i) => {
        if (line.trim() !== '<RestPill />') return
        let j = i
        while (!lines[j].includes('<Screen')) j -= 1
        assert.match(lines[j], /className="ui-screen--rest"/, `${rel}:${j + 1}`)
      })
    }
  })
  it('the pill stays one line and the reserve uses its height', () => {
    const css = read('./ui/ui.css')
    assert.match(css, /\.ui-restpill \{[^}]*white-space: nowrap;/)
    assert.match(css, /\.ui-screen--rest \{\s*padding-top: calc\(var\(--ui-s2\) \+ var\(--ui-restpill-h\) \+ var\(--ui-s2\)\);/)
  })
})
