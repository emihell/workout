// req-49 — the Back component (views/shared.jsx).
//
// shared.jsx is JSX and reuses/produces nav primitives, so `node --test` (plain
// node, no JSX transform) can't import and render it. The behavioural check is
// Emilio's browser test; the source is locked here as text — the same
// static-source approach as BottomMenu.test.js and safe-area.test.js. The routing
// half (back()/applyBack removed, applyVisit kept) is asserted in route.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // src/views
const src = readFileSync(join(here, 'shared.jsx'), 'utf8')

test('Back takes a `to` (its logical parent) and defaults to Today', () => {
  assert.match(src, /export function Back\(\{ to = '\/' \}\)/)
})

test('Back navigates to `to` via go — a fixed route move, not a visit-stack pop', () => {
  assert.match(src, /onClick=\{\(\) => go\(to\)\}/)
})

test('Back no longer imports or calls the removed stack-back primitive', () => {
  // the import is `go` (and toHash for NavLink), never the removed `back`
  assert.match(src, /import \{ go, toHash \} from '\.\.\/route'/)
  assert.doesNotMatch(src, /onClick=\{\(\) => back\(\)\}/)
})

test('Missing falls back to Today, the one caller that cannot know a parent', () => {
  assert.match(src, /<Back to="\/" \/>/)
})
