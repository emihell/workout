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
