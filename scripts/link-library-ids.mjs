// req-233 — link Emilio's exercises to the library, on a COPY of his Export, before the
// server import. Shaped like scripts/fill-routine-kg.mjs (req-178): the input is only READ,
// a dry run prints every change, and --out writes a copy and refuses to overwrite the input.
//
//   node scripts/link-library-ids.mjs <export.json>                   # dry run
//   node scripts/link-library-ids.mjs <export.json> --out <copy.json> # + write a linked COPY
//
// The copy is the input document with two fields changed and nothing else: exercises[].libraryId
// from LINKS (by exact name), and exercises[].equipment "Kettlebell" → "Kettlebells". Every name
// must match exactly one exercise and every id must be a live library entry (not hidden, not
// merged, except the HIDDEN_OK names); otherwise it exits non-zero and writes nothing. The mapping
// is for this one file.

import { readFileSync, realpathSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyBackup } from '../src/exchange.js'

// Emilio confirmed 2026-10-25. Listed explicitly, not computed from libraryEntryFor, so a later
// library change can't move them.
const LINKS = {
  // The 29 that resolve by name today, to the entry they resolve to.
  'Rowing': 'Rowing_Stationary',
  'Chest Press': 'Leverage_Chest_Press',
  'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
  'Ab Machine': 'Ab_Crunch_Machine',
  'Plank': 'Plank',
  'Push-Ups': 'Pushups',
  'Stairs': 'Stairmaster',
  'Leg Press': 'Leg_Press',
  'Leg Extension': 'Leg_Extensions',
  'Abduction': 'Thigh_Abductor',
  'Adduction': 'Thigh_Adductor',
  'Incline DB Press': 'Incline_Dumbbell_Press',
  'One-Arm DB Row': 'One-Arm_Dumbbell_Row',
  'Overhead DB Press': 'Dumbbell_Shoulder_Press',
  'Hanging Knee Raises': 'own-hanging-knee-raise',
  'Pike Push Ups': 'own-pike-push-up',
  'Diamond Push Ups': 'Push-Ups_-_Close_Triceps_Position',
  'Superman': 'Superman',
  'Prone YTW': 'extra-prone-ytw',
  'Reverse Snow Angels': 'extra-reverse-snow-angels',
  'Dead Bug': 'Dead_Bug',
  'Hollow Body Hold': 'own-hollow-body-hold',
  'Kettlebell Arnold Press': 'Kettlebell_Arnold_Press',
  'Kettlebell Pirate Ships': 'Kettlebell_Pirate_Ships',
  'Kettlebell Pass Between The Legs': 'Kettlebell_Pass_Between_The_Legs',
  'Jumping Jacks': 'own-jumping-jacks',
  'Mountain Climbers': 'Mountain_Climbers',
  'Burpees': 'own-burpee',
  // Resolves to Kettlebell_Dead_Clean, hidden and merged: linked to its live merge target instead
  // (unilateral, so "one side" appears; Emilio, 2026-10-25).
  'Kettlebell Dead Clean': 'One-Arm_Kettlebell_Clean',
  // Resolve by name today, to a different entry (Star Trac machines).
  'Biceps Curl': 'Machine_Bicep_Curl',
  'Leg Curl': 'Lying_Leg_Curls',
  // Resolve to nothing today.
  'Shoulder Press': 'Machine_Shoulder_Military_Press',
  'Triceps Press': 'Machine_Triceps_Extension',
  'Calf Raises (Leg Press)': 'Calf_Press_On_The_Leg_Press_Machine',
  'Pull-Ups (BW)': 'Pullups',
  'Dips (BW)': 'Dips_-_Chest_Version',
  'Kettlebell Bulgarian Split Squat': 'Split_Squat_with_Dumbbells',
  'Kettlebell Concentration Curl': 'Concentration_Curls',
  'Rask promenad / jogg': 'own-outdoor-walk',
}
// Hidden (not merged) entries these names resolve to today; linking them changes nothing shown
// (Planner, 2026-10-25). Exactly these names: any other hidden id is still refused.
const HIDDEN_OK = new Set(['Kettlebell Arnold Press', 'Kettlebell Pirate Ships', 'Kettlebell Pass Between The Legs'])
const EQUIPMENT = { Kettlebell: 'Kettlebells' }

const args = process.argv.slice(2)
const outAt = args.indexOf('--out')
const out = outAt >= 0 ? args[outAt + 1] : null
const path = args.find((arg, i) => i !== outAt && (outAt < 0 || i !== outAt + 1))
if (!path || (outAt >= 0 && !out)) {
  console.error('usage: node scripts/link-library-ids.mjs <export.json> [--out <copy.json>]')
  process.exit(2)
}
// WORKOUT_LIBRARY: the failure tests point it at a small library; the real run never sets it.
const libraryPath = process.env.WORKOUT_LIBRARY || new URL('../src/library/exercises.json', import.meta.url)
const library = JSON.parse(readFileSync(libraryPath, 'utf8'))
const byId = new Map(library.map((entry) => [entry.id, entry]))

if (out) {
  // The same file by path, by symlink (realpath) or by hard link (device + inode).
  const inode = (file) => {
    const stat = statSync(file)
    return `${stat.dev}:${stat.ino}`
  }
  const same = existsSync(out) && (realpathSync(out) === realpathSync(path) || inode(out) === inode(path))
  if (same || resolve(out) === resolve(path)) {
    console.error('--out is the input file; refusing (the input is never written).')
    process.exit(1)
  }
}

const input = JSON.parse(readFileSync(path, 'utf8'))
const copy = structuredClone(input)
const exercises = (copy && copy.kind && copy.state ? copy.state : copy).exercises || []

// Every name and id is checked before anything changes, and all problems are listed at once.
const problems = []
for (const [name, id] of Object.entries(LINKS)) {
  const matches = exercises.filter((exercise) => exercise.name === name).length
  if (matches !== 1) problems.push(`"${name}" matches ${matches} exercises, not 1`)
  const entry = byId.get(id)
  if (!entry) problems.push(`"${name}" → ${id}: not in the library`)
  else if (entry.mergedInto || (entry.hidden && !HIDDEN_OK.has(name))) problems.push(`"${name}" → ${id}: hidden${entry.mergedInto ? `, merged into ${entry.mergedInto}` : ''}`)
}
if (problems.length) {
  console.error(`refusing — nothing written:\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}

console.log(`file: ${path}`)
let linked = 0
let equipped = 0
let untouched = 0
for (const exercise of exercises) {
  const id = LINKS[exercise.name]
  const parts = []
  if (id && exercise.libraryId !== id) {
    const entry = byId.get(id)
    parts.push(`libraryId ${exercise.libraryId || '—'} → ${id} (${entry.displayName || entry.name}${entry.hidden ? ', hidden' : ''}, unilateral ${entry.unilateral === true})`)
    exercise.libraryId = id
    linked += 1
  }
  if (Object.hasOwn(EQUIPMENT, exercise.equipment)) {
    parts.push(`equipment ${exercise.equipment} → ${EQUIPMENT[exercise.equipment]}`)
    exercise.equipment = EQUIPMENT[exercise.equipment]
    equipped += 1
  }
  if (!id) untouched += 1
  console.log(`  ${exercise.name}: ${parts.length ? parts.join(' · ') : 'unchanged'}`)
}

// Receipts: the copy loads as the input does (applyBackup, as Import runs it), and a field-level
// diff of input vs copy finds only the two fields above.
const countsOf = (doc) => {
  const { state } = applyBackup(doc)
  const sets = state.workouts.reduce((n, workout) => n + (workout.sets || []).length, 0)
  return `${state.exercises.length} exercises / ${state.routines.length} routines / ${state.workouts.length} workouts / ${sets} sets`
}
const diffs = new Map()
const walk = (a, b, at) => {
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], `${at}${Array.isArray(a) ? '[]' : `.${key}`}`)
  } else if (a !== b) diffs.set(at, (diffs.get(at) || 0) + 1)
}
walk(input, copy, '')

console.log(`\ntotals: ${linked} libraryId(s) set · ${equipped} equipment change(s) · ${untouched} exercise(s) not in the mapping`)
console.log(`input: ${countsOf(input)}`)
console.log(`copy:  ${countsOf(copy)}`)
console.log('field diff (input → copy):')
for (const [field, n] of diffs) console.log(`  ${field}: ${n}`)
const stray = [...diffs.keys()].filter((field) => !/^\.state\.exercises\[\]\.(libraryId|equipment)$|^\.exercises\[\]\.(libraryId|equipment)$/.test(field))
if (stray.length) {
  console.error(`refusing — the copy changes ${stray.join(', ')}; nothing written.`)
  process.exit(1)
}

if (out) {
  writeFileSync(out, `${JSON.stringify(copy, null, 2)}\n`)
  console.log(`\nwrote a linked copy to ${out}`)
}
