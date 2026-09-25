// req-165 — records a tree's loaded AND finished state for the old docs in
// src/req-165.old-docs.js, as the golden src/req-165.test.js compares against. Run it in
// a `git archive <ref>` copy of the tree to record (L-040: no worktree is touched):
//   D=$(mktemp -d); git archive main | tar -x -C $D; ln -s $PWD/node_modules $D/node_modules
//   cp src/req-165.old-docs.js $D/src/; cp scripts/req-165-golden.mjs $D/
//   SHA=$(git rev-parse --short main); (cd $D && node req-165-golden.mjs $SHA out.json); gzip -9 -n < $D/out.json > src/req-165.golden.json.gz
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve('.')
const at = (p) => pathToFileURL(resolve(root, p)).href
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
const { loadState } = await import(at('src/storage.js'))
const { finishedState } = await import(at('src/workout-log.js'))
const { OLD_V8, OLD_V9_WITH_PLAN } = await import(at('src/req-165.old-docs.js'))

const FINISHED_AT = '2026-09-25T12:00:00.000Z'
function load(key, doc) {
  disk.clear()
  disk.set(key, JSON.stringify(doc))
  const state = loadState()
  return { state: JSON.parse(JSON.stringify(state)), disk: Object.fromEntries([...disk].map(([k, v]) => [k, JSON.parse(v)])) }
}
const loadV8 = load('workout-mvp-v8', OLD_V8)
const loadV9 = load('workout-mvp-v9', OLD_V9_WITH_PLAN)
const out = {
  mainSha: process.argv[2],
  migrate_v8: migrateState(structuredClone(OLD_V8), { legacy: true }),
  migrate_v9: migrateState(structuredClone(OLD_V9_WITH_PLAN)),
  load_v8: loadV8,
  load_v9: loadV9,
  finish_v8: finishedState(loadV8.state, { overallFeel: 'Good' }, FINISHED_AT),
  finish_v9: finishedState(loadV9.state, { overallFeel: 'Good' }, FINISHED_AT),
}
writeFileSync(process.argv[3], JSON.stringify(out))
console.log(`recorded ${process.argv[2]}: finish_v9 skipped sets = ${out.finish_v9.workouts[0].sets.filter((s) => s.reps === 'skipped').length}, finish_v8 = ${out.finish_v8.workouts[0].sets.filter((s) => s.reps === 'skipped').length}`)
