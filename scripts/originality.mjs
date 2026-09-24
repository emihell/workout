// req-138 — the originality receipt (a one-off check, not a test). Compares our library
// text with a pinned RepDB copy cached OUTSIDE the repo and prints only OUR lines and
// their scores — never a RepDB sentence. The cache lives in the gitignored .vendor-cache/.
//
//   node scripts/originality.mjs [cached repdb exercises.json] [--runs-only] [--lines] [--scores]
//
// Default input: .vendor-cache/repdb-<pinned sha>.json (gitignored, DEC-066).
// --runs-only: Measure 2 only — the gate since DEC-065 §3.
//
// Measure 1, per common entry with a same-named RepDB entry (catalogNameKey of the shown
// name or an alias == RepDB's English name): the share of our word-4-grams (all four text
// fields) found in that RepDB entry's English text. Flag > 0.15.
// Measure 2, every line of ours: a contiguous run of >= 12 tokens shared with any RepDB
// English sentence. Controls: free-db instructions and own-* legacy instructions, same
// measures.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogNameKey, shownName, TEXT_FIELDS } from '../src/exerciseLibrary.js'

const FLAG = 0.15
const RUN = 12
const REPDB_SHA = '9ed9357f09c7566ea0256c57ebd6374ebb8b575e'
const RUNS_ONLY = process.argv.includes('--runs-only')
const repdbPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  || fileURLToPath(new URL(`../.vendor-cache/repdb-${REPDB_SHA}.json`, import.meta.url))
const repdbFile = JSON.parse(readFileSync(repdbPath, 'utf8'))
const repdb = Array.isArray(repdbFile) ? repdbFile : repdbFile.exercises
const library = JSON.parse(readFileSync(fileURLToPath(new URL('../src/library/exercises.json', import.meta.url)), 'utf8'))

const tokens = (text) => String(text).toLowerCase().match(/[a-z0-9°]+/g) || []
const grams = (list, n) => {
  const out = []
  for (let i = 0; i + n <= list.length; i += 1) out.push(list.slice(i, i + n).join(' '))
  return out
}
const repdbLines = (entry) => [
  ...String(entry.description_en || '').split(/(?<=[.!?])\s+/),
  ...(entry.instructions_en || []),
  ...(entry.tips_en || []),
].filter(Boolean)

const byName = new Map()
for (const entry of repdb) {
  const key = catalogNameKey(entry.name_en)
  if (key && !byName.has(key)) byName.set(key, entry)
}
const runs = new Set()
for (const entry of repdb) for (const line of repdbLines(entry)) for (const gram of grams(tokens(line), RUN)) runs.add(gram)

const matchFor = (entry) => {
  for (const name of [shownName(entry), entry.name, ...(entry.aliases || [])]) {
    const hit = byName.get(catalogNameKey(name))
    if (hit) return hit
  }
  return null
}
// Share of our 4-grams that appear in the RepDB entry's 4-grams. Scored two ways and the
// higher kept: grams built per line, and grams run across lines (the reviewer's control
// numbers reproduce on the joined form: own-cossack-squat 0.185).
const share = (lines, match) => {
  const theirs = new Set(grams(tokens(repdbLines(match).join(' ')), 4))
  const part = (ours) => {
    if (!ours.size) return 0
    let hit = 0
    for (const gram of ours) if (theirs.has(gram)) hit += 1
    return hit / ours.size
  }
  return Math.max(
    part(new Set(lines.flatMap((line) => grams(tokens(line), 4)))),
    part(new Set(grams(tokens(lines.join(' ')), 4))),
  )
}
const longRun = (line) => grams(tokens(line), RUN).some((gram) => runs.has(gram))
const ourLines = (entry) => [entry.description, ...TEXT_FIELDS.slice(1).flatMap((field) => entry[field] || [])]

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  return { n: sorted.length, max: sorted.at(-1) ?? 0, median: median ?? 0 }
}
const fmt = (x) => x.toFixed(3)

function measure(label, entries, linesOf) {
  const scored = []
  const runLines = []
  for (const entry of entries) {
    const lines = linesOf(entry)
    const match = matchFor(entry)
    if (match) scored.push({ id: entry.id, score: share(lines, match) })
    for (const line of lines) if (longRun(line)) runLines.push({ id: entry.id, line })
  }
  console.log(`\n## ${label}`)
  if (RUNS_ONLY) {
    console.log(`lines with a >=${RUN}-token run: ${runLines.length}`)
    for (const { id, line } of runLines) console.log(`  RUN  ${id}: ${line}`)
    return { scored, flagged: [], runLines }
  }
  const { n, max, median } = stats(scored.map((s) => s.score))
  const flagged = scored.filter((s) => s.score > FLAG).sort((a, b) => b.score - a.score)
  const top = scored.slice().sort((a, b) => b.score - a.score)[0]
  console.log(`matched ${n}/${entries.length} · max ${fmt(max)}${top ? ` (${top.id})` : ''} · median ${fmt(median)} · flagged >${FLAG}: ${flagged.length} · lines with a >=${RUN}-token run: ${runLines.length}`)
  for (const { id, score } of flagged) console.log(`  FLAG ${fmt(score)} ${id}`)
  for (const { id, line } of runLines) console.log(`  RUN  ${id}: ${line}`)
  return { scored, flagged, runLines }
}

const common = library.filter((entry) => entry.common)
console.log(`RepDB entries: ${repdb.length} · common entries: ${common.length}`)
measure('ours — the four req-138 fields', common, ourLines)
measure('control — free-db instructions (common, non-own)', common.filter((e) => !e.id.startsWith('own-')), (e) => e.instructions || [])
measure('control — own-* legacy instructions (common)', common.filter((e) => e.id.startsWith('own-')), (e) => e.instructions || [])

if (process.argv.includes('--scores')) {
  console.log('\n## all scores (ours)')
  for (const entry of common) {
    const match = matchFor(entry)
    if (match) console.log(`${fmt(share(ourLines(entry), match))} ${entry.id}`)
  }
}

// --lines: for each flagged entry of ours, our lines with how many of their 4-grams hit
// (our text only), to steer a rewrite without reading RepDB.
if (process.argv.includes('--lines')) {
  console.log('\n## flagged entries, our lines with 4-gram hits')
  for (const entry of common) {
    const match = matchFor(entry)
    if (!match) continue
    const score = share(ourLines(entry), match)
    if (score <= FLAG) continue
    const theirs = new Set(grams(tokens(repdbLines(match).join(' ')), 4))
    console.log(`${score.toFixed(3)} ${entry.id}`)
    for (const line of ourLines(entry)) {
      const hits = grams(tokens(line), 4).filter((gram) => theirs.has(gram)).length
      if (hits) console.log(`   ${hits}  ${line}`)
    }
  }
}
