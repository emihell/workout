// req-208 — the day screen's slot row: the name, Start now (when shown) and a "⋯" that opens
// the row menu (Change day · Remove · Cancel), as the in-workout list's "⋯" (req-188). Pure:
// slotMenuSheet. Rendered: the whole App under happy-dom (test-support/render.js), as req-203.
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'
import { addDays, dateKey } from './schedule.js'
import { answerConfirm, getPendingConfirm } from './ui/confirm.js'
import { slotMenuSheet } from './views/schedule-day.js'

const here = dirname(fileURLToPath(import.meta.url))
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

describe('slotMenuSheet (pure)', () => {
  it('titled with the workout, Change day then Remove', () => {
    assert.deepEqual(slotMenuSheet('Upper Body'), {
      title: 'Upper Body',
      choices: [
        { value: 'change', label: 'Change day' },
        { value: 'remove', label: 'Remove' },
      ],
    })
  })
})

// ── the whole App ───────────────────────────────────────────────────────────────────
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))
const NOW = new Date()
const TODAY_WD = NOW.getDay()
// one slot on today's weekday (1-week loop): today offers Start now, a week ago does not
function oneSlot() {
  return { ...seed, workouts: [], schedule: { loopWeeks: 1, anchor: seed.schedule.anchor, slots: [{ id: 's-1', week: 0, weekday: TODAY_WD, routineId: 'sess-upper' }] } }
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
const slotRow = () => [...document.querySelectorAll('li.ui-row')].find((li) => li.querySelector('.ui-row-menu')) ?? null
const rowButtons = () => [...slotRow().querySelectorAll('button')].map((b) => b.textContent.trim())
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label) ?? null
const stored = () => JSON.parse(localStorage.getItem('workout-mvp-v9'))
async function tap(node) {
  await view.click(node)
  await flush()
}

describe('the slot row', () => {
  it('today: the name, Start now and ⋯ — no Change day / Remove on the row', async () => {
    await open(`/schedule/0/${TODAY_WD}?from=%2F`, oneSlot())
    assert.match(slotRow().textContent, /Upper Body/)
    assert.deepEqual(rowButtons(), ['Start now', '⋯'])
    assert.equal(slotRow().querySelector('.ui-row-menu').getAttribute('aria-label'), 'Change day or remove Upper Body')
  })

  it('⋯ opens the menu: titled with the workout, Change day · Remove; Cancel writes nothing', async () => {
    await open(`/schedule/0/${TODAY_WD}?from=%2F`, oneSlot())
    const before = localStorage.getItem('workout-mvp-v9')
    await tap(button('⋯'))
    const pending = getPendingConfirm()
    assert.equal(pending.title, 'Upper Body')
    assert.deepEqual(pending.choices.map((c) => c.label), ['Change day', 'Remove'])
    await act(async () => answerConfirm(null))
    await flush()
    assert.equal(localStorage.getItem('workout-mvp-v9'), before)
  })

  it('⋯ → Remove → the unchanged confirm; Cancel there keeps the slot, Remove removes it', async () => {
    await open(`/schedule/0/${TODAY_WD}?from=%2F`, oneSlot())
    const day = new Date(2026, 0, 4 + TODAY_WD).toLocaleDateString('en-US', { weekday: 'long' }) // Jan 4 2026 is a Sunday
    await tap(button('⋯'))
    await tap(button('Remove'))
    assert.equal(getPendingConfirm().message, `Take Upper Body off ${day}s? Your history is kept.`)
    await act(async () => answerConfirm(false))
    await flush()
    assert.equal(stored().schedule.slots.length, 1)
    await tap(button('⋯'))
    await tap(button('Remove'))
    await tap([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Remove').at(-1))
    assert.deepEqual(stored().schedule.slots, [])
  })

  // req-211 test edit (DEC-117 §2): this screen is dated (`?date=` from Home), and a dated
  // Change day now moves that one date. The sheet's values are that week's date keys, so the
  // answer is the next date in the past date's Mon–Sun week (the previous one on a Sunday),
  // and the check is that it moved: the slot stays, one move names it. Was: the slot's weekday.
  it('failure case: a past date (no Start now) shows the name and ⋯ only, and ⋯ → Change day still moves it', async () => {
    const past = dateKey(addDays(NOW, -7))
    await open(`/schedule/0/${TODAY_WD}?date=${past}&from=%2F`, oneSlot())
    assert.match(slotRow().textContent, /Upper Body/)
    assert.deepEqual(rowButtons(), ['⋯'])
    await tap(button('⋯'))
    await tap(button('Change day'))
    const target = dateKey(addDays(past, TODAY_WD === 0 ? -1 : 1))
    await act(async () => answerConfirm(target))
    await flush()
    assert.deepEqual(stored().schedule.slots.map((s) => [s.week, s.weekday, s.routineId]), [[0, TODAY_WD, 'sess-upper']])
    assert.deepEqual(stored().schedule.moves.map(({ slotId, from, to }) => [slotId, from, to]), [['s-1', past, target]])
  })
})
