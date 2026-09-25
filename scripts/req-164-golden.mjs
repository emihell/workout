// req-164 — records a tree's migrated, loaded, saved-and-reloaded and finished state for
// three stored docs, as the golden src/req-164.test.js compares against: src/db.json under
// the v8 key (the real legacy path) and the two req-165 old docs (req-165.old-docs.js).
// Run in a `git archive <ref>` copy (L-040: no worktree is touched):
//   SHA=$(git rev-parse --short main); D=$(mktemp -d); git archive main | tar -x -C $D
//   ln -s $PWD/node_modules $D/node_modules; cp src/req-165.old-docs.js $D/src/; cp scripts/req-164-golden.mjs $D/
//   (cd $D && node req-164-golden.mjs $SHA out.json); gzip -9 -n < $D/out.json > src/req-164.golden.json.gz
// Imports storage.js (it stays a re-export of the split modules), so any tree can be recorded.
import { readFileSync, writeFileSync } from 'node:fs'
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
const { loadState, saveState } = await import(at('src/storage.js'))
const { finishedState } = await import(at('src/workout-log.js'))
const { OLD_V8, OLD_V9_WITH_PLAN } = await import(at('src/req-165.old-docs.js'))
const DB = JSON.parse(readFileSync('src/db.json', 'utf8'))

export const FINISHED_AT = '2026-09-25T12:00:00.000Z'
const plain = (v) => JSON.parse(JSON.stringify(v))
const snapshotDisk = () => Object.fromEntries([...disk].map(([k, v]) => [k, JSON.parse(v)]))

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
