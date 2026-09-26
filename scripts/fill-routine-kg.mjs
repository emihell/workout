// req-178 — dry run of the one-time routine-kg fill on an Export (or any stored doc), READ
// ONLY: the file is read, never written. It runs the SAME function loadState runs
// (fillRoutineKgFromHistory, src/routine-kg-fill.js) on the state the app would load
// (applyBackup: migrate + anchor, as an import does), for both Q1 rules, and prints each
// change and the totals.
//
//   node scripts/fill-routine-kg.mjs <export.json>

import { readFileSync } from 'node:fs'
import { applyBackup } from '../src/exchange.js'
import { FILL_MARKER, fillRoutineKgFromHistory } from '../src/routine-kg-fill.js'

const path = process.argv[2]
if (!path) {
  console.error('usage: node scripts/fill-routine-kg.mjs <export.json>')
  process.exit(2)
}
const { state } = applyBackup(JSON.parse(readFileSync(path, 'utf8')))
const kg = (list) => `[${(list || []).join(', ')}]`
const items = (state.routines || []).reduce((n, routine) => n + (routine.exercises || []).length, 0)

console.log(`file: ${path}`)
console.log(`routines ${state.routines.length} · items ${items} · workouts ${state.workouts.length}`)
if (state[FILL_MARKER]) console.log(`marker ${FILL_MARKER} = ${state[FILL_MARKER]}: loadState would NOT fill this state`)

for (const mode of ['overwrite', 'blanks']) {
  const { changes } = fillRoutineKgFromHistory({ ...state, [FILL_MARKER]: undefined }, { mode, at: null })
  console.log(`\n(${mode === 'overwrite' ? 'a' : 'b'}) ${mode}${mode === 'overwrite' ? ' — the shipped rule (DEC-100)' : ' — dry run only'}: ${changes.length} item(s) change`)
  for (const c of changes) console.log(`  ${c.routineName} · ${c.exerciseName}: ${kg(c.from)} → ${kg(c.to)}`)
}
