// req-185 — the render harness gives tests a working localStorage / sessionStorage on every
// Node it runs under. Node 26 defines both as getters that return undefined (no
// --localstorage-file), so a round trip is asserted, not just "defined".
import { it } from 'node:test'
import assert from 'node:assert/strict'
import './render.js'

for (const name of ['localStorage', 'sessionStorage']) {
  it(`${name} is a usable Storage after importing render.js`, () => {
    const store = globalThis[name]
    assert.equal(typeof store?.clear, 'function')
    store.clear()
    store.setItem('req-185', 'round trip')
    assert.equal(store.getItem('req-185'), 'round trip')
    store.clear()
    assert.equal(store.getItem('req-185'), null)
  })
}
