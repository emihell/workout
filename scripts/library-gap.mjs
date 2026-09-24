// req-140 — the library gap list (a one-off, not a test). Reads ONLY `name_en` from a
// pinned RepDB copy (in the gitignored .vendor-cache/), and lists every name that matches none of
// our name / displayName / alias keys (catalogNameKey). Names that match only a
// non-common entry are listed too, marked, since those are promotion candidates.
//
//   node scripts/library-gap.mjs [cached repdb exercises.json] [out.txt]
//
// Defaults: .vendor-cache/repdb-<pinned sha>.json in, .vendor-cache/req-140-gap-raw.txt out.
// The output is RepDB's name list, so it never goes in git (licence term 3):
// .vendor-cache/ is gitignored (DEC-066).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogNameKey, shownName } from '../src/exerciseLibrary.js'

export const REPDB_SHA = '9ed9357f09c7566ea0256c57ebd6374ebb8b575e'
const cache = (name) => fileURLToPath(new URL(`../.vendor-cache/${name}`, import.meta.url))
const [repdbPath = cache(`repdb-${REPDB_SHA}.json`), outPath = cache('req-140-gap-raw.txt')] = process.argv.slice(2)
const file = JSON.parse(readFileSync(repdbPath, 'utf8'))
const names = (Array.isArray(file) ? file : file.exercises).map((entry) => String(entry.name_en || ''))
const library = JSON.parse(readFileSync(fileURLToPath(new URL('../src/library/exercises.json', import.meta.url)), 'utf8'))

const owner = new Map()
for (const entry of library) {
  for (const name of [entry.name, entry.displayName, shownName(entry), ...(entry.aliases || [])]) {
    const key = catalogNameKey(name)
    if (!key) continue
    const prev = owner.get(key)
    // A common owner wins, so "matches a common entry" is never hidden by a free-db name.
    if (!prev || (entry.common && !prev.common)) owner.set(key, entry)
  }
}

const none = []
const nonCommon = []
let common = 0
for (const name of names) {
  const hit = owner.get(catalogNameKey(name))
  if (!hit) none.push(name)
  else if (!hit.common) nonCommon.push(`${name}\t→ ${hit.id}`)
  else common += 1
}
const lines = [
  `RepDB names: ${names.length} · match a common entry: ${common} · match only a non-common entry: ${nonCommon.length} · match nothing: ${none.length}`,
  '',
  `## match nothing (${none.length})`,
  ...none.sort(),
  '',
  `## match only a non-common entry (${nonCommon.length})`,
  ...nonCommon.sort(),
]
if (outPath) writeFileSync(outPath, `${lines.join('\n')}\n`)
console.log(lines[0])
