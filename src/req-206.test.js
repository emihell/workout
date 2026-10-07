// req-206 — Home: "Schedule ›" is the same NavLink as "Workouts ›" (not a Row in a List), the
// "Coming up" header is gone, and first-run Home's "History" row is "Schedule" (DEC-115).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { act, importJsx, render } from './test-support/render.js'

const here = dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(readFileSync(join(here, 'db.json'), 'utf8'))
const h = React.createElement
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const squash = (text) => text.replace(/\s+/g, '')

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

async function open(data) {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  if (data) localStorage.setItem('workout-mvp-v8', JSON.stringify(data))
  window.location.hash = '#/'
  const { default: App } = await importJsx('./App.jsx', import.meta.url)
  view = await render(h(App))
  await flush()
}
const link = (text) => view.all('a').find((a) => squash(a.textContent) === squash(text)) ?? null

describe('req-206 Home', () => {
  it('AC1 "Workouts ›" and "Schedule ›" share tag, classes and wrapper; no "Coming up" header', async () => {
    await open(seed)
    const workouts = link('Workouts›')
    const sched = link('Schedule›')
    assert.ok(workouts && sched)
    assert.equal(sched.tagName, workouts.tagName)
    assert.equal(sched.className, workouts.className)
    assert.equal(sched.innerHTML.replace('Schedule', 'X'), workouts.innerHTML.replace('Workouts', 'X'), 'same inner markup (chevron)')
    assert.equal(sched.parentElement.tagName, 'P')
    assert.equal(workouts.parentElement.tagName, 'P')
    assert.equal(sched.getAttribute('href'), '#/schedule')
    assert.equal(sched.closest('.ui-list'), null, 'not a list row')
    assert.doesNotMatch(view.text(), /Coming up/)
    assert.equal(view.container.querySelector('.ui-home-bottom .ui-section'), null)
    // the 6 day rows' list follows the "Workouts ›" paragraph directly
    assert.equal(workouts.parentElement.nextElementSibling.className, 'ui-list')
    assert.equal(workouts.parentElement.nextElementSibling.querySelectorAll('a.ui-row__link').length, 6)
  })

  it('AC3 first-run Home shows "Schedule ›" (→ /schedule), not "History"', async () => {
    await open(null)
    assert.match(view.text(), /Nothing here yet\./)
    const sched = link('Schedule›')
    assert.ok(sched)
    assert.equal(sched.getAttribute('href'), '#/schedule')
    assert.ok(sched.classList.contains('ui-row__link'), 'consistent with first-run "Workouts" (a Row)')
    assert.ok(link('Workouts›').classList.contains('ui-row__link'))
    assert.equal(link('History›'), null)
    assert.doesNotMatch(view.text(), /History/)
  })
})
