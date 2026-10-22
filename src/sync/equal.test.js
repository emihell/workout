// req-230 — the browser-safe deepEqual the merge now uses gives the same answer as Node's
// isDeepStrictEqual (what req-229's merge used) on state values. Generated pairs + real states.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { fullState } from '../test-support/full-state.js'
import { emptyState } from '../persistence.js'
import { deepEqual } from './equal.js'

// A small seeded generator, so a failure replays.
function rng(seed) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
}

function value(r, depth = 0) {
  const k = Math.floor(r() * (depth > 3 ? 6 : 9))
  switch (k) {
    case 0: return null
    case 1: return undefined
    case 2: return Math.floor(r() * 3)
    case 3: return ['a', 'b', ''][Math.floor(r() * 3)]
    case 4: return r() < 0.5
    case 5: return [0, -0, NaN][Math.floor(r() * 3)]
    case 6:
    case 7: return Array.from({ length: Math.floor(r() * 3) }, () => value(r, depth + 1))
    default: {
      const out = {}
      for (const key of ['x', 'y', 'z'].filter(() => r() < 0.6)) out[key] = value(r, depth + 1)
      return out
    }
  }
}

// A near copy: sometimes identical, sometimes one small change.
function variant(r, v) {
  if (r() < 0.4) return structuredClone(v)
  if (Array.isArray(v)) return r() < 0.5 ? v.slice(1) : v.map((x) => variant(r, x))
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).reverse() // key order must not matter
    const out = {}
    for (const key of keys) out[key] = r() < 0.8 ? variant(r, v[key]) : undefined
    if (r() < 0.2) delete out[keys[0]]
    return out
  }
  return r() < 0.7 ? v : value(r)
}

describe('req-230 deepEqual ≡ isDeepStrictEqual on state values', () => {
  it('20,000 generated pairs agree', () => {
    const r = rng(230)
    let equalPairs = 0
    for (let i = 0; i < 20000; i++) {
      const a = value(r)
      const b = variant(r, a)
      const expected = isDeepStrictEqual(a, b)
      if (expected) equalPairs += 1
      assert.equal(deepEqual(a, b), expected, JSON.stringify([a, b]))
    }
    assert.ok(equalPairs > 2000 && equalPairs < 18000, `both answers exercised (${equalPairs} equal)`)
  })

  it('real states: equal copies, a key order change, an undefined-valued key, one changed set', () => {
    const a = fullState()
    const reordered = Object.fromEntries(Object.entries(structuredClone(a)).reverse())
    const withUndefined = { ...structuredClone(a), activeWorkout: { ...a.activeWorkout, routineId: undefined } }
    const changed = structuredClone(a)
    changed.workouts[0].sets[0].reps = '11'
    for (const [x, y] of [[a, structuredClone(a)], [a, reordered], [a, withUndefined], [a, changed], [a, emptyState()]]) {
      assert.equal(deepEqual(x, y), isDeepStrictEqual(x, y))
    }
    assert.equal(deepEqual(a, reordered), true)
    assert.equal(deepEqual(a, withUndefined), false)
    assert.equal(deepEqual(a, changed), false)
  })
})
