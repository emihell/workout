// req-263 (DEC-155 §6, over DEC-092's two "limits kept") — History's routine editor keeps the
// Back chain through its inner screens, and a History return helper drops a `from` that names
// a deleted workout. AC1 walks the whole App under happy-dom (Today's link in → an exercise → a
// set → Save → Update? → Workout → an exercise → Back until Today), reading each Back's href.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { parseRoute, withFrom } from './route.js'
import { answerConfirm } from './ui/confirm.js'
import { navForBase } from './views/routine-nav.js'
import {
  historyDetailBack,
  historyExerciseBack,
  historyRoutinePaths,
  historySetBack,
} from './views/history/return-paths.js'

const h = React.createElement
const here = dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))
const W = 'wo-w42-sess-upper'
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

async function open(path, data = seed) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${path}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const hashPath = () => window.location.hash.slice(1)
async function goTo(path) {
  await act(async () => {
    window.location.hash = `#${path}`
  })
  await flush()
}
const hrefOf = (a) => (a ? a.getAttribute('href').replace(/^#/, '') : null)
const links = () => view.all('a')
const linkText = (text) => links().find((a) => a.textContent.replace(/[›‹]/g, '').trim() === text) ?? null
const backHref = () => hrefOf(linkText('Back'))
const firstLink = (pattern) => links().find((a) => pattern.test(a.getAttribute('href') || '')) ?? null

// Today → the done workout → its first exercise → its first set → Save → Update? → Workout →
// the routine's first exercise. Returns every path visited (the links are the rendered hrefs).
async function walkIn() {
  const visited = []
  const start = withFrom(`/history/${W}`, '/') // Home's done-workout row (req-171 AC1)
  await open(start)
  visited.push(start)
  const exercise = hrefOf(firstLink(new RegExp(`^#/history/${W}/exercise/`)))
  await goTo(exercise)
  visited.push(exercise)
  const set = hrefOf(firstLink(new RegExp(`^#/history/${W}/set/\\d`)))
  await goTo(set)
  visited.push(set)
  await view.click(view.button('Save'))
  await flush()
  visited.push(hashPath())
  assert.equal(parseRoute(hashPath()).name, 'history-recalculate', 'Save after a set edit opens Update?')
  const routine = hrefOf(linkText('Workout'))
  await goTo(routine)
  visited.push(routine)
  const item = hrefOf(firstLink(new RegExp(`^#/history/${W}/routine/exercise/(?!new\\b|create\\b)`)))
  await goTo(item)
  visited.push(item)
  return visited
}

// Press Back `count` times; the path after each.
async function backTimes(count) {
  const backs = []
  for (let i = 0; i < count; i += 1) {
    const to = backHref()
    backs.push(to)
    await goTo(to)
  }
  return backs
}

describe('req-263 AC1 — the chain through Update? → Workout → an exercise ends on Today', () => {
  it('each Back unwinds one step; the last lands on /', async () => {
    const visited = await walkIn()
    const backs = await backTimes(4)
    for (const path of visited) console.log(`in   ${path}`)
    for (const path of backs) console.log(`Back ${path}`)
    assert.deepEqual(
      backs.map((path) => parseRoute(path).name),
      ['history-routine', 'history-recalculate', 'history-detail', 'today'],
    )
    assert.equal(backs.at(-1), '/')
  })
})

// ── AC2: every inner exit lands on the routine screen *with* its from ───────────────────
// The routine screen as the recalc links it when the recalc was itself opened (via the
// workout) from Today: its own Back is the recalc with its from.
const RECALC = withFrom(`/history/${W}/recalculate`, withFrom(`/history/${W}`, '/'))
const ROUTINE = withFrom(`/history/${W}/routine`, RECALC)
const ITEM = 'si-sess-upper-1-ex-chest-press'

async function fromRoutine() {
  await open(ROUTINE)
  assert.equal(backHref(), RECALC, 'the routine screen Backs to the recalc with its from')
}
async function follow(a) {
  assert.ok(a, 'link present')
  await goTo(hrefOf(a))
}
async function landedOnRoutine(label) {
  assert.equal(hashPath(), ROUTINE, `${label} → the routine screen with its from`)
  assert.equal(backHref(), RECALC, `${label} → whose Back is the recalc with its from`)
  console.log(`${label.padEnd(30)} → ${parseRoute(hashPath()).name} (from ${parseRoute(parseRoute(hashPath()).from).name}); its Back → ${parseRoute(backHref()).name} from=${parseRoute(backHref()).from}`)
}
const itemLink = () => firstLink(new RegExp(`^#/history/${W}/routine/exercise/${ITEM}(\\?|$)`))
const cancelHref = () => hrefOf(linkText('Cancel'))

describe('req-263 AC2 — every inner exit returns to the routine with its from', () => {
  it('item Save', async () => {
    await fromRoutine()
    await follow(itemLink())
    await view.click(view.button('Save'))
    await flush()
    await landedOnRoutine('item Save')
  })

  it('item Cancel and Back', async () => {
    await fromRoutine()
    await follow(itemLink())
    assert.equal(backHref(), ROUTINE)
    await goTo(cancelHref())
    await landedOnRoutine('item Cancel')
  })

  it('item Remove (confirmed)', async () => {
    await fromRoutine()
    await follow(itemLink())
    await view.click(view.button('Remove'))
    await act(async () => answerConfirm(true))
    await flush()
    await landedOnRoutine('item Remove')
    const stored = JSON.parse(localStorage.getItem('workout-mvp-v9'))
    assert.ok(!stored.routines.find((r) => r.id === 'sess-upper').exercises.some((x) => x.id === ITEM), 'removed')
  })

  it('Change exercise: pick → the item (with its chain) → Back → the routine; Cancel likewise', async () => {
    await fromRoutine()
    await follow(itemLink())
    const itemPath = hashPath()
    await follow(linkText('Change exercise'))
    assert.equal(backHref(), itemPath, 'change Back → the item with its chain')
    assert.equal(cancelHref(), itemPath, 'change Cancel → the item with its chain')
    await view.click(view.all('input[type=checkbox]')[0])
    await view.click(view.button('Change'))
    await flush()
    assert.equal(hashPath(), itemPath, 'Change → the item with its chain')
    await goTo(backHref())
    await landedOnRoutine('Change exercise → item Back')
    await follow(itemLink())
    await follow(linkText('Change exercise'))
    await goTo(cancelHref())
    assert.equal(hashPath(), itemPath)
    await goTo(backHref())
    await landedOnRoutine('Change Cancel → item Back')
  })

  it('Add exercise: Add 1 and Cancel', async () => {
    await fromRoutine()
    await follow(linkText('Add exercise'))
    assert.equal(backHref(), ROUTINE)
    await view.click(view.all('input[type=checkbox]')[0])
    await view.click(view.button('Add 1'))
    await flush()
    await landedOnRoutine('Add exercise → Add 1')
    await follow(linkText('Add exercise'))
    await goTo(cancelHref())
    await landedOnRoutine('Add exercise → Cancel')
  })

  it('Add exercise → Create exercise → Add manually → Save → the new item → Save', async () => {
    await fromRoutine()
    await follow(linkText('Add exercise'))
    const pick = hashPath()
    await follow(linkText('Create exercise'))
    assert.equal(backHref(), pick, 'create hub Back → the picker with its chain')
    const hub = hashPath()
    await follow(linkText('Add manually'))
    assert.equal(backHref(), hub, 'manual Back → the hub with its chain')
    assert.equal(cancelHref(), hub)
    await view.type(view.input('Name'), 'Req263 Press')
    await view.click(view.button('Save'))
    await flush()
    assert.equal(parseRoute(hashPath()).screen, 'exercise-new')
    assert.equal(backHref(), pick, 'new item Back → the picker with its chain')
    await view.click(view.button('Save'))
    await flush()
    await landedOnRoutine('Create → new item Save')
  })

  it('routine Edit: Save and Cancel', async () => {
    await fromRoutine()
    await follow(linkText('Edit'))
    assert.equal(backHref(), ROUTINE)
    await view.click(view.button('Save'))
    await flush()
    await landedOnRoutine('Edit Save')
    await follow(linkText('Edit'))
    await goTo(cancelHref())
    await landedOnRoutine('Edit Cancel')
  })
})

// ── AC3: the three flows with no `from` are byte-identical to main ───────────────────────
// navForBase as it is on main (de980bb), verbatim, as the oracle.
function mainNavForBase(base, done, { extra = null, showDelete = true, showDays = true } = {}) {
  return {
    base,
    done,
    extra,
    showDelete,
    showDays,
    edit: `${base}/edit`,
    pick: `${base}/exercise/new`,
    create: `${base}/exercise/create`,
    createManual: `${base}/exercise/create/manual`,
    createSearch: `${base}/exercise/create/search`,
    newItem: (exerciseId) => `${base}/exercise/new/${exerciseId}`,
    item: (itemId) => `${base}/exercise/${itemId}`,
    change: (itemId) => `${base}/exercise/${itemId}/change`,
  }
}
// Every string a route set yields. The inner exits (Back/Cancel/Save/Remove/Add) read `up` on
// the branch and read `base` on main (Routine.jsx), so `exit` is that one.
const flatten = (nav, exit) => ({
  base: nav.base,
  done: nav.done,
  extra: nav.extra,
  showDelete: nav.showDelete,
  showDays: nav.showDays,
  exit,
  edit: nav.edit,
  pick: nav.pick,
  create: nav.create,
  createManual: nav.createManual,
  createSearch: nav.createSearch,
  newItem: nav.newItem('ex-1'),
  item: nav.item('it-1'),
  change: nav.change('it-1'),
})

describe('req-263 AC3 — routine, schedule-slot and workout-setup paths unchanged', () => {
  // the arguments each caller passes (Routine.jsx pathsFor, Schedule.jsx ScheduleSlot, workout/setup.jsx)
  const flows = {
    routine: ['/routines/r1', '/routines', undefined],
    'schedule-slot': ['/schedule/0/3/slot-1@2026-10-29', '/schedule/0/3', { extra: 'Wed' }],
    'workout-setup': ['/workout/r1/slot-1/2026-10-29/setup', '/workout/r1/slot-1/2026-10-29', { showDelete: false, showDays: false }],
  }
  for (const [name, [base, done, options]] of Object.entries(flows)) {
    it(name, () => {
      const branch = navForBase(base, done, options)
      const main = mainNavForBase(base, done, options)
      assert.deepEqual(flatten(branch, branch.up), flatten(main, main.base))
      // the create screens' paths (Exercises.jsx createPaths with `nav`) equal its returnBase ones
      assert.deepEqual(
        [branch.create, branch.pick, branch.createManual, branch.createSearch, branch.newItem('ex-1')],
        [`${base}/exercise/create`, `${base}/exercise/new`, `${base}/exercise/create/manual`, `${base}/exercise/create/search`, `${base}/exercise/new/ex-1`],
      )
    })
  }
})

// ── AC4: a stale from falls back ──────────────────────────────────────────────────────
describe('req-263 AC4 — a from naming a deleted workout falls back to the fixed parent', () => {
  const workouts = [{ id: 'A' }, { id: 'B' }]
  const afterDelete = [{ id: 'A' }]

  it('/history/A/exercise/i?from=/history/B: B deleted → /history/A; B there → /history/B', () => {
    const route = parseRoute(withFrom('/history/A/exercise/i', '/history/B'))
    assert.equal(route.from, '/history/B')
    assert.equal(historyExerciseBack('A', route.from, afterDelete), '/history/A')
    assert.equal(historyExerciseBack('A', route.from, workouts), '/history/B')
  })

  it('each History route that names a workout is checked; a from naming no workout passes through', () => {
    const stale = ['/history/B', '/history/B/exercise/i', '/history/B/set/0', '/history/B/edit', '/history/B/recalculate', '/history/B/routine', '/history/B/routine/exercise/i']
    for (const from of stale) {
      assert.equal(historyDetailBack(from, afterDelete), '/history', from)
      assert.equal(historySetBack('A', 'i', from, afterDelete), '/history/A/exercise/i', from)
      assert.equal(historyDetailBack(from, workouts), from, `${from} kept while B exists`)
    }
    for (const from of ['/', '/history', '/history/month/2026-10', '/history/exercise/ex-1', '/workout/r1']) {
      assert.equal(historyDetailBack(from, afterDelete), from, `${from} names no workout`)
    }
  })

  it('rendered: B deleted → the exercise screen Back is /history/A (not "Not found."); B kept → /history/B', async () => {
    const [a, b] = seed.workouts
    const set = a.sets[0]
    const path = withFrom(`/history/${a.id}/exercise/${set.itemId || set.exerciseId}`, `/history/${b.id}`)
    await open(path, { ...seed, workouts: seed.workouts.filter((w) => w.id !== b.id) })
    assert.equal(backHref(), `/history/${a.id}`)
    await goTo(backHref())
    assert.doesNotMatch(view.text(), /Not found\./)
    console.log(`stale: ${path} → Back ${hashPath()} (${parseRoute(hashPath()).name})`)
    await view.unmount()
    view = null
    await open(path)
    assert.equal(backHref(), `/history/${b.id}`)
    console.log(`live:  ${path} → Back ${backHref()}`)
  })
})

// ── AC5: no from — as today ───────────────────────────────────────────────────────────
describe('req-263 AC5 — a history routine screen opened with no from behaves as today', () => {
  it('every screen: Back → the bare recalc; inner links and exits are the plain paths', () => {
    const main = mainNavForBase(`/history/${W}/routine`, `/history/${W}/recalculate`, { showDelete: false, showDays: false })
    for (const screen of ['detail', 'exercise', 'edit', 'exercise-pick', 'exercise-change', 'exercise-new', 'exercise-create']) {
      const nav = historyRoutinePaths(W, screen, null, { workouts: seed.workouts })
      assert.deepEqual(flatten(nav, nav.up), flatten(main, main.base), screen)
    }
  })

  it('rendered: /history/W/routine → Back /history/W/recalculate; the item link is plain', async () => {
    await open(`/history/${W}/routine`)
    assert.equal(backHref(), `/history/${W}/recalculate`)
    assert.equal(hrefOf(itemLink()), `/history/${W}/routine/exercise/${ITEM}`)
    await follow(itemLink())
    assert.equal(backHref(), `/history/${W}/routine`)
  })
})
