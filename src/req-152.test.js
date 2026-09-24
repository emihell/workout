// req-152 — four fixes from Planner's browser run (QA-1..4). QA-2 (rest pill vs the top
// row) is CSS and measured in the browser (reports/req-152.md), plus a source guard here.
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { go } from './route.js'
import { historyHasSetAt, historySetPrefill } from './storage.js'
import { carryForSet, initialSetFields, withOneMoreSet } from './workout-log.js'
import { historyGroupMeta } from './views/history/helpers.js'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// ---- QA-1 / DEC-081 — go(p, { replace: true }) replaces the browser entry ----
describe('go — replace is real (QA-1)', () => {
  const previousWindow = globalThis.window
  let calls
  beforeEach(() => {
    calls = []
    let hash = '#/workout/r1/finish'
    globalThis.window = {
      location: {
        get hash() {
          return hash
        },
        set hash(value) {
          calls.push(['assign', value])
          hash = value
        },
        get href() {
          return `http://localhost:5173/workout/?x=1${hash}`
        },
        replace(url) {
          calls.push(['replace', url])
          hash = url.slice(url.indexOf('#'))
        },
      },
    }
  })
  afterEach(() => {
    globalThis.window = previousWindow
  })

  it('replace: true → location.replace with the same URL and the new hash; no hash assignment', () => {
    go('/', { replace: true })
    assert.deepEqual(calls, [['replace', 'http://localhost:5173/workout/?x=1#/']])
  })

  it('without replace → still pushes (hash assignment)', () => {
    go('/history')
    assert.deepEqual(calls, [['assign', '#/history']])
  })

  it('replace still updates the in-app visit stack (sessionStorage-backed; top is the new path)', () => {
    const store = new Map()
    globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
    try {
      go('/workout/r1', { replace: false })
      go('/', { replace: true })
      const stack = JSON.parse(store.get('workout-mvp-nav-2'))
      assert.equal(stack.at(-1), '/')
      assert.ok(!stack.includes('/workout/r1/finish'))
    } finally {
      delete globalThis.sessionStorage
    }
  })

  it('the three ways out of a workout to Today replace (finish Save, auto-complete, abandon)', () => {
    assert.match(read('./views/workout/finish.jsx'), /store\.finishWorkout\([^)]*\)\s*\n\s*go\('\/', \{ replace: true \}\)/)
    assert.match(read('./views/workout/auto-complete.jsx'), /store\.finishWorkout\(autoFinishArgs[^\n]*\n\s*go\('\/', \{ replace: true \}\)/)
    assert.match(read('./views/workout/helpers.jsx'), /store\.abandonWorkout\(\)\n\s*go\('\/', \{ replace: true \}\)/)
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
  it('all sets skipped → "· skipped" (the overview word), no count', () => {
    assert.equal(historyGroupMeta({ role: 'main', warmup: true }, 0, { skipped: true }), 'WU set · skipped')
  })
  it('2 of 4 skipped → the logged count, no "skipped"', () => {
    const meta = historyGroupMeta({ role: 'main' }, 2, { skipped: false })
    assert.equal(meta, '2 sets')
    assert.doesNotMatch(meta, /skipped/)
  })
  it('detail.jsx counts logged (non-skipped) sets and flags all-skipped', () => {
    const src = read('./views/history/detail.jsx')
    assert.match(src, /group\.items\.filter\(\(\{ s \}\) => !isSkippedSet\(s\)\)\.length/)
    assert.match(src, /historyGroupMeta\(snapshotItem, logged, \{ skipped \}\)/)
  })
})

// ---- QA-2 — every screen that hosts the rest pill reserves its footprint ----
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
