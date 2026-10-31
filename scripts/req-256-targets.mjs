#!/usr/bin/env node
// req-256 AC2 — read-only: every target in one saved state, read by main's isDurationTarget (the old
// trailing-"s" rule, inlined below) and by this branch's. Prints both `true` sets and the difference.
//
//   node scripts/req-256-targets.mjs --db <workout.db> --user <id> [--rev <n>]   (newest rev if omitted)
//   node scripts/req-256-targets.mjs --state <state.json>
//   node scripts/req-256-targets.mjs --list '12 reps' '60s' …
//
// The DB is opened readOnly; nothing is written anywhere.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { isDurationTarget } from '../src/progress.js'

const oldRule = (value) => {
  const t = String(value || '').toLowerCase()
  return t.includes('min') || t.includes('sec') || /s$/.test(t.replace(/\s/g, ''))
}

const args = process.argv.slice(2)
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

function targetsIn(node, out = new Set()) {
  if (Array.isArray(node)) node.forEach((v) => targetsIn(v, out))
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'targets' && Array.isArray(value)) value.forEach((t) => typeof t === 'string' && out.add(t))
      else if (key === 'target' && typeof value === 'string') out.add(value)
      else targetsIn(value, out)
    }
  }
  return out
}

let targets
let source
if (args.includes('--list')) {
  targets = new Set(args.slice(args.indexOf('--list') + 1))
  source = 'list'
} else if (flag('--state')) {
  targets = targetsIn(JSON.parse(readFileSync(flag('--state'), 'utf8')))
  source = flag('--state')
} else if (flag('--db')) {
  const db = new DatabaseSync(flag('--db'), { readOnly: true })
  const user = Number(flag('--user'))
  const row = flag('--rev')
    ? db.prepare('SELECT rev, state FROM revisions WHERE user_id = ? AND rev = ?').get(user, Number(flag('--rev')))
    : db.prepare('SELECT rev, state FROM revisions WHERE user_id = ? ORDER BY rev DESC LIMIT 1').get(user)
  db.close()
  if (!row) throw new Error('no such revision')
  targets = targetsIn(JSON.parse(row.state))
  source = `user ${user} rev ${row.rev}`
} else {
  console.error('usage: --db <file> --user <id> [--rev <n>] | --state <file> | --list <t>…')
  process.exit(2)
}

const before = [...targets].filter(oldRule).sort()
const after = [...targets].filter(isDurationTarget).sort()
console.log(`source: ${source} · ${targets.size} distinct targets`)
console.log(`main   true (${before.length}): ${JSON.stringify(before)}`)
console.log(`branch true (${after.length}): ${JSON.stringify(after)}`)
const lost = before.filter((t) => !after.includes(t))
const gained = after.filter((t) => !before.includes(t))
console.log(`identical: ${!lost.length && !gained.length}${lost.length ? ` · no longer duration: ${JSON.stringify(lost)}` : ''}${gained.length ? ` · newly duration: ${JSON.stringify(gained)}` : ''}`)
