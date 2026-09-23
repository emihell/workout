// req-114 (audit G) — run the zone-dependent date cases (dates-tz.cases.js) under
// explicit time zones. The process zone is fixed at start, so each zone is a child
// `node --test` with TZ set; ./check therefore always exercises both Europe/Stockholm
// (east of UTC: the 00:00–02:00 UTC-date bug) and America/New_York (west of UTC: the
// date-only-string-parsed-as-UTC bug), whatever zone the gate itself runs in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cases = fileURLToPath(new URL('./dates-tz.cases.js', import.meta.url))

for (const tz of ['Europe/Stockholm', 'America/New_York']) {
  test(`date cases pass under TZ=${tz}`, () => {
    // Drop the parent runner's NODE_TEST_CONTEXT so the child prints its own TAP.
    const { NODE_TEST_CONTEXT: _ctx, ...env } = process.env
    const run = spawnSync(process.execPath, ['--test', cases], {
      env: { ...env, TZ: tz },
      encoding: 'utf8',
    })
    const out = `${run.stdout}\n${run.stderr}`
    assert.equal(run.status, 0, out)
    // Guard a vacuous pass: the cases really ran, and none failed.
    assert.match(out, /# pass [1-9]/)
    assert.match(out, /# fail 0/)
  })
}
