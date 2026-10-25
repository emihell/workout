// req-233 — scripts/link-library-ids.mjs on a fixture Export: it links by exact name, spells
// Kettlebells, changes nothing else, and on a bad mapping exits non-zero and writes nothing.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BACKUP_KIND, BACKUP_VERSION, applyBackup } from './exchange.js'
import { emptyState } from './persistence.js'

const script = new URL('../scripts/link-library-ids.mjs', import.meta.url).pathname
const library = JSON.parse(readFileSync(new URL('./library/exercises.json', import.meta.url), 'utf8'))
// The mapping's names, read from the script's LINKS table (one source for the list).
const names = [...readFileSync(script, 'utf8').match(/const LINKS = \{([\s\S]*?)\n\}/)[1].matchAll(/^ {2}'([^']+)': '/gm)].map((m) => m[1])

const exercise = (name, extra = {}) => ({ id: `ex-${name}`, name, equipment: 'Machine', ...extra })
const exportOf = (exercises) => ({ kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: '2026-10-22T09:59:38Z', state: { ...emptyState(), exercises } })
const fixture = () => exportOf([
  ...names.map((name) => exercise(name, name === 'Kettlebell Concentration Curl' ? { equipment: 'Kettlebell' } : {})),
  exercise('Kettlebell Lunge Press', { equipment: 'Kettlebell' }),
  exercise('Löpning', { equipment: 'Utomhus' }),
  exercise('Sit-Up', { libraryId: 'Sit-Up' }),
])

function run(doc, { out = true, lib = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'link-'))
  const input = join(dir, 'export.json')
  const text = `${JSON.stringify(doc, null, 2)}\n`
  writeFileSync(input, text)
  const copy = join(dir, 'linked.json')
  const env = { ...process.env }
  if (lib) {
    env.WORKOUT_LIBRARY = join(dir, 'library.json')
    writeFileSync(env.WORKOUT_LIBRARY, JSON.stringify(lib))
  }
  const result = spawnSync(process.execPath, [script, input, ...(out ? ['--out', copy] : [])], { encoding: 'utf8', env })
  assert.equal(readFileSync(input, 'utf8'), text, 'the input is never written')
  return { ...result, input, copy, wrote: existsSync(copy) }
}

describe('req-233 — link library ids on a copy', () => {
  it('the mapping has 39 names, each to a library id', () => {
    assert.equal(names.length, 39)
  })

  it('links every mapped name, spells Kettlebells, and changes no other field', () => {
    const doc = fixture()
    const result = run(doc)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /totals: 39 libraryId\(s\) set · 2 equipment change\(s\) · 3 exercise\(s\) not in the mapping/)
    assert.match(result.stdout, /field diff \(input → copy\):\n {2}\.state\.exercises\[\]\.libraryId: 39\n {2}\.state\.exercises\[\]\.equipment: 2\n/)
    const copy = JSON.parse(readFileSync(result.copy, 'utf8'))
    const byName = new Map(copy.state.exercises.map((e) => [e.name, e]))
    assert.equal(byName.get('Biceps Curl').libraryId, 'Machine_Bicep_Curl')
    assert.equal(byName.get('Leg Curl').libraryId, 'Lying_Leg_Curls')
    assert.equal(byName.get('Kettlebell Arnold Press').libraryId, 'Kettlebell_Arnold_Press')
    assert.equal(byName.get('Kettlebell Dead Clean').libraryId, 'One-Arm_Kettlebell_Clean')
    assert.equal(byName.get('Kettlebell Lunge Press').libraryId, undefined)
    assert.equal(byName.get('Kettlebell Lunge Press').equipment, 'Kettlebells')
    assert.equal(byName.get('Löpning').libraryId, undefined)
    // Strip the two fields and the copy is the input.
    const strip = (d) => d.state.exercises.map(({ libraryId: _l, equipment: _e, ...rest }) => rest)
    assert.deepEqual(strip(copy), strip(doc))
    assert.deepEqual({ ...copy, state: { ...copy.state, exercises: null } }, { ...doc, state: { ...doc.state, exercises: null } })
    assert.equal(applyBackup(copy).state.exercises.length, applyBackup(doc).state.exercises.length)
  })

  it('a dry run writes nothing', () => {
    const result = run(fixture(), { out: false })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.wrote, false)
  })

  it('a mapping name that is missing → exit 1, nothing written', () => {
    const doc = fixture()
    doc.state.exercises = doc.state.exercises.filter((e) => e.name !== 'Leg Curl')
    const result = run(doc)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /"Leg Curl" matches 0 exercises, not 1/)
    assert.equal(result.wrote, false)
  })

  it('a mapping name that matches twice → exit 1, nothing written', () => {
    const doc = fixture()
    doc.state.exercises.push(exercise('Leg Curl', { id: 'ex-leg-curl-2' }))
    const result = run(doc)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /"Leg Curl" matches 2 exercises, not 1/)
    assert.equal(result.wrote, false)
  })

  it('a library id that does not exist → exit 1, nothing written', () => {
    const result = run(fixture(), { lib: library.filter((entry) => entry.id !== 'Lying_Leg_Curls') })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /"Leg Curl" → Lying_Leg_Curls: not in the library/)
    assert.equal(result.wrote, false)
  })

  it('a hidden id outside the allowlist → exit 1, nothing written', () => {
    const result = run(fixture(), { lib: library.map((entry) => (entry.id === 'Lying_Leg_Curls' ? { ...entry, hidden: true } : entry)) })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /"Leg Curl" → Lying_Leg_Curls: hidden/)
    assert.equal(result.wrote, false)
  })

  it('an allowlisted name whose entry is merged → still refused', () => {
    const lib = library.map((entry) => (entry.id === 'Kettlebell_Arnold_Press' ? { ...entry, hidden: true, mergedInto: 'Dumbbell_Shoulder_Press' } : entry))
    const result = run(fixture(), { lib })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /"Kettlebell Arnold Press" → Kettlebell_Arnold_Press: hidden, merged into Dumbbell_Shoulder_Press/)
    assert.equal(result.wrote, false)
  })

  it('--out equal to the input (by path or by symlink) → refused', () => {
    const dir = mkdtempSync(join(tmpdir(), 'link-'))
    const input = join(dir, 'export.json')
    const text = JSON.stringify(fixture())
    writeFileSync(input, text)
    const link = join(dir, 'alias.json')
    symlinkSync(input, link)
    for (const out of [input, link]) {
      const result = spawnSync(process.execPath, [script, input, '--out', out], { encoding: 'utf8' })
      assert.equal(result.status, 1)
      assert.match(result.stderr, /--out is the input file; refusing/)
      assert.equal(readFileSync(input, 'utf8'), text)
    }
  })
})
