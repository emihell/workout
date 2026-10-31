// req-164 — records a tree's migrated, loaded, saved-and-reloaded and finished state for
// three stored docs, as the golden src/req-164.test.js compares against: src/db.json under
// the v8 key (the real legacy path) and the two req-165 old docs (req-165.old-docs.js).
// Run in a `git archive <ref>` copy (L-040: no worktree is touched):
//   SHA=$(git rev-parse --short main); D=$(mktemp -d); git archive main | tar -x -C $D
//   ln -s $PWD/node_modules $D/node_modules; cp src/req-165.old-docs.js $D/src/; cp scripts/req-164-golden.mjs $D/
//   (cd $D && node req-164-golden.mjs $SHA out.json); gzip -9 -n < $D/out.json > src/req-164.golden.json.gz
// Imports persistence.js, or storage.js on a tree from before req-164, so any tree can be recorded.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const at = (p) => pathToFileURL(resolve(p)).href
const disk = new Map()
globalThis.localStorage = {
  getItem: (k) => (disk.has(k) ? disk.get(k) : null),
  setItem: (k, v) => disk.set(k, String(v)),
  removeItem: (k) => disk.delete(k),
  get length() {
    return disk.size
  },
  key: (i) => [...disk.keys()][i] ?? null,
}
const { migrateState } = await import(at('src/model.js'))
// persistence.js since req-164; an older tree only has storage.js (deleted in req-269).
const { loadState, saveState } = await import(at(existsSync('src/persistence.js') ? 'src/persistence.js' : 'src/storage.js'))
// req-270 — finishedState lives in workout-finish.js; an older tree only has workout-log.js.
const { finishedState } = await import(at(existsSync('src/workout-finish.js') ? 'src/workout-finish.js' : 'src/workout-log.js'))
const { OLD_V8, OLD_V9_WITH_PLAN } = await import(at('src/req-165.old-docs.js'))
const DB = JSON.parse(readFileSync('src/db.json', 'utf8'))

export const FINISHED_AT = '2026-09-25T12:00:00.000Z'
const plain = (v) => JSON.parse(JSON.stringify(v))
// req-269 — a disk value parsed as JSON. One exception: since req-178 the device fill marker
// (routine-kg-fill.js DEVICE_FILL_KEY) is a plain ISO time, and JSON.parse threw on it, so neither
// script recorded a tree after req-178; that key alone may stay a raw string (as the test's
// diskValue reads it). Any other non-JSON value still throws: a new raw key must be named here.
// A tree before req-178 stores only JSON, so its recording is unchanged.
const FILL_KEY = 'workout-routine-kg-filled'
const diskValue = (key, raw) => {
  if (key !== FILL_KEY) return JSON.parse(raw)
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
const snapshotDisk = () => Object.fromEntries([...disk].map(([k, v]) => [k, diskValue(k, v)]))

export const DOCS = { db_v8: ['workout-mvp-v8', DB, true], old_v8: ['workout-mvp-v8', OLD_V8, true], old_v9: ['workout-mvp-v9', OLD_V9_WITH_PLAN, false] }

const out = { mainSha: process.argv[2] }
for (const [name, [key, doc, legacy]] of Object.entries(DOCS)) {
  disk.clear()
  disk.set(key, JSON.stringify(doc))
  const loaded = loadState()
  const load = { state: plain(loaded), disk: snapshotDisk() }
  saveState(loaded)
  const reloaded = loadState()
  const roundTrip = { state: plain(reloaded), disk: snapshotDisk() }
  out[name] = {
    migrate: plain(migrateState(structuredClone(doc), { legacy })),
    load,
    roundTrip,
    finish: loaded.activeWorkout ? plain(finishedState(loaded, { overallFeel: 'Good' }, FINISHED_AT)) : null,
  }
}
writeFileSync(process.argv[3], JSON.stringify(out))
console.log(`recorded ${out.mainSha}:`, Object.entries(out).filter(([k]) => k !== 'mainSha').map(([k, v]) => `${k} workouts=${v.load.state.workouts.length} finish=${v.finish ? v.finish.workouts[0].sets.length + ' sets' : '—'}`).join(' | '))
