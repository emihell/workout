// req-178 — the one-time routine-kg fill, on an Export (or any stored doc). The input file is
// only READ, never written. It runs the SAME function loadState runs (fillRoutineKgFromHistory,
// src/routine-kg-fill.js) on the state the app would load (applyBackup: migrate + anchor, as an
// import does), for both Q1 rules, and prints each change and the totals.
//
//   node scripts/fill-routine-kg.mjs <export.json>                   # dry run
//   node scripts/fill-routine-kg.mjs <export.json> --out <copy.json> # + write a filled COPY
//
// --out (req-178 review): the fill runs once per device, so an OLD Export imported after it
// keeps its routine kg. This writes a copy with rule (a) applied — same backup wrapper, the
// state as the app would load it, filled — to import instead. It refuses to overwrite the input.

import { readFileSync, realpathSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyBackup } from '../src/exchange.js'
import { fillRoutineKgFromHistory } from '../src/routine-kg-fill.js'

const args = process.argv.slice(2)
const outAt = args.indexOf('--out')
const out = outAt >= 0 ? args[outAt + 1] : null
const path = args.find((arg, i) => i !== outAt && (outAt < 0 || i !== outAt + 1))
if (!path || (outAt >= 0 && !out)) {
  console.error('usage: node scripts/fill-routine-kg.mjs <export.json> [--out <copy.json>]')
  process.exit(2)
}
const input = JSON.parse(readFileSync(path, 'utf8'))
const { state } = applyBackup(input)
const kg = (list) => `[${(list || []).join(', ')}]`
const items = (state.routines || []).reduce((n, routine) => n + (routine.exercises || []).length, 0)

console.log(`file: ${path}`)
console.log(`routines ${state.routines.length} · items ${items} · workouts ${state.workouts.length}`)

let filled = null
for (const mode of ['overwrite', 'blanks']) {
  const result = fillRoutineKgFromHistory(state, { mode })
  if (mode === 'overwrite') filled = result.state
  console.log(`\n(${mode === 'overwrite' ? 'a' : 'b'}) ${mode}${mode === 'overwrite' ? ' — the shipped rule (DEC-100)' : ' — dry run only'}: ${result.changes.length} item(s) change`)
  for (const c of result.changes) console.log(`  ${c.routineName} · ${c.exerciseName}: ${kg(c.from)} → ${kg(c.to)}`)
}

if (out) {
  // The same file by path, by symlink (realpath) or by hard link (device + inode).
  const inode = (file) => {
    const stat = statSync(file)
    return `${stat.dev}:${stat.ino}`
  }
  const same = existsSync(out) && (realpathSync(out) === realpathSync(path) || inode(out) === inode(path))
  if (same || resolve(out) === resolve(path)) {
    console.error('\n--out is the input file; refusing (the input is never written).')
    process.exit(1)
  }
  const doc = input && input.kind && input.state ? { ...input, state: filled } : filled
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`)
  console.log(`\nwrote a filled copy (rule a) to ${out}`)
}
