// req-224 (DEC-125 §4) — a workout left open > 3 h after its last logged set saves that
// set's `loggedAt` as the finish (finishTimeFor), on the Finish screen's Save and on
// auto-complete; the Finish screen and the auto-complete summary use the same time.
// Clocks are built from LOCAL parts (new Date(y, m, d, h, min)), so every case means the
// same thing in any zone (the dates-tz pattern; criterion 7 also runs there, both zones).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { LEFT_OPEN_MS, finishTimeFor, finishedState, lastSetAt } from './workout-log.js'
import { durationLabel } from './history-queries.js'
import { leftOpenText } from './finish-unfinished.js'
import { doneEarlierText } from './views/schedule-day.js'
import { workoutDateKey } from './views/history/helpers.js'
import { act, importJsx, render } from './test-support/render.js'

const at = (h, m = 0, day = 12) => new Date(2026, 9, day, h, m) // Mon 2026-10-12 local
const iso = (h, m, day) => at(h, m, day).toISOString()
const item = { id: 'pi-a', routineItemId: 'pi-a', exerciseId: 'ex-a', exerciseName: 'Squat', sets: 3, targets: ['8', '8', '8'] }
const set = (loggedAt, extra = {}) => ({ routineItemId: 'pi-a', exerciseId: 'ex-a', setType: 'work', weight: 40, reps: '8', rpe: null, note: '', ...(loggedAt ? { loggedAt } : {}), ...extra })
const active = (sets, startedAt = iso(10, 0)) => ({
  id: 'w1',
  routineId: 'r1',
  performedOn: '2026-10-12',
  startedAt,
  finishedAt: null,
  snapshot: { routineName: 'Legs', items: [item] },
  sets,
  completedItemIds: [],
})
// Sets logged 10:00, 10:25, 10:50 (criterion 1's workout).
const morning = () => active([set(iso(10, 0)), set(iso(10, 25)), set(iso(10, 50))])
const finish = (workout, now) => finishedState({ activeWorkout: workout, workouts: [] }, {}, finishTimeFor(workout, now).finishedAt).workouts[0]

describe('req-224 — finishTimeFor', () => {
  it('AC1 + AC5: sets 10:00–10:50, Finish at 15:00 → finishedAt is 10:50\'s loggedAt string; "50 min"', () => {
    const w = morning()
    const t = finishTimeFor(w, at(15, 0))
    assert.equal(t.leftOpen, true)
    assert.equal(t.finishedAt, w.sets[2].loggedAt) // the stored string itself, not a recomputed time
    const saved = finish(w, at(15, 0))
    assert.equal(saved.finishedAt, w.sets[2].loggedAt)
    assert.equal(durationLabel(saved.startedAt, saved.finishedAt), '50 min')
  })

  it('AC1: the latest loggedAt wins whatever the array order', () => {
    const w = active([set(iso(10, 50)), set(iso(10, 0)), set(iso(10, 25))])
    assert.equal(lastSetAt(w), iso(10, 50))
  })

  it('AC2: last set 10:50, Finish at 13:30 (2 h 40) → now', () => {
    const t = finishTimeFor(morning(), at(13, 30))
    assert.equal(t.leftOpen, false)
    assert.equal(t.finishedAt, at(13, 30).toISOString())
    assert.equal(durationLabel(iso(10, 0), finish(morning(), at(13, 30)).finishedAt), '210 min')
  })

  it('AC3: exactly 3 h → now; 3 h + 1 s → the last set', () => {
    const last = at(10, 50).getTime()
    assert.equal(LEFT_OPEN_MS, 3 * 60 * 60 * 1000)
    const exact = finishTimeFor(morning(), last + LEFT_OPEN_MS)
    assert.equal(exact.leftOpen, false)
    assert.equal(exact.finishedAt, new Date(last + LEFT_OPEN_MS).toISOString())
    const over = finishTimeFor(morning(), last + LEFT_OPEN_MS + 1000)
    assert.equal(over.leftOpen, true)
    assert.equal(over.finishedAt, iso(10, 50))
  })

  it('AC4: no set has loggedAt (older sets) → now, no crash', () => {
    const now = at(18, 0)
    for (const w of [active([set(null), set(null)]), active([]), { id: 'x' }, null, undefined]) {
      assert.equal(lastSetAt(w), null)
      const t = finishTimeFor(w, now)
      assert.equal(t.leftOpen, false)
      assert.equal(t.finishedAt, now.toISOString())
    }
    // an unreadable loggedAt is not a time either
    assert.equal(lastSetAt(active([set('not a date'), set('')])), null)
  })

  it('AC4: skipped sets Finish makes never count as the last set', () => {
    // Only one set logged (10:00); Finish at 12:00 adds two skipped sets. They carry no
    // loggedAt, so the last set stays 10:00 and 2 h < 3 h → now.
    const w = active([set(iso(10, 0))])
    const saved = finish(w, at(12, 0))
    assert.equal(saved.sets.length, 3)
    assert.equal(saved.sets.filter((s) => s.reps === 'skipped').length, 2)
    assert.equal(saved.sets.filter((s) => s.loggedAt).length, 1, 'Finish-made skips have no loggedAt')
    assert.equal(lastSetAt(saved), iso(10, 0))
    assert.equal(saved.finishedAt, at(12, 0).toISOString())
    // A workout whose only sets are Finish-style skips (Skip exercise) → now.
    const onlySkips = active([set(null, { reps: 'skipped', weight: 0, note: 'skipped' })])
    assert.equal(finishTimeFor(onlySkips, at(20, 0)).finishedAt, at(20, 0).toISOString())
  })

  it('finishedState\'s own default is still now (every other caller)', () => {
    const before = Date.now()
    const saved = finishedState({ activeWorkout: morning(), workouts: [] }).workouts[0]
    const ms = Date.parse(saved.finishedAt)
    assert.equal(ms >= before && ms <= Date.now(), true)
  })

  it('AC7: started Mon 18:00, last set Mon 19:00, finished Tue 08:00 → finishedAt Mon 19:00; History day and "Done Mon" read Monday', () => {
    const w = active([set(iso(18, 0)), set(iso(19, 0))], iso(18, 0))
    const saved = finish(w, at(8, 0, 13)) // Tue 2026-10-13 08:00 local
    assert.equal(saved.finishedAt, iso(19, 0))
    assert.equal(workoutDateKey(saved), '2026-10-12')
    assert.equal(doneEarlierText(saved), 'Done Mon ✓')
    // Without the rule the same finish would read Tuesday — the case exercises the change.
    assert.equal(doneEarlierText({ ...saved, finishedAt: at(8, 0, 13).toISOString() }), 'Done Tue ✓')
  })
})

describe('req-224 — leftOpenText', () => {
  it('today → HH:MM only; another day → HH:MM on that day', () => {
    assert.equal(leftOpenText(iso(10, 50), at(15, 0)), 'You left this workout open — saved as finished at 10:50, your last set.')
    const other = leftOpenText(iso(19, 5), at(8, 0, 13))
    assert.match(other, /^You left this workout open — saved as finished at 19:05 on .+, your last set\.$/)
    assert.equal(other.includes('Mon'), true)
    assert.equal(leftOpenText('nope', at(8, 0)), '')
  })
})

// Rendered: the Finish screen and the auto-complete summary, against the real store.
const h = React.createElement
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
let view
afterEach(async () => {
  await view?.unmount()
  view = null
})

const MIN = 60000
// The workout started `startAgo` ms ago with sets logged from then until `lastAgo` ms ago.
async function finishScreen({ startAgo, lastAgo }) {
  localStorage.clear()
  localStorage.setItem('workout-mvp-v8', JSON.stringify({ ...fixture(), activeWorkout: null }))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const { useStore } = await import('./store-context.js')
  const { WorkoutFinish } = await importJsx('./views/workout/finish.jsx', import.meta.url)
  const captured = {}
  function Grab() {
    // A test harness reading the live store out of the tree (as req-176.test.js); one
    // StoreProvider for the whole test (L-051). Finish mounts once the sets are in.
    // oxlint-disable-next-line react/immutability
    captured.store = useStore()
    return captured.store.activeWorkout?.sets?.length ? h(WorkoutFinish, { routineId: 'sess-lower' }) : null
  }
  view = await render(h(StoreProvider, null, h(Grab)))
  await act(async () => captured.store.startWorkout('sess-lower'))
  const first = captured.store.activeWorkout.snapshot.items[0]
  const now = Date.now()
  const logged = (ago) => ({ routineItemId: first.routineItemId || first.id, exerciseId: first.exerciseId, setType: 'work', weight: 20, reps: '10', rpe: null, note: '', loggedAt: new Date(now - ago).toISOString() })
  const sets = [logged(startAgo), logged(lastAgo)]
  await act(async () => captured.store.patchActive({ startedAt: new Date(now - startAgo).toISOString(), sets }))
  return { captured, sets }
}

describe('req-224 — the Finish screen', () => {
  it('AC6: left open (50 min of sets, last one 4 h 10 ago) → "50 min", the line, and Save stores the last set\'s time', async () => {
    const { captured, sets } = await finishScreen({ startAgo: 300 * MIN, lastAgo: 250 * MIN })
    const text = view.text()
    assert.equal(text.includes('— 50 min ·'), true, text)
    assert.equal(text.includes(leftOpenText(sets[1].loggedAt)), true, text)
    assert.equal(text.includes('You left this workout open'), true)
    await view.click(view.button('Save'))
    assert.equal(captured.store.activeWorkout, null)
    assert.equal(captured.store.workouts[0].finishedAt, sets[1].loggedAt)
  })

  it('AC6: not left open (last set 2 h 40 ago) → no line, minutes to now, Save stores now', async () => {
    const { captured, sets } = await finishScreen({ startAgo: 210 * MIN, lastAgo: 160 * MIN })
    const text = view.text()
    assert.equal(text.includes('You left this workout open'), false)
    assert.equal(text.includes('— 210 min ·'), true, text)
    const before = Date.now()
    await view.click(view.button('Save'))
    const saved = captured.store.workouts[0]
    assert.equal(saved.finishedAt === sets[1].loggedAt, false)
    assert.equal(Date.parse(saved.finishedAt) >= before, true)
  })
})

describe('req-224 — the auto-complete summary', () => {
  it('Scope 4: duration uses the same finish time; its Finish saves the last set\'s time', async () => {
    const { captured, sets } = await finishScreen({ startAgo: 300 * MIN, lastAgo: 250 * MIN })
    const { AutoCompleteSummary } = await importJsx('./views/workout/auto-complete.jsx', import.meta.url)
    const store = captured.store
    const summary = await render(h(AutoCompleteSummary, { routineId: 'sess-lower', active: store.activeWorkout, store, onCancel: () => {}, countdown: false }))
    try {
      const text = summary.text()
      assert.equal(/Duration50 min/.test(text), true, text)
      await summary.click(summary.button('Finish'))
      assert.equal(captured.store.workouts[0].finishedAt, sets[1].loggedAt)
    } finally {
      await summary.unmount()
    }
  })
})
