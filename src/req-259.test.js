// req-259 — `plan qa <ref> --empty`: the argument parsing and the seed step, without a
// vite build. The served index.html must carry no seed script with --empty, so an
// origin cleared and reloaded stays empty (a true first-time user).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as qa from '../scripts/qa.mjs'

const HTML = '<!doctype html><html><head><title>t</title></head><body></body></html>'

function withDist(fn) {
  const dist = mkdtempSync(join(tmpdir(), 'req-259-'))
  try {
    writeFileSync(join(dist, 'index.html'), HTML)
    return fn(dist)
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}

// Run `start`'s parsing and seed step the way it does, on a fake dist.
function servedHtml(args) {
  const opts = qa.parseStartArgs(args, { root: '/r' })
  return withDist((dist) => {
    qa.prepareDist(dist, { empty: opts.empty, seedJson: opts.empty ? null : '{"v":1}' })
    return readFileSync(join(dist, 'index.html'), 'utf8')
  })
}

test('no seed script with --empty: index.html is left exactly as built', () => {
  const html = servedHtml(['main', '--empty'])
  assert.equal(html, HTML)
  assert.ok(!html.includes('workout-mvp-v8'))
})

test('default (no flag) is still seeded under the v8 key', () => {
  const html = servedHtml(['main'])
  assert.ok(html.includes('workout-mvp-v8'))
  assert.ok(html.startsWith('<!doctype html><html><head><script>'))
})

test('parseStartArgs: default seed is src/db.json, --empty has none', () => {
  assert.deepEqual(qa.parseStartArgs(['main'], { root: '/r' }), { ref: 'main', seed: '/r/src/db.json', empty: false, nodeModules: '/r/node_modules' })
  assert.deepEqual(qa.parseStartArgs(['main', '--empty', '--node-modules', '/nm'], { root: '/r' }), { ref: 'main', seed: null, empty: true, nodeModules: '/nm' })
  assert.equal(qa.parseStartArgs(['main', '--seed', 'x.json'], { root: '/r' }).seed, resolve('x.json'))
})

test('--empty with --seed is refused, in either order', () => {
  assert.throws(() => qa.parseStartArgs(['main', '--empty', '--seed', 'x.json']), /^Error: --empty and --seed are exclusive$/)
  assert.throws(() => qa.parseStartArgs(['--seed', 'x.json', 'main', '--empty']), /--empty and --seed are exclusive/)
})

test('unknown arguments and a missing ref still refuse', () => {
  assert.throws(() => qa.parseStartArgs(['main', '--bogus']), /unknown argument: --bogus/)
  assert.throws(() => qa.parseStartArgs(['--empty']), /usage: plan qa <ref>/)
})

test('seedLabel names which mode it is', () => {
  assert.equal(qa.seedLabel({ empty: true, seed: null }), 'seed: none (--empty)')
  assert.equal(qa.seedLabel({ empty: false, seed: '/r/src/db.json' }), 'seed: /r/src/db.json')
  assert.equal(qa.seedLabel({ seed: '/old/state.json' }), 'seed: /old/state.json') // a pre-req-259 state file
})
