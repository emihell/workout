// req-49 / req-62 — the Back component (views/shared.jsx).
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

test('req-62 — Back is a NavLink to `to` (DEC-016 nav = link), a ‹ back-chevron, not a button', () => {
  // req-122 — the `.ui-navlink` treatment is `look="link"` (lookClass maps it), not a hand-written class.
  assert.match(src, /<NavLink to=\{to\} look="link" chevron="back">Back<\/NavLink>/)
  assert.match(src, /const classes = \[lookClass\(look, block\), className\]/)
  // it must NOT be a <button> doing imperative navigation
  assert.doesNotMatch(src, /<button[^>]*onClick=\{\(\) => go\(to\)\}/)
})

test('Back navigates via the route hash (toHash), never the removed stack-back primitive', () => {
  assert.match(src, /import \{ toHash \} from '\.\.\/route'/)
  assert.doesNotMatch(src, /onClick=\{\(\) => back\(\)\}/)
})

test('Missing falls back to Today, the one caller that cannot know a parent', () => {
  assert.match(src, /<Back to="\/" \/>/)
})
