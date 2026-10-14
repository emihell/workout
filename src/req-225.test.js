// req-225 (DEC-125 §5) — tap today's workout on Home: a sheet with its exercises, Edit, and
// Swap for today (`schedule.swaps`, one date only; additive, no version bump — the `moves`
// precedent). Pure parts (normaliseSwaps, slotsOn, reducers, export/import) are tested directly;
// Home renders as the whole App under happy-dom with the clock mocked, ONE App (one
// StoreProvider) per test, navigating inside it (L-051). Asserts compare strings/booleans (L-055).
import { describe, it, afterEach, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { coveringWorkout, doneEarlier, slotsOn, swapOn } from './schedule.js'
import { migrateState, normaliseSwaps, SCHEMA_VERSION } from './model.js'
import { applyBackup, buildBackup, importResult, undocumentedFields } from './exchange.js'
import { removeRoutineFromState, slotRemovedState, slotSwappedOnDateState } from './state-reducers.js'
import { slotScreenSlot, slotStart, swapChoices, swappedFromText, todaySlotEditPath } from './views/schedule-day.js'
import { parseRoute } from './route.js'

const here = dirname(fileURLToPath(import.meta.url))
const h = React.createElement
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8')) // a v8 doc

// Oct 2026: Mon 5, Tue 6, Wed 7, Thu 8 (today in the screen tests), Fri 9; next Tue 13.
const TUE = '2026-10-06'
const WED = '2026-10-07'
const THU = '2026-10-08'
const NEXT_TUE = '2026-10-13'
const NOW = new Date(2026, 9, 8, 12)

const SLOTS = [
  { id: 's-tue', week: 0, weekday: 2, routineId: 'sess-upper' },
  { id: 's-thu', week: 0, weekday: 4, routineId: 'sess-lower' },
  { id: 's-fri', week: 0, weekday: 5, routineId: 'sess-push-pull' },
]
const sched = (extra = {}) => ({ loopWeeks: 1, anchor: '2026-08-24', slots: SLOTS, moves: [], swaps: [], ...extra })
const SWAP_TUE = { id: 'swap-1', slotId: 's-tue', date: TUE, routineId: 'sess-lower' }
const SWAP_THU = { id: 'swap-2', slotId: 's-thu', date: THU, routineId: 'sess-upper' }
// a v9 state of today's shape, from the v8 seed, with this test's schedule
const v9 = (schedule = sched()) => migrateState({ ...structuredClone(seed), schedule }, { legacy: true })

describe('AC1 migration: swaps is additive (no version bump)', () => {
  it('a stored v9 state WITHOUT swaps loads with swaps [] and every other field deep-equal', () => {
    const doc = v9()
    delete doc.schedule.swaps
    const out = migrateState(structuredClone(doc))
    assert.equal(out.schemaVersion, SCHEMA_VERSION)
    assert.equal(SCHEMA_VERSION, 9, 'no version bump')
    assert.deepEqual(out.schedule.swaps, [])
    const { swaps: _s, ...schedule } = out.schedule
    assert.deepEqual({ ...out, schedule }, doc)
  })
  it('the legacy v8 key (src/db.json) still upgrades: swaps [], slots kept', () => {
    const out = migrateState(structuredClone(seed), { legacy: true })
    assert.equal(out.schemaVersion, 9)
    assert.deepEqual(out.schedule.swaps, [])
    assert.deepEqual(out.schedule.slots, seed.schedule.slots)
  })
  it('a v8 doc WITH swaps keeps the valid one', () => {
    const swap = { id: 'w1', slotId: 'slot-sess-upper', date: '2026-10-05', routineId: 'sess-lower' }
    const out = migrateState({ ...structuredClone(seed), schedule: { ...seed.schedule, swaps: [swap] } }, { legacy: true })
    assert.deepEqual(out.schedule.swaps, [swap])
  })
  describe('loadState', () => {
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
    it('a v9 doc without swaps: the stored string is byte-identical after load (0 records rewritten)', async () => {
      const { loadState } = await import('./storage.js')
      const doc = v9()
      delete doc.schedule.swaps
      const raw = JSON.stringify(doc)
      disk.set('workout-mvp-v9', raw)
      disk.set('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
      const loaded = loadState()
      assert.deepEqual(loaded.schedule.swaps, [])
      assert.equal(disk.get('workout-mvp-v9') === raw, true, '0 records rewritten on load')
    })
  })
})

describe('AC2 normaliseSwaps', () => {
  const routines = [
    { id: 'sess-upper', archivedAt: null },
    { id: 'sess-lower', archivedAt: null },
    { id: 'old', archivedAt: '2026-10-01T00:00:00.000Z' },
  ]
  it('absent / non-array → []', () => {
    for (const bad of [undefined, null, 'x', 7, { 0: SWAP_TUE }]) assert.deepEqual(normaliseSwaps(bad, SLOTS, routines), [])
  })
  it('drops non-object, unknown slot, bad date, archived / missing / same routine; keeps the four fields', () => {
    const out = normaliseSwaps(
      [
        null,
        'x',
        [SWAP_TUE],
        { ...SWAP_TUE, id: undefined },
        { ...SWAP_TUE, id: '' },
        { ...SWAP_TUE, slotId: 'gone' },
        { ...SWAP_TUE, date: '2026-02-30' },
        { ...SWAP_TUE, date: 'Tue' },
        { ...SWAP_TUE, routineId: 'old' },
        { ...SWAP_TUE, routineId: 'missing' },
        { ...SWAP_TUE, routineId: 'sess-upper' }, // the slot's own
        { ...SWAP_TUE, extra: 1 },
      ],
      SLOTS,
      routines,
    )
    assert.deepEqual(out, [SWAP_TUE])
  })
  it('last per (slotId, date) wins; other dates and slots kept', () => {
    const later = { ...SWAP_TUE, id: 'swap-9', routineId: 'sess-lower' }
    const other = { ...SWAP_TUE, id: 'swap-3', date: NEXT_TUE }
    const out = normaliseSwaps([{ ...SWAP_TUE, routineId: 'sess-lower', id: 'first' }, other, later], SLOTS, routines)
    assert.deepEqual(out, [other, later])
  })
})

describe('AC3 slotsOn applies a swap on its date only', () => {
  it('swap on Tue → Tue has the new routineId + swappedFrom; Wed and next Tue unchanged', () => {
    const schedule = sched({ swaps: [SWAP_TUE] })
    const tue = slotsOn(schedule, TUE)
    assert.equal(tue.length, 1)
    assert.equal(tue[0].id, 's-tue')
    assert.equal(tue[0].routineId, 'sess-lower')
    assert.equal(tue[0].swappedFrom, 'sess-upper')
    assert.equal(slotsOn(schedule, WED).length, 0)
    const next = slotsOn(schedule, NEXT_TUE)
    assert.equal(next[0].routineId, 'sess-upper')
    assert.equal('swappedFrom' in next[0], false)
    // the stored slot itself is untouched (the weekly schedule never changes)
    assert.deepEqual(schedule.slots, SLOTS)
  })
  it('swap + move: a slot moved Tue → Thu, swapped on Thu → Thu shows the swapped routine', () => {
    const schedule = sched({
      moves: [{ id: 'm1', slotId: 's-tue', from: TUE, to: THU }],
      swaps: [{ id: 'w1', slotId: 's-tue', date: THU, routineId: 'sess-push-pull' }],
    })
    assert.equal(slotsOn(schedule, TUE).length, 0)
    const thu = slotsOn(schedule, THU)
    const moved = thu.find((slot) => slot.id === 's-tue')
    assert.equal(moved.routineId, 'sess-push-pull')
    assert.equal(moved.swappedFrom, 'sess-upper')
    assert.equal(thu.find((slot) => slot.id === 's-thu').routineId, 'sess-lower')
  })
  it('swapOn finds it by (slotId, date); none on another date', () => {
    const schedule = sched({ swaps: [SWAP_TUE] })
    assert.equal(swapOn(schedule, 's-tue', TUE)?.id, 'swap-1')
    assert.equal(swapOn(schedule, 's-tue', NEXT_TUE), null)
  })
})

describe('AC4 the swapped-in routine covers the spot', () => {
  const finished = (id, routineId, slotId, date) => ({
    id,
    routineId,
    finishedAt: `${date}T10:00:00.000Z`,
    performedOn: date,
    scheduledFor: date,
    scheduleSlotId: slotId,
    occurrenceId: `${slotId}@${date}`,
    sets: [],
  })
  it('finishing the swapped-in routine on that date covers the spot; the original does not', () => {
    const schedule = sched({ swaps: [SWAP_TUE] })
    const spot = slotsOn(schedule, TUE)[0]
    const lower = [finished('w-l', 'sess-lower', 's-tue', TUE)]
    assert.equal(coveringWorkout(lower, spot.routineId, TUE, spot.id)?.id, 'w-l')
    const upper = [finished('w-u', 'sess-upper', 's-tue', TUE)]
    assert.equal(coveringWorkout(upper, spot.routineId, TUE, spot.id), null)
    // doneEarlier walks the week through slotsOn: the swapped Tue spot is a Lower spot
    assert.equal(doneEarlier([], 'sess-upper', TUE, 's-tue', schedule), null)
  })
})

describe('reducers: one entry added / removed per tap, nothing else rewritten', () => {
  it('swap adds one entry; Back (swap to its own routine) removes it; same pick is a no-op', () => {
    const s0 = v9()
    const s1 = slotSwappedOnDateState(s0, { id: 'swap-a', slotId: 's-thu', date: THU, routineId: 'sess-upper' })
    assert.deepEqual(s1.schedule.swaps, [{ id: 'swap-a', slotId: 's-thu', date: THU, routineId: 'sess-upper' }])
    assert.equal(s1.schedule.slots === s0.schedule.slots, true, 'slots untouched (same reference)')
    assert.equal(s1.workouts === s0.workouts && s1.routines === s0.routines, true)
    assert.equal(slotSwappedOnDateState(s1, { id: 'swap-b', slotId: 's-thu', date: THU, routineId: 'sess-upper' }) === s1, true)
    const s2 = slotSwappedOnDateState(s1, { id: 'swap-c', slotId: 's-thu', date: THU, routineId: 'sess-lower' })
    assert.deepEqual(s2.schedule.swaps, [])
    assert.deepEqual(s2.schedule, s0.schedule)
  })
  it('re-swapping replaces (one entry per slot and date); an unknown slot is a no-op', () => {
    const s1 = slotSwappedOnDateState(v9(), { id: 'a', slotId: 's-thu', date: THU, routineId: 'sess-upper' })
    const s2 = slotSwappedOnDateState(s1, { id: 'b', slotId: 's-thu', date: THU, routineId: 'sess-push-pull' })
    assert.deepEqual(s2.schedule.swaps, [{ id: 'b', slotId: 's-thu', date: THU, routineId: 'sess-push-pull' }])
    assert.equal(slotSwappedOnDateState(s2, { id: 'c', slotId: 'gone', date: THU, routineId: 'sess-upper' }) === s2, true)
  })
  it('removing a slot drops its swaps', () => {
    const s = v9(sched({ swaps: [SWAP_TUE, SWAP_THU] }))
    assert.deepEqual(slotRemovedState(s, 's-tue').schedule.swaps, [SWAP_THU])
  })
  it('removing (archiving or deleting) the swapped-in routine drops the swap', () => {
    const s = v9(sched({ swaps: [SWAP_TUE, SWAP_THU] }))
    // sess-upper has history in the seed → archived
    const out = removeRoutineFromState(s, 'sess-upper', '2026-10-08T12:00:00.000Z')
    assert.equal(Boolean(out.routines.find((r) => r.id === 'sess-upper').archivedAt), true)
    assert.deepEqual(out.schedule.swaps, [], 'SWAP_THU swapped it in; SWAP_TUE was on its slot')
  })
})

describe('AC5 export → import, and restore-routine filtering', () => {
  it('buildBackup → JSON → applyBackup keeps swaps', () => {
    const state = v9(sched({ swaps: [SWAP_TUE, SWAP_THU] }))
    const pack = JSON.parse(JSON.stringify(buildBackup(state)))
    assert.deepEqual(pack.state.schedule.swaps, [SWAP_TUE, SWAP_THU])
    const { state: back } = applyBackup(pack)
    assert.deepEqual(back.schedule.swaps, [SWAP_TUE, SWAP_THU])
    assert.deepEqual(back.schedule.slots, state.schedule.slots)
  })
  it('the export documents swaps (no undocumented field)', () => {
    assert.deepEqual(undocumentedFields(v9(sched({ swaps: [SWAP_TUE] }))), [])
  })
  it('an import whose swaps is not an array imports everything else, with swaps []', () => {
    const state = v9(sched({ swaps: [SWAP_TUE] }))
    const pack = JSON.parse(JSON.stringify(buildBackup(state)))
    for (const bad of ['oops', 7, { a: 1 }, null]) {
      pack.state.schedule.swaps = bad
      const { state: back } = applyBackup(pack)
      assert.deepEqual(back.schedule.swaps, [])
      assert.equal(back.workouts.length, state.workouts.length)
    }
  })
  it('restore-routine: a routine brought back archived loses its slots and their swaps, and swaps into it', () => {
    const current = v9(sched({ swaps: [SWAP_TUE, SWAP_THU] }))
    // the file has no sess-upper, but the device's history (kept) references it
    const incoming = {
      ...current,
      routines: current.routines.filter((r) => r.id !== 'sess-upper'),
    }
    const out = importResult(incoming, current, { keepHistory: true, archivedAt: '2026-10-08T12:00:00.000Z' })
    assert.equal(Boolean(out.routines.find((r) => r.id === 'sess-upper')?.archivedAt), true)
    assert.equal(out.schedule.slots.some((slot) => slot.id === 's-tue'), false)
    assert.deepEqual(out.schedule.swaps, [])
  })
})

describe('screen helpers', () => {
  it('swapChoices: other non-archived routines, store order, minus the shown and its own', () => {
    const routines = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', archivedAt: '2026-01-01' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ]
    assert.deepEqual(swapChoices(routines, { id: 's', routineId: 'a' }).map((r) => r.id), ['c', 'd'])
    assert.deepEqual(swapChoices(routines, { id: 's', routineId: 'c', swappedFrom: 'a' }).map((r) => r.id), ['d'])
    assert.equal(swappedFromText('Upper Body'), 'swapped from Upper Body')
  })
  it('todaySlotEditPath: the slot editor through today\'s dated day screen, then Home', () => {
    const path = todaySlotEditPath(sched(), 's-thu', NOW)
    const route = parseRoute(path)
    assert.equal(route.name, 'schedule-slot')
    assert.equal(route.slotId, 's-thu')
    const day = parseRoute(route.from)
    assert.equal(day.name, 'schedule-day')
    assert.equal(day.date, THU)
    assert.equal(day.from, '/')
  })
  it('slotScreenSlot: the screen\'s date (dated from, else today) → the swapped slot; another day → the slot itself', () => {
    const schedule = sched({ swaps: [SWAP_THU] })
    const from = `/schedule/0/4?date=${THU}&from=%2F`
    assert.equal(slotScreenSlot(schedule, 0, 4, SLOTS[1], from, NOW).routineId, 'sess-upper')
    // a sub-screen (no `from`) on the swap's date keeps the swapped-in routine
    assert.equal(slotScreenSlot(schedule, 0, 4, SLOTS[1], null, NOW).routineId, 'sess-upper')
    // Whole plan on another day: the recurring slot
    const wed = new Date(2026, 9, 7, 12)
    assert.equal(slotScreenSlot(schedule, 0, 4, SLOTS[1], '/schedule', wed).routineId, 'sess-lower')
    // next week's dated screen: the swap is for one date only
    assert.equal(slotScreenSlot(schedule, 0, 4, SLOTS[1], `/schedule/0/4?date=2026-10-15&from=%2F`, NOW).routineId, 'sess-lower')
  })
  it('slotStart: today\'s spot is tagged only for the routine it stands for today', () => {
    const state = { workouts: [], schedule: sched({ swaps: [SWAP_THU] }), activeWorkout: null }
    const upper = { id: 'sess-upper', exercises: [{ exerciseId: 'x' }] }
    const lower = { id: 'sess-lower', exercises: [{ exerciseId: 'x' }] }
    assert.equal(slotStart(state, upper, 's-thu', THU, NOW).options?.occurrenceId, `s-thu@${THU}`)
    assert.equal(slotStart(state, lower, 's-thu', THU, NOW).options, null, 'its own routine starts off-schedule today')
  })
})

// ---- rendered (the whole App) ----

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
  mock.timers.reset()
})

async function open(stored, hash = '/') {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: NOW })
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v9', JSON.stringify(stored))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await settle()
}
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const tap = async (node) => {
  await view.click(node)
  await settle()
}
const go = async (hash) => {
  await act(async () => {
    window.location.hash = `#${hash}`
    window.dispatchEvent(new window.HashChangeEvent('hashchange'))
  })
  await settle()
}
const block = () => view.container.querySelector('.ui-today-workout')
const sheet = () => document.body.querySelector('.ui-workout-sheet')
const inSheet = (label) => [...sheet().querySelectorAll('button, a')].find((b) => b.textContent.trim() === label)
const nameButton = (name) => [...block().querySelectorAll('.ui-today-workout__open')].find((b) => b.textContent.trim() === name)
const saved = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const STORE = () => v9(sched())

describe('AC6 Home → sheet → Edit / Swap for today / Back', () => {
  it('tapping the name opens the sheet with the routine\'s exercises and Edit · Swap for today · Close', async () => {
    const stored = STORE()
    await open(stored)
    assert.equal(Boolean(sheet()), false)
    await tap(nameButton('Lower Body'))
    assert.equal(Boolean(sheet()), true)
    assert.equal(sheet().querySelector('#ui-workout-sheet-title').textContent, 'Lower Body')
    const lower = stored.routines.find((r) => r.id === 'sess-lower')
    const names = [...sheet().querySelectorAll('.ui-workout-sheet__list li > span:first-child')].map((n) => n.textContent)
    const expected = lower.exercises.map((item) => stored.exercises.find((e) => e.id === item.exerciseId)?.name)
    assert.deepEqual(names, expected)
    assert.equal(lower.exercises.length > 0, true)
    assert.match(sheet().querySelector('.ui-workout-sheet__list .ui-row__meta').textContent, /\d+ × /)
    assert.equal(Boolean(inSheet('Edit')), true)
    assert.equal(Boolean(inSheet('Swap for today')), true)
    assert.equal(Boolean(inSheet('Back to Lower Body')), false)
    await tap(inSheet('Close'))
    assert.equal(Boolean(sheet()), false)
    assert.deepEqual(saved().schedule.swaps, [], 'Close writes nothing')
  })

  it('Edit opens the Schedule\'s slot editor for this slot', async () => {
    await open(STORE())
    await tap(nameButton('Lower Body'))
    const edit = inSheet('Edit')
    assert.equal(edit.getAttribute('href'), `#${todaySlotEditPath(sched(), 's-thu', NOW)}`)
    await tap(edit)
    assert.match(window.location.hash, /^#\/schedule\/0\/4\/s-thu\?from=/)
    assert.equal(view.text().includes('Lower Body'), true)
  })

  it('Swap for today → pick → Home shows the new name + "swapped from"; Back to → original, swaps empty', async () => {
    const before = STORE()
    await open(before)
    await tap(nameButton('Lower Body'))
    await tap(inSheet('Swap for today'))
    const picks = [...sheet().querySelectorAll('.ui-sheet__choices button')].map((b) => b.textContent)
    assert.deepEqual(picks, ['Upper Body', 'Push / Pull'])
    await tap(inSheet('Upper Body'))
    assert.equal(Boolean(sheet()), false)
    const afterSwap = saved()
    assert.equal(afterSwap.schedule.swaps.length, 1)
    const [swap] = afterSwap.schedule.swaps
    assert.deepEqual({ ...swap, id: 'x' }, { id: 'x', slotId: 's-thu', date: THU, routineId: 'sess-upper' })
    assert.deepEqual(afterSwap.schedule.slots, before.schedule.slots, 'the weekly schedule is unchanged')
    assert.equal(Boolean(nameButton('Upper Body')), true)
    assert.equal(block().textContent.includes('swapped from Lower Body'), true)
    // tomorrow (Fri, Coming up) unchanged
    assert.equal(view.text().includes('Push / Pull'), true)
    // the swapped sheet offers Back
    await tap(nameButton('Upper Body'))
    assert.equal(sheet().textContent.includes('swapped from Lower Body'), true)
    await tap(inSheet('Back to Lower Body'))
    assert.deepEqual(saved().schedule.swaps, [])
    assert.equal(Boolean(nameButton('Lower Body')), true)
    assert.equal(block().textContent.includes('swapped from'), false)
    // AC8 — nothing else in saved state changed across the two taps
    const after = saved()
    assert.deepEqual({ ...after, schedule: { ...after.schedule, swaps: [] } }, { ...afterSwap, schedule: { ...afterSwap.schedule, swaps: [] } })
  })

  it('AC9 (rendered): swapped, Start → the swapped-in workout, tagged with today\'s slot', async () => {
    await open(v9(sched({ swaps: [SWAP_THU] })))
    assert.equal(Boolean(nameButton('Upper Body')), true)
    const start = [...block().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start')
    await tap(start)
    const active = saved().activeWorkout
    assert.equal(active.routineId, 'sess-upper')
    assert.equal(active.scheduleSlotId, 's-thu')
    assert.equal(active.occurrenceId, `s-thu@${THU}`)
    assert.match(window.location.hash, /^#\/workout\/sess-upper/)
  })

  it('Edit on a swapped spot edits the swapped-in routine', async () => {
    await open(v9(sched({ swaps: [SWAP_THU] })))
    await tap(nameButton('Upper Body'))
    await tap(inSheet('Edit'))
    assert.equal(view.text().includes('Upper Body'), true)
    assert.equal(view.text().includes('Lower Body'), false)
    // an exercise of the swapped-in routine opens (its sub-screen carries no `from`)
    const item = [...view.container.querySelectorAll('.ui-row__stack a')][0]
    assert.equal(Boolean(item), true)
    await tap(item)
    assert.match(window.location.hash, /^#\/schedule\/0\/4\/s-thu\/exercise\//)
    assert.equal(view.text().includes('Not found'), false)
  })
})

describe('AC7 failure case: the swapped-in routine is archived after the swap', () => {
  it('stored swap to an archived routine → dropped on load, Home shows the original, no crash', async () => {
    const stored = v9(sched({ swaps: [SWAP_THU] }))
    stored.routines = stored.routines.map((r) => (r.id === 'sess-upper' ? { ...r, archivedAt: '2026-10-08T09:00:00.000Z' } : r))
    await open(stored)
    assert.equal(Boolean(nameButton('Lower Body')), true)
    assert.equal(block().textContent.includes('swapped from'), false)
    assert.equal(Boolean(nameButton('Upper Body')), false)
  })
  it('archived in-session (Delete on the routine) → Home falls back to the original without a reload', async () => {
    await open(v9(sched({ swaps: [SWAP_THU] })))
    assert.equal(Boolean(nameButton('Upper Body')), true)
    await go('/routines/sess-upper')
    const del = [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete')
    assert.equal(Boolean(del), true)
    await tap(del)
    const confirm = [...document.body.querySelectorAll('.ui-sheet button')].find((b) => b.textContent.trim() === 'Delete')
    await tap(confirm)
    assert.deepEqual(saved().schedule.swaps, [])
    await go('/')
    assert.equal(Boolean(nameButton('Lower Body')), true)
    assert.equal(block().textContent.includes('swapped from'), false)
  })
})
