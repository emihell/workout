// req-211 (DEC-117 §2) — "Change day" from Home moves ONE date (a new optional
// `schedule.moves: [{ id, slotId, from, to }]`); the Schedule's undated day still moves every
// week (req-207). Data lane: no version bump, no rewrite — migrateState normalises `moves`,
// export/import carry it, removing a slot drops its moves, and a legacy v8 doc still migrates
// exactly as main did (plus the additive `moves: []`).
import { describe, it, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { addDays, comingDays, coveringWorkout, dateKey, mondayOf, moveInto, slotsOn } from './schedule.js'
import { migrateState, normaliseMoves } from './model.js'
import { migrateState as migrateStateMain } from './req-158.model-main.fixture.js'
import { withEmptyMoves } from './test-support/moves.js'
import { applyBackup, buildBackup } from './exchange.js'
import { slotMovedOnDateState, slotRemovedState } from './state-reducers.js'
import { dateDayPath, movedFromText, oneDateSheet } from './views/schedule-day.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'
import { withFrom } from './route.js'

const here = dirname(fileURLToPath(import.meta.url))
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))

// A Fri slot (1-week loop) and AC1's move: Fri Oct 16 → Thu Oct 15 2026.
const FRI_SLOT = { id: 's-fri', week: 0, weekday: 5, routineId: 'sess-upper' }
const MOVE = { id: 'move-1', slotId: 's-fri', from: '2026-10-16', to: '2026-10-15' }
const schedule = (moves) => ({ loopWeeks: 1, anchor: '2026-08-24', slots: [FRI_SLOT], ...(moves ? { moves } : {}) })

describe('AC1 slotsOn applies one-date moves', () => {
  it('Thu Oct 15 has it; Fri Oct 16 does not; Fri Oct 23 has it again', () => {
    const s = schedule([MOVE])
    assert.deepEqual(slotsOn(s, '2026-10-15').map((x) => x.id), ['s-fri'])
    assert.deepEqual(slotsOn(s, '2026-10-16'), [])
    assert.deepEqual(slotsOn(s, '2026-10-23').map((x) => x.id), ['s-fri'])
    assert.deepEqual(slotsOn(s, '2026-10-22'), [], 'next Thu: no')
  })
  it('no moves (absent, non-array) → exactly the weekday rule', () => {
    for (const s of [schedule(), { ...schedule(), moves: 'x' }]) {
      assert.deepEqual(slotsOn(s, '2026-10-16').map((x) => x.id), ['s-fri'])
      assert.deepEqual(slotsOn(s, '2026-10-15'), [])
    }
  })
  it('comingDays (Home) follows: from Wed Oct 14, Thu has it and Fri is Rest', () => {
    const rows = comingDays(schedule([MOVE]), [{ id: 'sess-upper' }], new Date(2026, 9, 14, 10), 3)
    assert.deepEqual(rows.map((r) => [r.dateKey, r.weekday, r.slots.map((x) => x.id)]), [
      ['2026-10-15', 4, ['s-fri']],
      ['2026-10-16', 5, []],
      ['2026-10-17', 6, []],
    ])
  })
  it('moveInto names the move that put a slot on a date', () => {
    assert.deepEqual(moveInto(schedule([MOVE]), 's-fri', '2026-10-15'), MOVE)
    assert.equal(moveInto(schedule([MOVE]), 's-fri', '2026-10-16'), null)
  })
  it('a moved slot is covered by a workout done on the `to` date (coveringWorkout by date)', () => {
    const done = { id: 'w1', routineId: 'sess-upper', finishedAt: '2026-10-15T18:00:00', scheduledFor: '2026-10-15', scheduleSlotId: 's-fri', occurrenceId: 's-fri@2026-10-15' }
    assert.equal(coveringWorkout([done], 'sess-upper', '2026-10-15', 's-fri'), done)
    assert.equal(coveringWorkout([done], 'sess-upper', '2026-10-16', 's-fri'), null)
  })
})

describe('AC2 migrateState normalises moves (legacy and v9)', () => {
  it('a v9 doc with no moves → moves [] and the slots deep-equal to before', () => {
    const doc = migrateState(structuredClone(seed), { legacy: true }) // a v9 doc of today's shape
    delete doc.schedule.moves
    const out = migrateState(structuredClone(doc))
    assert.deepEqual(out.schedule.moves, [])
    assert.deepEqual(out.schedule.slots, doc.schedule.slots)
    assert.deepEqual({ ...out, schedule: { ...out.schedule, moves: undefined } }, { ...doc, schedule: { ...doc.schedule, moves: undefined } })
  })
  it('the legacy v8 fixture (src/db.json) migrates as main did, plus only `moves: []`', () => {
    const branch = migrateState(structuredClone(seed), { legacy: true })
    const main = migrateStateMain(structuredClone(seed), { legacy: true })
    assert.equal('moves' in main.schedule, false, 'main had no moves')
    assert.deepEqual(branch.schedule.moves, [])
    assert.deepEqual(branch, withEmptyMoves(main))
    const { moves: _moves, ...rest } = branch.schedule
    assert.deepEqual(rest, main.schedule, 'the schedule is otherwise main\'s exactly')
  })
  it('one valid and one malformed move → keeps 1', () => {
    const out = migrateState({ ...structuredClone(seed), schedule: { ...schedule(), moves: [MOVE, { id: 'bad', slotId: 's-fri', from: 'Fri', to: '2026-10-15' }] } }, { legacy: true })
    assert.deepEqual(out.schedule.moves, [MOVE])
  })
  it('a move for a missing slot is dropped', () => {
    const out = migrateState({ ...structuredClone(seed), schedule: { ...schedule(), moves: [MOVE, { ...MOVE, id: 'm2', slotId: 'gone' }] } }, { legacy: true })
    assert.deepEqual(out.schedule.moves, [MOVE])
  })
  it('normaliseMoves: every malformed shape dropped; the four fields kept', () => {
    const slots = [FRI_SLOT]
    assert.deepEqual(normaliseMoves(undefined, slots), [])
    assert.deepEqual(normaliseMoves(null, slots), [])
    assert.deepEqual(normaliseMoves({ 0: MOVE }, slots), [])
    assert.deepEqual(
      normaliseMoves(
        [
          null,
          'x',
          [MOVE],
          { ...MOVE, id: undefined },
          { ...MOVE, id: '' },
          { ...MOVE, from: '2026-02-30' },
          { ...MOVE, to: '2026-10-15T00:00' },
          { ...MOVE, to: MOVE.from },
          { ...MOVE, extra: 1 },
        ],
        slots,
      ),
      [MOVE],
    )
  })
})

describe('the real load path writes nothing for a v9 store', () => {
  let previous
  let disk
  beforeEach(() => {
    previous = globalThis.localStorage
    disk = new Map()
    globalThis.localStorage = {
      getItem: (k) => (disk.has(k) ? disk.get(k) : null),
      setItem: (k, v) => disk.set(k, String(v)),
      removeItem: (k) => disk.delete(k),
      get length() {
        return disk.size
      },
      key: (i) => [...disk.keys()][i] ?? null,
    }
  })
  afterEach(() => {
    globalThis.localStorage = previous
  })
  it('loadState of a v9 doc without moves: the stored string is byte-identical after load', async () => {
    const { loadState } = await import('./storage.js')
    const v9 = JSON.stringify(migrateState(structuredClone(seed), { legacy: true }))
    const doc = JSON.parse(v9)
    delete doc.schedule.moves
    const raw = JSON.stringify(doc)
    disk.set('workout-mvp-v9', raw)
    disk.set('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
    const loaded = loadState()
    assert.deepEqual(loaded.schedule.moves, [])
    assert.equal(disk.get('workout-mvp-v9'), raw, '0 records rewritten on upgrade')
  })
})

describe('AC3 export → import keeps moves', () => {
  it('buildBackup → JSON → applyBackup: moves and slots deep-equal', () => {
    const state = migrateState({ ...structuredClone(seed), schedule: { ...schedule(), moves: [MOVE] } }, { legacy: true })
    const pack = JSON.parse(JSON.stringify(buildBackup(state)))
    assert.deepEqual(pack.state.schedule.moves, [MOVE])
    const { state: back } = applyBackup(pack)
    assert.deepEqual(back.schedule.moves, [MOVE])
    assert.deepEqual(back.schedule.slots, state.schedule.slots)
  })
})

describe('AC4 failure cases', () => {
  it('an import whose moves is not an array imports everything else, with moves []', () => {
    const state = migrateState({ ...structuredClone(seed), schedule: { ...schedule(), moves: [MOVE] } }, { legacy: true })
    const pack = JSON.parse(JSON.stringify(buildBackup(state)))
    for (const bad of ['oops', 7, { a: 1 }, null]) {
      pack.state.schedule.moves = bad
      const { state: back, summary } = applyBackup(pack)
      assert.deepEqual(back.schedule.moves, [])
      assert.deepEqual(back.schedule.slots, state.schedule.slots)
      assert.equal(back.workouts.length, state.workouts.length)
      assert.equal(summary.routines, state.routines.length)
    }
    pack.state.schedule.moves = [MOVE, { nope: true }, { ...MOVE, id: 'm3', slotId: 'gone' }]
    assert.deepEqual(applyBackup(pack).state.schedule.moves, [MOVE], 'malformed entries dropped, the import kept')
  })
  it('removing a slot removes its moves (and only its)', () => {
    const other = { id: 'm-o', slotId: 's-mon', from: '2026-10-12', to: '2026-10-13' }
    const s = { schedule: { ...schedule([MOVE, other]), slots: [FRI_SLOT, { id: 's-mon', week: 0, weekday: 1, routineId: 'sess-lower' }] } }
    const out = slotRemovedState(s, 's-fri')
    assert.deepEqual(out.schedule.slots.map((x) => x.id), ['s-mon'])
    assert.deepEqual(out.schedule.moves, [other])
  })
})

describe('slotMovedOnDateState (one date)', () => {
  const base = { schedule: schedule() }
  it('adds { id, slotId, from: date, to }', () => {
    const out = slotMovedOnDateState(base, { id: 'm1', slotId: 's-fri', date: '2026-10-16', to: '2026-10-15' })
    assert.deepEqual(out.schedule.moves, [{ id: 'm1', slotId: 's-fri', from: '2026-10-16', to: '2026-10-15' }])
    assert.deepEqual(out.schedule.slots, base.schedule.slots, 'slots untouched')
  })
  it('moving a moved session again replaces its move, keeping the original from', () => {
    const once = slotMovedOnDateState(base, { id: 'm1', slotId: 's-fri', date: '2026-10-16', to: '2026-10-15' })
    const twice = slotMovedOnDateState(once, { id: 'm2', slotId: 's-fri', date: '2026-10-15', to: '2026-10-13' })
    assert.deepEqual(twice.schedule.moves, [{ id: 'm2', slotId: 's-fri', from: '2026-10-16', to: '2026-10-13' }])
  })
  it('moving it back to its own date removes the move; the same date is a no-op', () => {
    const once = slotMovedOnDateState(base, { id: 'm1', slotId: 's-fri', date: '2026-10-16', to: '2026-10-15' })
    assert.deepEqual(slotMovedOnDateState(once, { id: 'm2', slotId: 's-fri', date: '2026-10-15', to: '2026-10-16' }).schedule.moves, [])
    assert.equal(slotMovedOnDateState(base, { id: 'm3', slotId: 's-fri', date: '2026-10-16', to: '2026-10-16' }), base)
  })
})

describe('the one-date sheet (pure)', () => {
  it('the 7 dates of the Mon–Sun week, the current marked, the copy', () => {
    const sheet = oneDateSheet('Upper Body', '2026-10-16')
    assert.equal(sheet.title, 'Move Upper Body to which day?')
    assert.equal(sheet.message, 'Only this week — the Schedule stays as it is.')
    assert.deepEqual(sheet.choices.map((c) => [c.value, c.label]), [
      ['2026-10-12', 'Monday'],
      ['2026-10-13', 'Tuesday'],
      ['2026-10-14', 'Wednesday'],
      ['2026-10-15', 'Thursday'],
      ['2026-10-16', 'Friday (now)'],
      ['2026-10-17', 'Saturday'],
      ['2026-10-18', 'Sunday'],
    ])
  })
  it('a date that already has this workout is left out (as req-207 leaves out a taken weekday)', () => {
    assert.deepEqual(oneDateSheet('X', '2026-10-16', ['2026-10-12']).choices.map((c) => c.value).includes('2026-10-12'), false)
  })
  it('dateDayPath and movedFromText', () => {
    assert.equal(dateDayPath(schedule(), '2026-10-15'), '/schedule/0/4?date=2026-10-15')
    assert.equal(movedFromText('2026-10-16'), 'moved from Fri')
  })
})

// ── the whole App ───────────────────────────────────────────────────────────────────
const NOW = new Date()
// Two dates in Home's next 6 days that share a Mon–Sun week (D = the slot's date, D2 the
// target): the biggest same-week group of today+1..today+6 always has ≥ 3 days.
function twoDates() {
  const days = Array.from({ length: 6 }, (_, k) => addDays(NOW, k + 1))
  const groups = new Map()
  for (const d of days) {
    const key = dateKey(mondayOf(d))
    groups.set(key, [...(groups.get(key) || []), d])
  }
  const group = [...groups.values()].sort((a, b) => b.length - a.length)[0]
  return { D: group.at(-1), D2: group[0] }
}

let view = null
afterEach(async () => {
  if (getPendingConfirm()) await act(async () => answerConfirm(null))
  if (view) await view.unmount()
  view = null
})
async function open(hash, data) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label) ?? null
const squash = (text) => text.replace(/\s+/g, '')
const link = (text) => view.all('a').find((a) => squash(a.textContent) === squash(text)) ?? null
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const homeRows = () => view.all('.ui-home-bottom > p + .ui-list a.ui-row__link').map((a) => a.textContent.replace(/›$/, ''))
async function tap(node) {
  await view.click(node)
  await flush()
}

describe('AC5 rendered: Home → day → ⋯ → Change day moves that one date', () => {
  it('lands on the chosen date, Home shows it there (moved from …) and the old date Rest; the Schedule is unchanged', async () => {
    const { D, D2 } = twoDates()
    const d = dateKey(D)
    const d2 = dateKey(D2)
    const data = { ...seed, workouts: [], schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [{ id: 's-1', week: 0, weekday: D.getDay(), routineId: 'sess-upper' }] } }
    await open(withFrom(`/schedule/0/${D.getDay()}?date=${d}`, '/'), data)
    const slotsBefore = stored()?.schedule.slots ?? migrateState(structuredClone(data), { legacy: true }).schedule.slots
    await tap(button('⋯'))
    await tap(button('Change day'))
    const pending = getPendingConfirm()
    assert.equal(pending.title, 'Move Upper Body to which day?')
    assert.equal(pending.message, 'Only this week — the Schedule stays as it is.')
    assert.equal(pending.choices.length, 7)
    await act(async () => answerConfirm(d2))
    await flush()
    // stored: one move, slots exactly as before
    assert.deepEqual(stored().schedule.moves.map(({ slotId, from, to }) => [slotId, from, to]), [['s-1', d, d2]])
    assert.deepEqual(stored().schedule.slots, slotsBefore)
    // landed on the chosen date's screen, the row says where it came from
    assert.equal(window.location.hash, `#${withFrom(`/schedule/0/${D2.getDay()}?date=${d2}`, '/')}`)
    assert.match(view.text(), new RegExp(`Upper Body\\s*${movedFromText(d)}`))
    // Home: the target row carries it, the original date is Rest
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/')
    const rows = homeRows()
    assert.ok(rows.some((r) => r.includes('Upper Body') && r.includes(movedFromText(d))), rows.join(' | '))
    const { weekdayDate } = await import('./views/history/helpers.js')
    assert.ok(rows.includes(`${weekdayDate(d)} · Rest`), rows.join(' | '))
    // the Schedule (undated) still shows the slot's own weekday
    window.location.hash = '#/schedule'
    await flush()
    const dayName = new Date(2026, 0, 4 + D.getDay()).toLocaleDateString('en-US', { weekday: 'long' })
    assert.match(view.text(), new RegExp(`${dayName} — Upper Body`))
  })

  it('the next week has it on its own day again; the moved row opens its slot page', async () => {
    const { D, D2 } = twoDates()
    const d = dateKey(D)
    const d2 = dateKey(D2)
    const data = {
      ...seed,
      workouts: [],
      schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [{ id: 's-1', week: 0, weekday: D.getDay(), routineId: 'sess-upper' }], moves: [{ id: 'm', slotId: 's-1', from: d, to: d2 }] },
    }
    const next = dateKey(addDays(D, 7))
    await open(withFrom(`/schedule/0/${D.getDay()}?date=${next}`, '/'), data)
    assert.match(view.text(), /Upper Body/)
    assert.doesNotMatch(view.text(), /moved from/)
    // the old date's screen: nothing; the target's: the row, and its name opens the slot page
    window.location.hash = `#${withFrom(`/schedule/0/${D.getDay()}?date=${d}`, '/')}`
    await flush()
    assert.match(view.text(), /None\./)
    window.location.hash = `#${withFrom(`/schedule/0/${D2.getDay()}?date=${d2}`, '/')}`
    await flush()
    await tap(link('Upper Body'))
    assert.doesNotMatch(view.text(), /Not on this day/)
    assert.match(view.text(), /Upper Body/)
  })

  it('moving back to its own date from the moved row removes the move', async () => {
    const { D, D2 } = twoDates()
    const d = dateKey(D)
    const d2 = dateKey(D2)
    const data = {
      ...seed,
      workouts: [],
      schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [{ id: 's-1', week: 0, weekday: D.getDay(), routineId: 'sess-upper' }], moves: [{ id: 'm', slotId: 's-1', from: d, to: d2 }] },
    }
    await open(withFrom(`/schedule/0/${D2.getDay()}?date=${d2}`, '/'), data)
    await tap(button('⋯'))
    await tap(button('Change day'))
    assert.ok(getPendingConfirm().choices.find((c) => c.value === d2).label.endsWith('(now)'))
    await act(async () => answerConfirm(d))
    await flush()
    assert.deepEqual(stored().schedule.moves, [])
    assert.equal(window.location.hash, `#${withFrom(`/schedule/0/${D.getDay()}?date=${d}`, '/')}`)
  })

  it('the undated day (from the Schedule) still moves every week and writes no move', async () => {
    const { D } = twoDates()
    const wd = D.getDay()
    const target = (wd + 1) % 7
    const data = { ...seed, workouts: [], schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [{ id: 's-1', week: 0, weekday: wd, routineId: 'sess-upper' }] } }
    await open(`/schedule/0/${wd}`, data)
    await tap(button('⋯'))
    await tap(button('Change day'))
    assert.equal(getPendingConfirm().message, 'It moves for every week. Your history is kept.')
    await act(async () => answerConfirm(String(target)))
    await flush()
    assert.deepEqual(stored().schedule.slots.map((s) => [s.week, s.weekday]), [[0, target]])
    assert.deepEqual(stored().schedule.moves, [])
  })
})
