// req-202 — small cuts from the organisation review. Each item is independent; the screens
// are rendered as the whole App under happy-dom (test-support/render.js), as in req-198–201.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { routineItemMeta, formatSetLine, WITH_WARMUP } from './ids.js'
import { historyGroupMeta } from './views/history/helpers.js'
import { applyBackup } from './exchange.js'
import * as route from './route.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(here, path), 'utf8')
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const seed = JSON.parse(read('db.json'))

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

async function open(hash, data = seed) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  if (data) localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = `#${hash}`
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const squash = (text) => text.replace(/\s+/g, '')
const link = (text) => view.all('a').find((a) => squash(a.textContent) === squash(text)) ?? null
const backHref = () => link('‹ Back')?.getAttribute('href') ?? null
const buttons = (label) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === label)
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
async function tap(node) {
  await view.click(node)
  await flush()
}
const upperOrder = () => stored().routines.find((r) => r.id === 'sess-upper').exercises.map((e) => e.exerciseId)

describe('item 1 — routine detail: Up/Down behind "Reorder"', () => {
  it('no Up/Down until Reorder; the toggle reads Done; a move persists; Done hides them again', async () => {
    await open('/routines/sess-upper')
    assert.equal(buttons('Up').length + buttons('Down').length, 0, 'no Up/Down at first')
    assert.equal(buttons('Reorder').length, 1)
    await tap(buttons('Reorder')[0])
    assert.equal(buttons('Up').length, 9)
    assert.equal(buttons('Down').length, 9)
    assert.equal(buttons('Done').length, 1)
    assert.equal(buttons('Reorder').length, 0)
    const before = upperOrder()
    await tap(buttons('Down')[0])
    const after = upperOrder()
    assert.deepEqual(after, [before[1], before[0], ...before.slice(2)], 'first two swapped in v9')
    assert.equal(buttons('Up').length, 9, 'still reordering after a move')
    await tap(buttons('Done')[0])
    assert.equal(buttons('Up').length + buttons('Down').length, 0)
    assert.deepEqual(upperOrder(), after, 'Done commits nothing further')
  })

  it('a workout with fewer than two exercises has no Reorder (nothing to reorder)', async () => {
    const routines = seed.routines.map((r) => (r.id === 'sess-upper' ? { ...r, exercises: r.exercises.slice(0, 1) } : r))
    await open('/routines/sess-upper', { ...seed, routines })
    assert.equal(buttons('Reorder').length, 0)
  })
})

describe('item 2 — in-workout back link reads the workout name', () => {
  it('the log screen and the done screen link "‹ Upper Body" to the overview', async () => {
    await open('/routines')
    await tap(buttons('Start')[0])
    assert.equal(window.location.hash, '#/workout/sess-upper')
    const item = view.all('a').find((a) => /\/workout\/sess-upper\/item\//.test(a.getAttribute('href') || ''))
    assert.ok(item, 'an exercise row on the overview')
    await tap(item)
    const back = link('‹ Upper Body')
    assert.ok(back, `back link names the workout: ${view.text().slice(0, 80)}`)
    assert.equal(back.getAttribute('href'), '#/workout/sess-upper')
    assert.equal(link('‹ Exercises'), null)
  })

  it('source: ExercisesLink falls back to "Workout", never "Exercises"', () => {
    const shared = read('views/shared.jsx')
    assert.match(shared, /\{name \|\| 'Workout'\}/)
    assert.equal((read('views/workout/item.jsx').match(/<ExercisesLink routineId=\{routineId\} name=\{active\.snapshot\?\.routineName\} \/>/g) || []).length, 2)
  })
})

describe('item 3 — an item\'s warm-up flag reads "with warm-up"', () => {
  it('routine row meta, History row meta; a real warm-up set keeps "Warm-up set"', () => {
    assert.equal(WITH_WARMUP, 'with warm-up')
    assert.equal(routineItemMeta({ warmup: { reps: 12 }, sets: 3 }), 'with warm-up · 3 sets')
    assert.equal(historyGroupMeta({ role: 'main', warmup: { reps: 12 } }, 4), 'with warm-up · 4 sets')
    assert.equal(formatSetLine({ setType: 'wu', weight: 10, reps: '12' }), 'Warm-up set · 10 kg × 12') // req-209 test edit: one set format "{kg} kg × {reps}" (§3), was " · "
  })

  it('History exercise header: "with warm-up · {date}"', async () => {
    const workout = seed.workouts.find((w) => w.snapshot.items.some((i) => i.exerciseId === 'ex-chest-press' && i.warmup))
    await open(`/history/${workout.id}/exercise/ex-chest-press`)
    const sub = view.container.querySelector('.ui-title + .ui-sub')?.textContent
    assert.match(sub, /^with warm-up · /)
    assert.doesNotMatch(sub, /Warm-up set/)
  })

  it('routine detail and the workout overview rows', async () => {
    await open('/routines/sess-upper')
    assert.match(view.text(), /with warm-up · 3 × /) // req-209 test edit: the row shows the plan (§5), was '3 sets'
    assert.doesNotMatch(view.text(), /Warm-up set/)
    await open('/workout/sess-upper')
    assert.match(view.text(), / · with warm-up/)
    assert.doesNotMatch(view.text(), /Warm-up set/)
  })
})

describe('item 4 — first setup (no bar exists since req-198)', () => {
  for (const hash of ['/routines/new', '/routines/new/plan', '/routines/new/machines']) {
    it(`${hash}: no bottom bar; Back works`, async () => {
      await open(hash, null)
      assert.equal(document.querySelectorAll('.ui-dock, nav[aria-label="Primary"]').length, 0)
      assert.ok(backHref(), 'a Back link')
      await tap(link('‹ Back'))
      assert.notEqual(window.location.hash, `#${hash}`)
    })
  }
})

describe('item 5 — routine detail: "Edit ›" sits in the title row', () => {
  it('Edit is beside the h1, before the Exercises section', async () => {
    await open('/routines/sess-upper')
    const row = view.container.querySelector('.ui-split-row--title')
    assert.ok(row)
    assert.equal(row.querySelector('h1.ui-title')?.textContent, 'Upper Body')
    assert.equal(squash(row.querySelector('a').textContent), squash('Edit ›'))
    assert.equal(row.querySelector('a').getAttribute('href'), '#/routines/sess-upper/edit')
  })

  it('a slot\'s detail keeps its weekday meta under the title', async () => {
    await open('/schedule/0/1/slot-sess-upper')
    assert.ok(view.container.querySelector('.ui-split-row--title a'))
    assert.equal(view.container.querySelector('.ui-split-row--title + .ui-sub')?.textContent, 'Monday')
  })
})

describe('item 6 — the dead bottom bar is deleted', () => {
  it('BottomMenu.jsx, its test and activeTab are gone; no .ui-dock CSS', () => {
    assert.equal(existsSync(join(here, 'ui/BottomMenu.jsx')), false)
    assert.equal(existsSync(join(here, 'ui/BottomMenu.test.js')), false)
    assert.equal('activeTab' in route, false)
    assert.doesNotMatch(read('ui/ui.css'), /\.ui-dock\b/)
  })
})

describe('item 7 — slot Back from a Home-opened day ends on Home', () => {
  it('Home day → slot → Back → the day (?from=/) → Back → Home', async () => {
    await open('/schedule/0/1?from=%2F')
    const slot = link('Upper Body')
    assert.equal(slot.getAttribute('href'), `#${route.childLink('/schedule/0/1/slot-sess-upper', '/schedule/0/1', '/')}`)
    await tap(slot)
    assert.equal(backHref(), '#/schedule/0/1?from=%2F')
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/schedule/0/1?from=%2F')
    await tap(link('‹ Back'))
    assert.equal(window.location.hash, '#/')
  })

  it('from /schedule nothing changes: the slot goes back to the bare day', async () => {
    await open('/schedule/0/1')
    assert.equal(link('Upper Body').getAttribute('href'), '#/schedule/0/1/slot-sess-upper')
    await tap(link('Upper Body'))
    assert.equal(backHref(), '#/schedule/0/1')
  })

  it('a `from` that is not this slot\'s day is ignored (Back = the day)', async () => {
    await open(`/schedule/0/1/slot-sess-upper?from=${encodeURIComponent('/history')}`)
    assert.equal(backHref(), '#/schedule/0/1')
  })
})

describe('item 8 — wording', () => {
  it('Home\'s rest-day link reads "Start a workout"', () => {
    assert.match(read('views/Today.jsx'), /block>\s*Start a workout\s*<\/NavLink>/)
    assert.doesNotMatch(read('views/Today.jsx'), /Start a session/)
  })

  it('the import summary counts scheduled days (distinct week/weekday), not slots', () => {
    const state = {
      ...seed,
      schedule: {
        ...seed.schedule,
        slots: [...seed.schedule.slots, { id: 'slot-extra', week: 0, weekday: 1, routineId: 'sess-lower' }],
      },
    }
    const { summary } = applyBackup(state)
    assert.equal(summary.slots, 4)
    assert.equal(summary.scheduledDays, 3)
    assert.match(read('views/Settings.jsx'), /\$\{summary\.scheduledDays\} scheduled days\./)
  })
})
