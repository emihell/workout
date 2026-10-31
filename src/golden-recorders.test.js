// req-275 (L-071) — the two golden RECORDERS (scripts/req-164-golden.mjs, req-165-golden.mjs)
// broke from req-178 to req-269 and nothing noticed: the golden tests compare against a stored
// file, so a recorder that throws on today's tree stays green until someone needs a new golden.
// This runs both on the current tree — read-only: each writes only its output file, here a temp
// dir; cwd is the tree, as the recorders resolve src/ from it — and asserts they exit 0 and record
// every doc. WORKOUT_GOLDEN_TREE=<dir> points it at another tree (the failure-case proof).
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tree = process.env.WORKOUT_GOLDEN_TREE || fileURLToPath(new URL('..', import.meta.url))
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url))
const out = mkdtempSync(join(tmpdir(), 'golden-recorders-'))
after(() => rmSync(out, { recursive: true, force: true }))

function record(script) {
  const file = join(out, `${script}.json`)
  const run = spawnSync(process.execPath, [join(scripts, script), 'test-sha', file], { cwd: tree, encoding: 'utf8' })
  assert.equal(run.status, 0, `${script} exited ${run.status} on ${tree}:\n${run.stderr}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

describe('req-275: the golden recorders still record the current tree', () => {
  it('req-164-golden.mjs exits 0 and records all three docs (migrate, load, round trip, finish)', () => {
    const rec = record('req-164-golden.mjs')
    assert.equal(rec.mainSha, 'test-sha')
    assert.deepEqual(Object.keys(rec).filter((k) => k !== 'mainSha').sort(), ['db_v8', 'old_v8', 'old_v9'])
    for (const [name, doc] of Object.entries(rec)) {
      if (name === 'mainSha') continue
      assert.deepEqual(Object.keys(doc).sort(), ['finish', 'load', 'migrate', 'roundTrip'], name)
      assert.ok(Array.isArray(doc.load.state.workouts), `${name}: load.state.workouts`)
      assert.ok(Array.isArray(doc.roundTrip.state.workouts), `${name}: roundTrip.state.workouts`)
    }
  })

  it('req-165-golden.mjs exits 0 and records both old docs (migrate, load, finish)', () => {
    const rec = record('req-165-golden.mjs')
    assert.deepEqual(Object.keys(rec).sort(), ['finish_v8', 'finish_v9', 'load_v8', 'load_v9', 'mainSha', 'migrate_v8', 'migrate_v9'])
    for (const k of ['finish_v8', 'finish_v9']) assert.ok(rec[k].workouts[0].sets.length > 0, `${k} has sets`)
  })
})
