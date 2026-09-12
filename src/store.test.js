import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dateKey } from './schedule.js'

// req-38 (F-CODE-2) — startWorkout stamped `performedOn` and the default plan `date`
// with the UTC `new Date().toISOString().slice(0,10)`; every other day key in the app
// is local via dateKey (schedule.js), so near midnight for an off-UTC user the record
// landed a day off. The fix swaps both store sites to `dateKey(new Date())`.
//
// The store lives in store.jsx and can't be imported under the project's plain
// `node --test` runner (no JSX transform — that's why no test imports it), so this
// proves the fix two ways it CAN reach: (1) the exact substituted expression is
// local-not-UTC, deterministically, at a real boundary instant; (2) a source guard
// that both store sites now use it and the UTC slice is gone (enforces the grep
// acceptance and fails if either line is reverted).
process.env.TZ = 'Pacific/Kiritimati' // UTC+14, no DST — a stable large offset

const RealDate = Date
const FIXED_UTC = '2026-03-10T20:00:00Z' // 2026-03-10 in UTC, 2026-03-11 local (+14)
const LOCAL_DAY = '2026-03-11'
const UTC_SLICE = '2026-03-10'

describe('req-38 day key is stamped in local time, not UTC', () => {
  before(() => {
    // Pin only the no-arg `new Date()` to the boundary instant; everything else stays
    // real. This makes the local-vs-UTC difference deterministic without a refactor.
    class FixedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(FIXED_UTC)
        else super(...args)
      }
    }
    FixedDate.now = () => RealDate.now()
    FixedDate.parse = RealDate.parse
    FixedDate.UTC = RealDate.UTC
    globalThis.Date = FixedDate
  })
  after(() => {
    globalThis.Date = RealDate
  })

  it('dateKey(new Date()) is the LOCAL day, and differs from the old UTC slice', () => {
    // The expression the store now uses:
    assert.equal(dateKey(new Date()), LOCAL_DAY)
    // The expression it used before — a different calendar day at this instant:
    assert.equal(new Date().toISOString().slice(0, 10), UTC_SLICE)
    // So the swap is a real behaviour change near a day boundary, not a no-op:
    assert.notEqual(LOCAL_DAY, UTC_SLICE)
    assert.match(dateKey(new Date()), /^\d{4}-\d{2}-\d{2}$/)
  })

  it('store.jsx stamps both day keys via dateKey(new Date()), with no UTC slice left', () => {
    const src = readFileSync(fileURLToPath(new URL('./store.jsx', import.meta.url)), 'utf8')
    // The acceptance grep, enforced as a test: no UTC day-slice anywhere in the store.
    assert.equal(
      /toISOString\(\)\.slice\(0,\s*10\)/.test(src),
      false,
      'store.jsx must not build a day key from the UTC toISOString slice',
    )
    // Both sites (plan.date default + performedOn) now use the canonical local key.
    const localStamps = src.match(/dateKey\(new Date\(\)\)/g) || []
    assert.equal(localStamps.length, 2, 'expected dateKey(new Date()) at both store sites')
    assert.match(src, /import\s*\{[^}]*\bdateKey\b[^}]*\}\s*from\s*'\.\/schedule'/)
  })
})
