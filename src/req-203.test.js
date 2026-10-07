// req-203 — Lena run 3 fixes. Pure decisions (views/schedule-day.js, topSetText,
// workoutPillState) are tested directly; the screens render as the whole App under
// happy-dom (test-support/render.js), as in req-200.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { addDays, dateKey, mondayOf } from './schedule.js'
import { withFrom } from './route.js'
import { workoutPillState } from './workout-log.js'
import { topSetText } from './views/history/helpers.js'
import {
  dayEveryText,
  doneOnDay,
  homeDayDate,
  longWeekdayDate,
  removeSlotText,
  startNowShown,
} from './views/schedule-day.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

// ── §1 pure: the day screen's date, its done rows, Start now ─────────────────────────
const ONE_WEEK = { loopWeeks: 1, anchor: '2026-08-24', slots: [] }
// anchor Mon 2026-10-12 = loop week 0; so the week of Mon 10-05 is loop week 1 (week 2 of 2)
const TWO_WEEK = { loopWeeks: 2, anchor: '2026-10-12', slots: [] }
const WED = new Date(2026, 9, 7, 12) // Wed 2026-10-07

describe('§1 homeDayDate — a day screen from Home is a date', () => {
  it('from "/" → that weekday of now\'s Mon–Sun week (Sunday is the week\'s last day)', () => {
    assert.equal(homeDayDate(ONE_WEEK, 0, 1, '/', WED), '2026-10-05') // Monday, past
    assert.equal(homeDayDate(ONE_WEEK, 0, 3, '/', WED), '2026-10-07') // today
    assert.equal(homeDayDate(ONE_WEEK, 0, 0, '/', WED), '2026-10-11') // Sunday, ahead
  })
  it('entered any other way (Whole plan, no from) → no date', () => {
    assert.equal(homeDayDate(ONE_WEEK, 0, 3, null, WED), null)
    assert.equal(homeDayDate(ONE_WEEK, 0, 3, '/schedule', WED), null)
  })
  it('2-week loop: only the loop week that IS this calendar week gets a date', () => {
    assert.equal(homeDayDate(TWO_WEEK, 1, 6, '/', WED), '2026-10-10')
    assert.equal(homeDayDate(TWO_WEEK, 0, 6, '/', WED), null, 'week 1\'s Saturday is not in this calendar week')
  })
})

describe('§1 doneOnDay — by finish date, like weekRows', () => {
  it('every workout finished that date, oldest first; unfinished and other days excluded; none with no date', () => {
    const workouts = [
      { id: 'late', routineId: 'Z', finishedAt: new Date(2026, 9, 7, 19).toISOString(), scheduleSlotId: 'gone' },
      { id: 'early', routineId: 'A', finishedAt: new Date(2026, 9, 7, 8).toISOString() },
      { id: 'other-day', routineId: 'A', finishedAt: new Date(2026, 9, 6, 8).toISOString() },
      { id: 'live', routineId: 'A', startedAt: new Date(2026, 9, 7, 9).toISOString() },
    ]
    assert.deepEqual(doneOnDay(workouts, '2026-10-07').map((w) => w.id), ['early', 'late'])
    assert.deepEqual(doneOnDay(workouts, null), [])
  })
})

describe('§1 startNowShown — never on a past date', () => {
  const finishedToday = [{ id: 'w', routineId: 'A', finishedAt: new Date(2026, 9, 7, 9).toISOString() }]
  const base = { workouts: [], routineId: 'A', slotId: 's-a', todayKey: '2026-10-07' }
  it('past date → no; future date → yes; no date (the loop day) → yes, as before', () => {
    assert.equal(startNowShown({ ...base, date: '2026-10-05' }), false)
    assert.equal(startNowShown({ ...base, date: '2026-10-09' }), true)
    assert.equal(startNowShown({ ...base, date: null }), true)
  })
  it('today → yes until a workout finished today covers the slot', () => {
    assert.equal(startNowShown({ ...base, date: '2026-10-07' }), true)
    assert.equal(startNowShown({ ...base, workouts: finishedToday, date: '2026-10-07' }), false)
    // a different routine finished today does not cover this slot
    assert.equal(startNowShown({ ...base, workouts: [{ ...finishedToday[0], routineId: 'B' }], date: '2026-10-07' }), true)
  })
})

// ── §3 pure: copy ─────────────────────────────────────────────────────────────────
describe('§3 the loop line and the Remove confirm', () => {
  it('"Every Wednesday" / "Every Wednesday in week 2 of 2"', () => {
    assert.equal(dayEveryText(3, 0, 1), 'Every Wednesday')
    assert.equal(dayEveryText(3, 1, 2), 'Every Wednesday in week 2 of 2')
  })
  it('"Take Upper Body off Wednesdays? Your history is kept." (+ "in week N" in a longer loop)', () => {
    assert.equal(removeSlotText('Upper Body', 3, 0, 1), 'Take Upper Body off Wednesdays? Your history is kept.')
    assert.equal(removeSlotText('Upper Body', 6, 1, 2), 'Take Upper Body off Saturdays in week 2? Your history is kept.')
  })
  it('the dated title reads "Wednesday, Oct 7"', () => {
    assert.equal(longWeekdayDate('2026-10-07', WED), 'Wednesday, Oct 7')
  })
})

// ── §5 pure: the By-exercise top set ────────────────────────────────────────────────
describe('§5 topSetText — the heaviest working set', () => {
  const s = (weight, reps, extra = {}) => ({ exerciseId: 'ex', setType: 'work', weight, reps, ...extra })
  it('AC4: 20×12, 25×10, 25×8 → "25 kg × 10" (a kg tie goes to the most reps)', () => {
    assert.equal(topSetText([s(20, '12'), s(25, '10'), s(25, '8')], 'ex'), '25 kg × 10')
  })
  it('warm-ups, skipped sets and other exercises are not the top set', () => {
    const sets = [s(40, '5', { setType: 'wu' }), s(50, 'skipped'), s(99, '1', { exerciseId: 'other' }), s(22.5, '9')]
    assert.equal(topSetText(sets, 'ex'), '22.5 kg × 9')
  })
  it('no kg (bodyweight, cardio, all skipped) → null; no reps → kg alone', () => {
    assert.equal(topSetText([s('', '12'), s(0, '10'), s(null, '8')], 'ex'), null)
    assert.equal(topSetText([], 'ex'), null)
    assert.equal(topSetText([s(30, '')], 'ex'), '30 kg')
  })
})

// ── §7 pure: the pill after the last set ───────────────────────────────────────────
describe('§7 the workout pill after an exercise is done', () => {
  const item = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, sets: 3, targets: ['8', '8', '8'] })
  const set = (id) => ({ routineItemId: id, exerciseId: `ex-${id}`, setType: 'work', weight: 20, reps: '8' })
  const items = [item('a'), item('b')]
  const now = 1_000_000
  it('AC6: after A\'s last set the pill moves to B with no set count (no "set 1/")', () => {
    const w = { routineId: 'r', snapshot: { items }, sets: [set('a'), set('a'), set('a')], completedItemIds: [], restEndsAt: now + 90_000 }
    const pill = workoutPillState(w, now)
    assert.equal(pill.item.routineItemId, 'b')
    assert.equal(pill.setText, '')
    assert.equal(pill.label, '1:30')
    assert.doesNotMatch(pill.label, /set 1\//)
    assert.equal(workoutPillState({ ...w, restEndsAt: now - 1 }, now).label, 'GO')
  })
  it('the count returns with B\'s first logged set; mid-exercise is unchanged ("set 2/3")', () => {
    const w = { routineId: 'r', snapshot: { items }, sets: [set('a'), set('a'), set('a'), set('b')], completedItemIds: [] }
    assert.equal(workoutPillState(w, now).label, 'GO · set 2/3')
    const mid = { routineId: 'r', snapshot: { items }, sets: [set('a')], completedItemIds: [] }
    assert.equal(workoutPillState(mid, now).label, 'GO · set 2/3')
  })
})

// ── Screens (the whole App) ─────────────────────────────────────────────────────────
const seed = JSON.parse(read('db.json'))
const NOW = new Date()
const TODAY = dateKey(NOW)
const TODAY_WD = NOW.getDay()

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

async function open(hash, data = seed) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const squash = (text) => text.replace(/\s+/g, '')
const link = (text) => view.all('a').find((a) => squash(a.textContent) === squash(text)) ?? null
const buttons = (label) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === label)
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
async function tap(node) {
  await view.click(node)
  await flush()
}

// Upper Body scheduled on today's weekday, and finished today (untagged, as Start now
// starts it) — the Lena s33 shape.
function doneTodayData() {
  const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 0, 30).toISOString()
  const w = { ...seed.workouts[0], id: 'w-today', routineId: 'sess-upper', finishedAt: at, startedAt: at, performedOn: TODAY, scheduleSlotId: null, scheduledFor: null, occurrenceId: null }
  return {
    ...seed,
    schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [{ id: 's-today', week: 0, weekday: TODAY_WD, routineId: 'sess-upper' }] },
    workouts: [...seed.workouts, w],
  }
}

describe('§1 the day screen from Home', () => {
  it('AC1: today, finished → "Upper Body · Done ✓ ›" first, no Start now; tap → History detail; Back → the day', async () => {
    // req-204 test edit: Home has no "This week" row for today any more (DEC-113), so the
    // test opens the same link that row had (`/schedule/0/<today>?from=/`) directly; the
    // screen still dates it today through the no-`?date=` fallback. Assertions unchanged.
    await open(`/schedule/0/${TODAY_WD}?from=%2F`, doneTodayData())
    assert.equal(view.container.querySelector('.ui-title')?.textContent, longWeekdayDate(TODAY, NOW))
    const done = link('Upper Body · Done ✓ ›')
    assert.ok(done, 'the done row')
    assert.ok(done.compareDocumentPosition(view.all('button').find((b) => b.textContent === 'Remove')) & 4, 'above the slots')
    assert.equal(buttons('Start now').length, 0)
    const dayPath = withFrom(`/schedule/0/${TODAY_WD}`, '/')
    assert.equal(done.getAttribute('href'), `#${withFrom('/history/w-today', dayPath)}`)
    await tap(done)
    assert.equal(window.location.hash, `#${withFrom('/history/w-today', dayPath)}`)
    const back = link('‹ Back')
    assert.equal(back.getAttribute('href'), `#${dayPath}`)
    await tap(back)
    assert.equal(window.location.hash, `#${dayPath}`)
  })

  it('today, not finished → Start now still shows (today\'s Start also stays on Home)', async () => {
    const data = doneTodayData()
    await open(`/schedule/0/${TODAY_WD}?from=%2F`, { ...data, workouts: seed.workouts })
    assert.equal(buttons('Start now').length, 1)
  })

  it('AC3: a future date starts (activeWorkout.routineId); a past date has no Start now', async () => {
    const slots = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ id: `s-${weekday}`, week: 0, weekday, routineId: 'sess-lower' }))
    const data = { ...seed, workouts: [], schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots } }
    const week = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(NOW), i))
    const past = week.filter((d) => dateKey(d) < TODAY)
    for (const d of past) {
      await open(`/schedule/0/${d.getDay()}?from=%2F`, data)
      assert.equal(buttons('Start now').length, 0, `no Start now on ${dateKey(d)}`)
      await view.unmount()
      view = null
    }
    // Sunday is today or later on any day
    await open('/schedule/0/0?from=%2F', data)
    await tap(buttons('Start now')[0])
    assert.equal(stored().activeWorkout?.routineId, 'sess-lower')
  })

  it('AC3: Remove on a 2-week-loop day says what it does and leaves the other week\'s slot', async () => {
    const schedule = {
      loopWeeks: 2,
      anchor: '2026-08-24',
      slots: [
        { id: 'slot-w1-sat', week: 0, weekday: 6, routineId: 'sess-upper' },
        { id: 'slot-w2-sat', week: 1, weekday: 6, routineId: 'sess-lower' },
      ],
    }
    await open('/schedule/1/6?from=%2F', { ...seed, schedule })
    assert.equal(view.container.querySelector('.ui-title + .ui-sub')?.textContent, 'Every Saturday in week 2 of 2')
    await tap(buttons('Remove')[0])
    assert.match(document.body.textContent, /Take Lower Body off Saturdays in week 2\? Your history is kept\./)
    await tap(buttons('Remove').at(-1))
    assert.deepEqual(stored().schedule.slots.map((s) => s.id), ['slot-w1-sat'])
  })
})

describe('§2 Home\'s done line links', () => {
  it('AC2: "Done ✓ — see your sets ›" → the History detail ?from=/; Back → Home', async () => {
    const data = doneTodayData()
    // tagged to today's slot, as Home's Start tags it
    data.workouts.at(-1).scheduleSlotId = 's-today'
    data.workouts.at(-1).scheduledFor = TODAY
    await open('/', data)
    const done = link('Done ✓ — see your sets ›')
    assert.ok(done && view.container.querySelector('.ui-today-workout').contains(done), 'in today\'s block')
    assert.equal(done.getAttribute('href'), '#/history/w-today?from=%2F')
    await tap(done)
    assert.equal(link('‹ Back')?.getAttribute('href'), '#/')
  })
})

describe('§4 Backup & data is plain', () => {
  it('the line, "Back up now", "Restore from a backup"; after the download "Backup saved — <file>"', async () => {
    const saved = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => {}
    const clicks = []
    const anchorClick = window.HTMLAnchorElement.prototype.click
    window.HTMLAnchorElement.prototype.click = function () {
      if (this.download) clicks.push(this.download)
      else anchorClick.call(this)
    }
    try {
      await open('/settings')
      const text = view.text()
      // req-203 copy fix (Planner): the line names the button ("Restore from a backup"), was "Open it with Import to restore."
      assert.match(text, /Saves all your workouts and history to a file on this device\. Use Restore from a backup to bring it back\./)
      assert.ok(text.indexOf('Saves all') < text.indexOf('Back up now'), 'the line sits above the button')
      assert.ok(view.all('label').some((l) => l.textContent.trim() === 'Restore from a backup'))
      await tap(buttons('Back up now')[0])
      const file = `workout-database-${TODAY}.json`
      assert.deepEqual(clicks, [file])
      assert.match(view.text(), new RegExp(`Backup saved — ${file.replace(/\./g, '\\.')}`))
      assert.ok(text.indexOf('Back up now') < text.indexOf('Developer'), 'the Developer group stays below')
    } finally {
      URL.createObjectURL = saved.create
      URL.revokeObjectURL = saved.revoke
      window.HTMLAnchorElement.prototype.click = anchorClick
    }
  })
})

describe('§5 By exercise rows show numbers', () => {
  it('a weighted session reads "<date> · 25 kg × 10"; the count moves out of the row', async () => {
    const at = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 0, 30).toISOString()
    const ex = 'ex-chest-press'
    const w = {
      ...seed.workouts[0], id: 'w-top', routineId: 'sess-upper', finishedAt: at, startedAt: at, performedOn: TODAY,
      sets: [12, 10, 8].map((reps, i) => ({ exerciseId: ex, routineItemId: 'x', setType: 'work', weight: [20, 25, 25][i], reps: String(reps) })),
    }
    await open(`/history/exercise/${ex}`, { ...seed, workouts: [...seed.workouts, w] })
    const row = view.all('a.ui-row__link').find((a) => a.getAttribute('href').startsWith('#/history/w-top/'))
    assert.match(row.textContent, / · 25 kg × 10/)
    assert.doesNotMatch(row.textContent, /sets/)
  })
})

describe('§6 search keeps focus after ×', () => {
  it('AC5: × empties the query and document.activeElement is the search input', async () => {
    const { SearchField } = await importJsx('./ui/index.jsx', import.meta.url)
    function Harness() {
      const [q, setQ] = useState('')
      return h(SearchField, { value: q, onChange: (e) => setQ(e.target.value), onClear: () => setQ('') })
    }
    view = await render(h(Harness))
    const input = view.input('Search')
    await view.type(input, 'bench')
    const clear = view.container.querySelector('button[aria-label="Clear search"]')
    await view.click(clear)
    assert.equal(input.value, '')
    // compared by identity: a failing assert.equal on two DOM nodes inspects the whole tree
    assert.ok(document.activeElement === input, `activeElement is ${document.activeElement?.tagName}`)
  })
})
