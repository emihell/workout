// req-114 (audit G) — run the zone-dependent date cases (dates-tz.cases.js) under
// explicit time zones. The process zone is fixed at start, so each zone is a child
// `node --test` with TZ set; ./check therefore always exercises both Europe/Stockholm
// (east of UTC: the 00:00–02:00 UTC-date bug) and America/New_York (west of UTC: the
// date-only-string-parsed-as-UTC bug), whatever zone the gate itself runs in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cases = fileURLToPath(new URL('./dates-tz.cases.js', import.meta.url))

// req-258 (L-045): the guard asserts the EXACT number of cases, read from the cases file
// itself — every `it(` (and `it.skip(` / `it.only(` / `it.todo(`, which must not slip by as
// "fewer ran") declared there. Adding a case needs no second edit here. `# pass [1-9]` used
// to pass with 1 of 10 cases run, or with none (a file that exits early counts as one pass).
const caseCount = (readFileSync(cases, 'utf8').match(/^\s*it(?:\.(?:skip|only|todo))?\(/gm) || []).length
test('dates-tz.cases.js declares at least one case', () => {
  assert.ok(caseCount > 0, `no it( found in ${cases}`)
})

for (const tz of ['Europe/Stockholm', 'America/New_York']) {
  test(`date cases pass under TZ=${tz}`, () => {
    // Drop the parent runner's NODE_TEST_CONTEXT so the child prints its own TAP. The
    // reporter is explicit: Node 26 defaults to `spec` off a TTY, which the guard can't read.
    const { NODE_TEST_CONTEXT: _ctx, ...env } = process.env
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', cases], {
      env: { ...env, TZ: tz },
      encoding: 'utf8',
    })
    const out = `${run.stdout}\n${run.stderr}`
    assert.equal(run.status, 0, out)
    // Guard a vacuous pass: every declared case really ran and passed, and none failed.
    assert.match(out, new RegExp(`^# tests ${caseCount}$`, 'm'), out)
    assert.match(out, new RegExp(`^# pass ${caseCount}$`, 'm'), out)
    assert.match(out, /^# fail 0$/m, out)
  })
}
