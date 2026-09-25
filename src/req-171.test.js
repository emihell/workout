// req-171 — Back returns to the screen you came from. A screen with more than one way
// in is linked with `?from=<path>` (route.js withFrom); its Back goes there, else to its
// fixed parent. A bad `from` is dropped by parseRoute, so Back falls back.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { childLink, findInFromChain, parseRoute, withFrom } from './route.js'
import {
  historyAddSetBack,
  historyDetailBack,
  historyDetailReturn,
  historyExerciseBack,
  historySetBack,
} from './views/history/return-paths.js'

// What a screen's Back renders for a URL: parse it as App.jsx does, then the view helper.
const detailBackFor = (path) => historyDetailBack(parseRoute(path).from)

describe('req-171 AC1 — the workout detail opened from Today returns to Today', () => {
  it('Back target, given from=/, is /', () => {
    const route = parseRoute('/history/wo-1?from=%2F')
    assert.equal(route.name, 'history-detail')
    assert.equal(route.id, 'wo-1')
    assert.equal(route.from, '/')
    assert.equal(detailBackFor('/history/wo-1?from=%2F'), '/')
  })

  it('the links in build that URL: Today, a month list, a finished overview', () => {
    assert.equal(withFrom('/history/wo-1', '/'), '/history/wo-1?from=%2F')
    assert.equal(detailBackFor(withFrom('/history/wo-1', '/history/month/2026-09')), '/history/month/2026-09')
    assert.equal(detailBackFor(withFrom('/history/wo-1', '/workout/rt-a/slot-1/2026-09-24')), '/workout/rt-a/slot-1/2026-09-24')
  })
})

describe('req-171 AC2 — no from keeps the fixed parent', () => {
  it('a reload / shared link / the History list: the detail Backs to /history', () => {
    assert.equal(parseRoute('/history/wo-1').from, undefined)
    assert.equal(detailBackFor('/history/wo-1'), '/history')
  })

  it('one exercise with no from Backs to its workout; a set to its exercise', () => {
    assert.equal(historyExerciseBack('wo-1', parseRoute('/history/wo-1/exercise/it-1').from), '/history/wo-1')
    assert.equal(historySetBack('wo-1', 'it-1', parseRoute('/history/wo-1/set/0').from), '/history/wo-1/exercise/it-1')
  })

  it('a link with no from is the plain path (withFrom / childLink)', () => {
    assert.equal(withFrom('/history/wo-1', null), '/history/wo-1')
    assert.equal(childLink('/history/wo-1/edit', '/history/wo-1', null), '/history/wo-1/edit')
  })
})

describe('req-171 AC3 — a bad from falls back to the fixed parent', () => {
  const shapes = {
    empty: '/history/wo-1?from=',
    'no value': '/history/wo-1?from',
    'not /-prefixed': '/history/wo-1?from=history',
    'off-app absolute URL': `/history/wo-1?from=${encodeURIComponent('https://example.com/')}`,
    'protocol-relative //host': `/history/wo-1?from=${encodeURIComponent('//example.com/x')}`,
    'javascript: URL': `/history/wo-1?from=${encodeURIComponent('javascript:alert(1)')}`,
    undecodable: '/history/wo-1?from=%E0%A4%A',
    'unknown route': `/history/wo-1?from=${encodeURIComponent('/nope/nothing')}`,
  }
  for (const [shape, path] of Object.entries(shapes)) {
    it(`${shape}: dropped, Back → /history`, () => {
      assert.equal(parseRoute(path).from, undefined)
      assert.equal(detailBackFor(path), '/history')
    })
  }

  it('the route itself still parses (the bad from never corrupts the id)', () => {
    for (const path of Object.values(shapes)) {
      assert.deepEqual(parseRoute(path), { name: 'history-detail', id: 'wo-1' })
    }
  })

  it('/ itself (Today) is a valid target — it is the one route with no path parts', () => {
    assert.equal(parseRoute('/history/wo-1?from=%2F').from, '/')
  })
})

describe('req-171 AC4 — the chain unwinds (Today → workout → one exercise → Back → Back)', () => {
  // Each step is the URL the previous screen's link produces; each Back is the URL the
  // screen's Back renders. No history.back(), no stored state (DEC-084).
  const detail = withFrom('/history/wo-1', '/')
  const detailRoute = parseRoute(detail)
  const exercise = childLink('/history/wo-1/exercise/it-1', '/history/wo-1', detailRoute.from)
  const exerciseRoute = parseRoute(exercise)

  it('Back from the exercise lands on the workout still carrying from=/', () => {
    assert.equal(exerciseRoute.name, 'history-workout-exercise')
    assert.equal(historyExerciseBack('wo-1', exerciseRoute.from), detail)
  })

  it('then Back from the workout lands on Today', () => {
    const back1 = historyExerciseBack('wo-1', exerciseRoute.from)
    assert.equal(historyDetailBack(parseRoute(back1).from), '/')
  })

  it('a set opened from that exercise → Back → Back → Back is Today', () => {
    const set = childLink('/history/wo-1/set/0', '/history/wo-1/exercise/it-1', exerciseRoute.from)
    const back1 = historySetBack('wo-1', 'it-1', parseRoute(set).from)
    assert.equal(back1, exercise)
    const back2 = historyExerciseBack('wo-1', parseRoute(back1).from)
    assert.equal(back2, detail)
    assert.equal(historyDetailBack(parseRoute(back2).from), '/')
  })

  it('the recalc after a set change returns to the workout as opened (from=/)', () => {
    const set = childLink('/history/wo-1/set/0', '/history/wo-1/exercise/it-1', exerciseRoute.from)
    const recalc = childLink('/history/wo-1/recalculate', '/history/wo-1/set/0', parseRoute(set).from)
    assert.equal(historyDetailReturn('wo-1', parseRoute(recalc).from), detail)
  })

  it('with no from anywhere, the recalc returns to the plain workout (as before)', () => {
    assert.equal(historyDetailReturn('wo-1', parseRoute('/history/wo-1/recalculate').from), '/history/wo-1')
  })

  it("findInFromChain ignores another workout's detail", () => {
    const other = withFrom('/history/wo-1/set/0', withFrom('/history/wo-2', '/'))
    assert.equal(historyDetailReturn('wo-1', parseRoute(other).from), '/history/wo-1')
    assert.equal(findInFromChain(null, () => true), null)
  })
})

describe('req-171 — one exercise opened from its history list', () => {
  const list = '/history/exercise/ex-bench'
  const exercise = withFrom('/history/wo-1/exercise/ex-bench', list)

  it('Back returns to the exercise history list, not the workout', () => {
    assert.equal(historyExerciseBack('wo-1', parseRoute(exercise).from), list)
  })

  it('Add set from it → Cancel/Back returns to that exercise screen as opened', () => {
    const add = childLink('/history/wo-1/set/new/ex-bench/it-1', '/history/wo-1/exercise/ex-bench', parseRoute(exercise).from)
    assert.equal(historyAddSetBack('wo-1', 'it-1', true, parseRoute(add).from), exercise)
  })
})

describe('req-171 — the add-set form from the workout picker (req-117 targets kept)', () => {
  it('no from: known item → its exercise screen; new item → the workout', () => {
    assert.equal(historyAddSetBack('wo-1', 'it-1', true, null), '/history/wo-1/exercise/it-1')
    assert.equal(historyAddSetBack('wo-1', 'it-9', false, null), '/history/wo-1')
  })

  it('workout opened from Today: the same targets, carrying from=/ up the chain', () => {
    const detail = withFrom('/history/wo-1', '/')
    const picker = childLink('/history/wo-1/set/new', '/history/wo-1', '/')
    const add = childLink('/history/wo-1/set/new/ex-a/it-1', '/history/wo-1/set/new', parseRoute(picker).from)
    const from = parseRoute(add).from
    assert.equal(historyAddSetBack('wo-1', 'it-9', false, from), detail)
    const known = historyAddSetBack('wo-1', 'it-1', true, from)
    assert.equal(known, withFrom('/history/wo-1/exercise/it-1', detail))
    assert.equal(historyExerciseBack('wo-1', parseRoute(known).from), detail)
  })
})

describe('req-171 — exercise detail opened from a Library type list', () => {
  it('parses from on /exercises/:id and the edit link unwinds through it', () => {
    const detail = withFrom('/exercises/ex-1', '/exercises/type/free')
    const route = parseRoute(detail)
    assert.deepEqual(route, { name: 'exercise', id: 'ex-1', from: '/exercises/type/free' })
    const edit = parseRoute(childLink('/exercises/ex-1/edit', '/exercises/ex-1', route.from))
    assert.equal(edit.name, 'exercise-edit')
    assert.equal(edit.from, detail)
  })
})
