// req-191 §7 (sanctioned, flagged in reports/req-191.md) — routine names 'Workout' / 'Workout A/B' →
// 'My workout' / 'My workout A/B' throughout; nothing else changed.
// req-190 (DEC-105) — first setup from your machines; a new plan starts today; no silent
// empty day. Pure: the split rule, the start-today shift (today injected), machinesPlan and
// planToState for both starts. Rendered: the machines-first flow and the empty-day sheet
// against the real store; the picker bar's bottom clearance (CSS).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'
import { catalogItemToExercise, loadExerciseCatalog } from './exerciseCatalog.js'
import { emptyState } from './persistence.js'
import {
  PLAN_TEMPLATES,
  SPLIT_AB,
  SPLIT_SAME,
  emptyPlanDays,
  machinesPlan,
  planIds,
  planToState,
  splitPicks,
  startTodayWeek,
} from './plan-templates.js'
import { pickerItem } from './routine-picker.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'

const h = React.createElement
const library = await loadExerciseCatalog()

let counter = 0
const uid = (prefix) => `${prefix}-${++counter}`
const TUESDAY = new Date(2026, 9, 6, 10) // Tue 2026-10-06
const SATURDAY = new Date(2026, 9, 10, 10)
const idsFor = (choices, now = TUESDAY) => planIds(choices, uid, now)()
const own = (id) => ({ kind: 'own', exerciseId: id, item: pickerItem([], { type: 'free' }).item, name: id })
const base = () => ({ ...emptyState(), schedule: { loopWeeks: 2, anchor: '2026-09-21', slots: [] } })
const byName = (state) => Object.fromEntries(state.routines.map((r) => [r.id, r.name]))
const week = (state) => state.schedule.slots.map((slot) => [slot.weekday, byName(state)[slot.routineId]])

describe('req-190 AC1 — the split rule', () => {
  it('same → one group in pick order; A/B → alternate in pick order', () => {
    assert.deepEqual(splitPicks(['a', 'b', 'c'], SPLIT_SAME), [['a', 'b', 'c']])
    assert.deepEqual(splitPicks(['a', 'b', 'c'], SPLIT_AB), [['a', 'c'], ['b']])
    assert.deepEqual(splitPicks(['a', 'b', 'c', 'd', 'e'], SPLIT_AB), [['a', 'c', 'e'], ['b', 'd']])
  })

  it('machinesPlan: names, spacing, A/B alternating days; one day is always one workout', () => {
    const picks = ['a', 'b', 'c']
    assert.deepEqual(machinesPlan({ days: 2, split: SPLIT_SAME, picks }), {
      routines: [{ name: 'Workout', picks }],
      week: [[1, 0], [4, 0]],
    })
    assert.deepEqual(machinesPlan({ days: 4, split: SPLIT_AB, picks }), {
      routines: [{ name: 'Workout A', picks: ['a', 'c'] }, { name: 'Workout B', picks: ['b'] }],
      week: [[1, 0], [2, 1], [4, 0], [5, 1]],
    })
    assert.deepEqual(machinesPlan({ days: 1, split: SPLIT_AB, picks }).routines.map((r) => r.name), ['Workout'])
  })
})

describe('req-190 AC1 — a new plan starts today (today injected)', () => {
  const expected = {
    // Tuesday: 2 → today, +3; 3 → today, +2, +4; 4 → today, +1, +3, +4.
    tue: { 1: [2], 2: [2, 5], 3: [2, 4, 6], 4: [2, 3, 5, 6] },
    // Saturday wraps past Sunday.
    sat: { 1: [6], 2: [6, 2], 3: [6, 1, 3], 4: [6, 0, 2, 3] },
  }
  for (const [label, today] of [['tue', TUESDAY], ['sat', SATURDAY]]) {
    for (const days of [1, 2, 3, 4]) {
      it(`${days} day(s), today ${label}: ${expected[label][days].join(', ')}`, () => {
        const shifted = startTodayWeek(PLAN_TEMPLATES[days].week, today)
        assert.deepEqual(shifted.map(([weekday]) => weekday), expected[label][days])
        assert.deepEqual(shifted.map(([, r]) => r), PLAN_TEMPLATES[days].week.map(([, r]) => r), 'routine order kept')
      })
    }
  }
})

describe('req-190 — planToState, machines first', () => {
  it('2 days, same: one "Workout" with the picks, Tue + Fri; a library pick becomes one record', () => {
    const legPress = library.find((e) => e.id === 'Leg_Press') || library.find((e) => /leg press/i.test(e.name))
    const data = catalogItemToExercise(legPress)
    const picks = [{ kind: 'library', data, item: pickerItem([], data).item }, own('ex-chest'), own('ex-lat')]
    const choices = { days: 2, split: SPLIT_SAME, picks }
    const { state, scheduled } = planToState(base(), choices, idsFor(choices))
    assert.equal(scheduled, true)
    assert.deepEqual(state.routines.map((r) => r.name), ['Workout'])
    const created = state.exercises.find((ex) => ex.libraryId === legPress.id)
    assert.deepEqual(state.routines[0].exercises.map((i) => i.exerciseId), [created.id, 'ex-chest', 'ex-lat'])
    assert.deepEqual(week(state), [[2, 'Workout'], [5, 'Workout']])
    assert.equal(state.schedule.loopWeeks, 1)
  })

  it('2 days, A/B: A = 1st + 3rd, B = 2nd; Tue A, Fri B', () => {
    const choices = { days: 2, split: SPLIT_AB, picks: [own('lp'), own('cp'), own('lat')] }
    const { state } = planToState(base(), choices, idsFor(choices))
    assert.deepEqual(state.routines.map((r) => [r.name, r.exercises.map((i) => i.exerciseId)]), [
      ['Workout A', ['lp', 'lat']],
      ['Workout B', ['cp']],
    ])
    assert.deepEqual(week(state), [[2, 'Workout A'], [5, 'Workout B']])
  })

  it('4 days A/B from Saturday: Sat A, Sun B, Tue A, Wed B', () => {
    const choices = { days: 4, split: SPLIT_AB, picks: [own('a'), own('b')] }
    const { state } = planToState(base(), choices, idsFor(choices, SATURDAY))
    assert.deepEqual(week(state), [[6, 'Workout A'], [0, 'Workout B'], [2, 'Workout A'], [3, 'Workout B']])
  })

  it('a schedule with days: routines added, schedule deep-equal to before', () => {
    const before = { ...base(), schedule: { loopWeeks: 2, anchor: '2026-09-07', slots: [{ id: 's0', week: 1, weekday: 3, routineId: 'r0' }] } }
    const choices = { days: 3, split: SPLIT_SAME, picks: [own('a')] }
    const { state, scheduled } = planToState(before, choices, idsFor(choices))
    assert.equal(scheduled, false)
    assert.deepEqual(state.schedule, before.schedule)
    assert.deepEqual(state.routines.map((r) => r.name), ['Workout'])
  })

  it('no picks → state unchanged', () => {
    const before = base()
    const choices = { days: 2, split: SPLIT_SAME, picks: [] }
    assert.deepEqual(planToState(before, choices, idsFor(choices)).state, before)
  })
})

describe('req-190 AC1 — planToState, template with an empty day', () => {
  const squat = library.find((e) => e.staple && e.pattern === 'squat')
  const data = catalogItemToExercise(squat)
  const lib = { kind: 'library', data, item: pickerItem([], data).item }
  const fills = [[lib, own('bench'), null, null], [null, null, null, null]]

  it('emptyPlanDays: B; none when nothing is chosen at all', () => {
    assert.deepEqual(emptyPlanDays({ days: 2, fills }), [1])
    assert.deepEqual(emptyPlanDays({ days: 2, fills: [[null], [null]] }), [])
    assert.deepEqual(emptyPlanDays({ days: 3, fills: [[], [own('x')], []] }), [0, 2])
  })

  it('"Same as Full body A" → B made with A\'s picks (one exercise record), Tue A + Fri B', () => {
    const choices = { days: 2, fills, empty: 'same' }
    const { state } = planToState(base(), choices, idsFor(choices))
    assert.deepEqual(state.routines.map((r) => r.name), ['Full body A', 'Full body B'])
    const [a, b] = state.routines
    assert.deepEqual(b.exercises.map((i) => i.exerciseId), a.exercises.map((i) => i.exerciseId))
    assert.equal(state.exercises.filter((ex) => ex.libraryId === squat.id).length, 1)
    assert.notEqual(a.exercises[0].id, b.exercises[0].id, 'B has its own items')
    assert.deepEqual(week(state), [[2, 'Full body A'], [5, 'Full body B']])
  })

  it('"Leave it out" → A only, today only — the same state as an unanswered (pre-req-190) save', () => {
    const left = { days: 2, fills, empty: 'leave' }
    const plain = { days: 2, fills }
    const ids = planIds(left, uid, TUESDAY)
    const one = planToState(base(), left, ids()).state
    assert.deepEqual(one.routines.map((r) => r.name), ['Full body A'])
    assert.deepEqual(week(one), [[2, 'Full body A']])
    assert.deepEqual(planToState(base(), plain, ids()).state, one)
  })

  it('day A left out: the first kept day is today (B on Tuesday, not Friday)', () => {
    const choices = { days: 2, fills: [[null], [own('dl')]], empty: 'leave' }
    const { state } = planToState(base(), choices, idsFor(choices))
    assert.deepEqual(week(state), [[2, 'Full body B']])
  })
})

describe('req-190 AC6 — the picker bar never covers the last row (CSS)', () => {
  // req-198 (DEC-112) — the dock is gone: the reserve is the bottom safe area + the bar
  // (was --ui-dock-clear + the bar).
  it('a page holding a sticky picker bar reserves the bottom clearance + bar as scroll padding', () => {
    const css = readFileSync(new URL('./ui/ui.css', import.meta.url), 'utf8')
    assert.match(css, /html:has\(\.ui-picker-bar\)\s*\{\s*scroll-padding-bottom: calc\(var\(--ui-bottom-clear\) \+ var\(--ui-tap\)/)
  })
})

// ---- rendered, real store ----

let view
afterEach(async () => {
  await view?.unmount()
  view = null
  if (getPendingConfirm()) answerConfirm(null)
})
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
const box = (prefix) =>
  view.all('label.ui-check').find((node) => node.textContent.trim().startsWith(prefix))?.querySelector('input') ?? null
const link = (text) => view.all('a').find((a) => a.textContent.trim() === text)
const seeded = () => ({
  ...emptyState(),
  exercises: [
    { id: 'ex-lp', name: 'Leg Press', type: 'machine', equipment: 'Machine', libraryId: 'Leg_Press' },
    { id: 'ex-cp', name: 'Chest Press', type: 'machine', equipment: 'Machine' },
    { id: 'ex-lat', name: 'Lat Pulldown', type: 'machine', equipment: 'Cable' },
  ],
})
async function harness(component, hash, state = seeded()) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v9', JSON.stringify(state))
  const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
  const views = await importJsx('./views/Plan.jsx', import.meta.url)
  window.location.hash = hash
  view = await render(h(StoreProvider, null, h(views[component])))
  await act(async () => {
    await loadExerciseCatalog()
  })
  await flush()
  return state
}
async function tap(node) {
  await view.click(node)
  await flush()
}
async function tickThree() {
  for (const name of ['Leg Press', 'Chest Press', 'Lat Pulldown']) await view.click(box(`${name} — `))
  await tap(view.button('Next (3)'))
}
const radio = (text) => view.all('label.ui-check').find((node) => node.textContent.trim() === text).querySelector('input')
const segment = (text) => view.all('.ui-seg__item').find((node) => node.textContent.trim() === text)

describe('req-190 — machines-first flow (rendered)', () => {
  it('pick 3 → 2 days → A/B → Save: Workout A (LP, Lat), Workout B (CP); today first', async () => {
    await harness('RoutineMachines', '#/routines/new/machines')
    assert.match(view.text(), /Which exercises do you do\?/)
    await tickThree()
    assert.equal(window.location.hash, '#/routines/new/machines/days')
    assert.equal(view.button('Save').disabled, true, 'no days chosen yet')
    await tap(segment('2'))
    // req-210 test edit: no chip is pre-picked (DEC-117 §6) — Save stays disabled until the test
    // ticks today and today + 3 itself (the days this test used to get preselected).
    assert.equal(view.button('Save').disabled, true, 'no day pre-picked')
    const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const now = new Date().getDay()
    await tap(segment(SHORT[now]))
    await tap(segment(SHORT[(now + 3) % 7]))
    assert.equal(radio('Same workout every time').checked, true, 'Same is the default')
    await tap(radio('Two workouts, A and B'))
    await tap(view.button('Save'))
    const after = stored()
    // req-207 test edit: the names are the setup's prefilled "New workout #1/#2" (DEC-116, were
    // "Workout A/B"), and the days are the preselected chips (today, +3), stored in Mon–Sun order
    // (req-207 §1) — so compared as a set, not in today-first order.
    assert.deepEqual(after.routines.map((r) => [r.name, r.exercises.map((i) => i.exerciseId)]), [
      ['New workout #1', ['ex-lp', 'ex-lat']],
      ['New workout #2', ['ex-cp']],
    ])
    const today = new Date().getDay()
    assert.deepEqual(after.schedule.slots.map((s) => s.weekday).sort(), [today, (today + 3) % 7].sort())
    assert.equal(window.location.hash, '#/')
  })

  it('Back from the days step keeps the ticks; Cancel at the days step writes nothing', async () => {
    const state = await harness('RoutineMachines', '#/routines/new/machines')
    await tickThree()
    await tap(segment('3'))
    window.location.hash = '#/routines/new/machines'
    await flush()
    assert.equal(box('Leg Press — ').checked, true, 'ticks kept')
    assert.equal(view.button('Next (3)').disabled, false)
    await tap(view.button('Next (3)'))
    await tap(link('Cancel'))
    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(state), 'v9 unchanged')
  })

  it('one pick: no A/B choice offered', async () => {
    await harness('RoutineMachines', '#/routines/new/machines')
    await view.click(box('Leg Press — '))
    await tap(view.button('Next (1)'))
    await tap(segment('2'))
    assert.equal(view.text().includes('Two workouts, A and B'), false)
  })
})

describe('req-190 AC4 — template flow, empty day B (rendered)', () => {
  async function fillAOnly() {
    const state = await harness('RoutinePlan', '#/routines/new/plan/2', seeded())
    // A's Squat = Leg Press (an own exercise whose libraryId is a squat-pattern entry).
    const section = view.all('section').find((node) => node.querySelector(':scope > h2')?.textContent === 'Full body A')
    await tap(section.querySelectorAll('a')[0])
    await act(async () => {
      await loadExerciseCatalog()
    })
    await flush()
    await view.type(view.input('Search'), 'Leg Press')
    await view.click(box('Leg Press — Machine'))
    await tap(view.button('Use'))
    await tap(view.button('Save'))
    return state
  }

  it('the sheet appears and nothing is saved until it is answered; Back saves nothing', async () => {
    const state = await fillAOnly()
    const sheet = getPendingConfirm()
    assert.equal(sheet.title, 'Full body B has no exercises.')
    assert.match(sheet.message, /Leave it out and your week has no Full body B day/)
    assert.deepEqual(sheet.choices.map((c) => c.label), ['Leave it out', 'Same as Full body A'])
    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(state))
    answerConfirm(null)
    await flush()
    assert.equal(localStorage.getItem('workout-mvp-v9'), JSON.stringify(state), 'Back: nothing saved')
    assert.equal(view.button('Save').disabled, false, 'Save usable again')
  })

  it('Leave it out → 1 routine; Same as A → 2, B = A', async () => {
    await fillAOnly()
    answerConfirm('leave')
    await flush()
    assert.deepEqual(stored().routines.map((r) => r.name), ['Full body A'])
    await view.unmount()
    view = null
    await fillAOnly()
    answerConfirm('same')
    await flush()
    const routines = stored().routines
    assert.deepEqual(routines.map((r) => [r.name, r.exercises.map((i) => i.exerciseId)]), [
      ['Full body A', ['ex-lp']],
      ['Full body B', ['ex-lp']],
    ])
  })
})

describe('req-190 — /routines/new', () => {
  it('"Pick your exercises" is the primary start', async () => {
    localStorage.clear()
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { RoutineNew } = await importJsx('./views/Routine.jsx', import.meta.url)
    view = await render(h(StoreProvider, null, h(RoutineNew)))
    const primary = view.all('a').filter((a) => a.className.includes('primary')).map((a) => a.textContent.trim())
    assert.deepEqual(primary, ['Pick your exercises'])
    assert.equal(link('Not sure? Use a plan').getAttribute('href'), '#/routines/new/plan')
  })
})
