// req-130 — regenerate src/library/exercises.json (our exercise library) from the
// pinned free-exercise-db dist/exercises.json + the tables in src/exerciseLibrary.js.
// Refuses unless the source matches the pinned sha256. Deterministic: re-running it on
// an unchanged source and tables writes the same bytes.
//
//   node scripts/build-library.mjs                 # fetch the pinned source
//   node scripts/build-library.mjs <exercises.json>  # or read a local copy

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deriveLibrary, FREE_DB_SHA256, FREE_DB_SOURCE_URL } from '../src/exerciseLibrary.js'

const OUT = fileURLToPath(new URL('../src/library/exercises.json', import.meta.url))

const localPath = process.argv[2]
const text = localPath
  ? readFileSync(localPath, 'utf8')
  : await fetch(FREE_DB_SOURCE_URL).then((response) => {
      if (!response.ok) throw new Error(`${FREE_DB_SOURCE_URL}: HTTP ${response.status}`)
      return response.text()
    })

const sha = createHash('sha256').update(text).digest('hex')
if (sha !== FREE_DB_SHA256) {
  console.error(`build-library: source sha256 ${sha} != pinned ${FREE_DB_SHA256}; refusing.`)
  process.exit(1)
}

const library = deriveLibrary(JSON.parse(text))
writeFileSync(OUT, `${JSON.stringify(library, null, 2)}\n`)
console.log(`build-library: wrote ${library.length} entries to src/library/exercises.json (source sha256 ok).`)
