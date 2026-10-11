// req-220 — rendered: Backup & data shows "Export for your AI" with its how-to (no dev flag),
// and Keep my history through the REAL store (store.jsx applyBackup → commitBackup inside
// React's setState → saveState). One StoreProvider per test, never remounted (L-051).
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
import { act, importJsx, render } from './test-support/render.js'

const h = React.createElement
const KEY = 'workout-mvp-v9'
const fixture = () => JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'))
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

let view = null
afterEach(async () => {
  if (view) await view.unmount()
  view = null
})

function seed() {
  localStorage.clear()
  localStorage.setItem('workout-routine-kg-filled', '2026-09-26T00:00:00.000Z')
  localStorage.setItem(KEY, JSON.stringify({ ...fixture(), schemaVersion: 9, activeWorkout: null }))
}

describe('req-220 — Backup & data (rendered)', () => {
  it('"Export for your AI" and its 3-line how-to show without the dev flag; the checkbox is gone; the click downloads the file with the assistant', async () => {
    seed()
    const blobs = []
    const original = URL.createObjectURL
    URL.createObjectURL = (blob) => {
      blobs.push(blob)
      return 'blob:test'
    }
    // happy-dom follows a clicked <a download> as a navigation (a browser saves the file);
    // the download link's click is a no-op here, so the screen stays on Backup & data.
    const anchorClick = window.HTMLAnchorElement.prototype.click
    window.HTMLAnchorElement.prototype.click = () => {}
    try {
      window.location.hash = '#/settings'
      const { default: App } = await importJsx('./App.jsx', import.meta.url)
      const { AI_HOWTO } = await importJsx('./views/Settings.jsx', import.meta.url)
      view = await render(h(App))
      await flush()
      const text = view.text()
      assert.doesNotMatch(text, /Assistant prompt/)
      assert.equal(AI_HOWTO.split('\n').length, 3)
      for (const line of AI_HOWTO.split('\n')) assert.ok(text.includes(line), line)
      const labels = view.all('button').map((node) => node.textContent.trim())
      assert.ok(labels.indexOf('Back up now') < labels.indexOf('Export for your AI'), labels.join(' | '))
      await view.click(view.button('Export for your AI'))
      assert.match(view.text(), /Saved for your AI — workout-for-ai-\d{4}-\d{2}-\d{2}\.json/)
      assert.equal(blobs.length, 1)
      const pack = JSON.parse(await blobs[0].text())
      assert.equal(pack.kind, 'workout-mvp-backup')
      assert.ok(pack.assistant.fields.set.loggedAt)
      assert.equal(pack.state.workouts.length, 13)
    } finally {
      URL.createObjectURL = original
      window.HTMLAnchorElement.prototype.click = anchorClick
    }
  })
})

describe('req-220 — Keep my history through the real store', () => {
  it('the saved workouts stay byte-identical; routines come from the file', async () => {
    seed()
    const { StoreProvider } = await importJsx('./store.jsx', import.meta.url)
    const { useStore } = await import('./store-context.js')
    const { buildBackup } = await import('./exchange.js')
    const { importWithBackup } = await import('./import-backup.js')
    const captured = {}
    function Grab() {
      // A test harness reading the live store out of the tree (as req-176.test.js).
      // oxlint-disable-next-line react/immutability
      captured.store = useStore()
      return null
    }
    view = await render(h(StoreProvider, null, h(Grab)))
    await flush()
    // The device's history as the app holds it (loadState's migrated value; the seed is
    // saved raw, and the first write after load re-saves it in this shape anyway).
    const before = JSON.stringify(captured.store.workouts)
    const file = JSON.parse(JSON.stringify(buildBackup(captured.store, { includeAssistant: true })))
    file.state.workouts[0].sets[0].weight = 999
    file.state.routines[0].name = 'From the AI'
    let result
    await act(async () => {
      result = await importWithBackup({ store: captured.store, payload: file, ask: () => 'keep', download: () => {} })
    })
    await flush()
    const saved = JSON.parse(localStorage.getItem(KEY))
    assert.equal(JSON.stringify(saved.workouts), before, 'workouts byte-identical')
    assert.equal(saved.routines[0].name, 'From the AI')
    assert.equal(captured.store.routines[0].name, 'From the AI', 'the live store holds the import')
    assert.equal(JSON.stringify(captured.store.workouts), before)
    assert.equal(result.keptHistory, true)
    assert.equal(result.summary.workouts, 13)
  })
})
