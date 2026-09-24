// req-138 — the library text pass: every common entry carries our description, form cues,
// steps and mistakes; each text rule is proved by a failing fixture; the text reaches the
// library only through the tags path and never a non-common entry.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { libraryProblems, OWN_FIELDS, TEXT_FIELDS, textProblems } from './exerciseLibrary.js'
import { commonText } from './library/text.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const library = JSON.parse(readFileSync(join(here, 'library/exercises.json'), 'utf8'))
const common = library.filter((entry) => entry.common)
const byId = (id) => library.find((entry) => entry.id === id)

// A clean entry to break one rule at a time.
const base = byId('Barbell_Squat')
const problems = (change) => textProblems({ ...base, ...change })
const rejects = (change, pattern) => {
  const found = problems(change)
  assert.ok(found.some((line) => pattern.test(line)), `expected ${pattern} in ${JSON.stringify(found)}`)
}
const withStep = (text) => ({ steps: [...base.steps.slice(0, 3), text] })
const withCue = (text) => ({ formCues: [base.formCues[0], text] })

describe('coverage', () => {
  it('every common entry has all four fields and passes every text rule', () => {
    assert.equal(common.length, 218) // req-140 (sanctioned): 178 + batch 1's 40
    for (const entry of common) {
      for (const field of TEXT_FIELDS) assert.ok(field in entry, `${entry.id} lacks ${field}`)
      assert.deepEqual(textProblems(entry), [], entry.id)
    }
    assert.deepEqual(libraryProblems(library), [])
  })

  it('the text table covers exactly the common entries', () => {
    assert.deepEqual(Object.keys(commonText()).sort(), common.map((entry) => entry.id).sort())
  })

  it('no non-common entry carries text, and one that does is rejected', () => {
    for (const entry of library.filter((item) => !item.common)) {
      for (const field of TEXT_FIELDS) assert.ok(!(field in entry), `${entry.id} has ${field}`)
    }
    const fixture = library.map((entry) => (entry.id === 'Air_Bike' ? { ...entry, description: 'A bike.' } : entry))
    assert.deepEqual(libraryProblems(fixture).filter((line) => line.startsWith('Air_Bike:')), ['Air_Bike: description on a non-common entry'])
  })

  it('the four fields are own fields (stripped to prove the free-db part is unchanged)', () => {
    for (const field of TEXT_FIELDS) assert.ok(OWN_FIELDS.includes(field), field)
  })

  it('a missing field is a problem', () => {
    for (const field of TEXT_FIELDS) rejects({ [field]: undefined }, new RegExp(`^${field}: not a`))
  })
})

describe('shape', () => {
  it('base fixture is clean', () => assert.deepEqual(problems({}), []))

  it('description: one sentence, capped, ends with a period', () => {
    rejects({ description: 'A squat. It trains the legs.' }, /more than one sentence/)
    rejects({ description: `A ${'very '.repeat(30)}long sentence.` }, /> 120 characters/)
    rejects({ description: 'A squat that trains the legs' }, /does not end with a period/)
  })

  it('line counts per field', () => {
    rejects({ formCues: ['Brace'] }, /formCues: 1 lines, not 2–3/)
    rejects({ formCues: ['Brace', 'Sit', 'Stand', 'Look'] }, /formCues: 4 lines/)
    rejects({ steps: ['Stand.', 'Squat.'] }, /steps: 2 lines, not 3–6/)
    rejects({ steps: ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.'] }, /steps: 7 lines/)
    rejects({ mistakes: [] }, /mistakes: 0 lines, not 1–3/)
    rejects({ mistakes: ['A', 'B', 'C', 'D'] }, /mistakes: 4 lines/)
  })

  it('character caps per field', () => {
    rejects(withCue(`Keep ${'x'.repeat(70)}`), /formCues: \d+ > 70/)
    rejects(withStep(`Stand ${'x'.repeat(140)}.`), /steps: \d+ > 140/)
    rejects({ mistakes: [`Knees ${'x'.repeat(90)}`] }, /mistakes: \d+ > 90/)
  })

  it('punctuation: steps end with a period; cues and mistakes do not', () => {
    rejects(withStep('Stand up'), /does not end with a period/)
    rejects(withCue('Brace hard.'), /formCues: .* ends with a period/)
    rejects({ mistakes: ['Knees cave in.'] }, /mistakes: .* ends with a period/)
  })

  it('capital start and no outer whitespace', () => {
    rejects(withCue('brace hard'), /does not start with a capital/)
    rejects(withCue(' Brace hard'), /leading or trailing whitespace/)
    rejects(withStep('Stand up. '), /leading or trailing whitespace/)
  })

  it('steps are not numbered', () => {
    rejects(withStep('1. Stand up.'), /numbered step/)
    rejects(withStep('2) Stand up.'), /numbered step/)
  })
})

describe('boilerplate and breathing', () => {
  it('rejects the free-db boilerplate', () => {
    for (const text of [
      'Return to the starting position.',
      'Repeat for the recommended amount of repetitions.',
      'Repeat for the prescribed amount.',
      'Hold this portion of the movement.',
      'Breathe as you perform this movement.',
      'Tip: keep going.',
      'Caution: go slowly.',
      'Variations: use a dumbbell.',
    ]) rejects(withStep(text), /boilerplate/)
  })

  it('breathing words only in steps', () => {
    rejects(withCue('Exhale on the way up'), /breathing cue outside steps/)
    rejects({ mistakes: ['Holding the breath in, then inhaling fast'] }, /breathing cue outside steps/)
    rejects({ description: 'A squat where you breathe in at the top.' }, /breathing cue outside steps/)
    assert.deepEqual(problems(withStep('Exhale as you stand up.')), [])
  })
})

describe('no invented numbers', () => {
  it('rejects any digit, except an angle', () => {
    rejects(withStep('Lower for 3 counts.'), /a number/)
    rejects(withCue('Knees at 90'), /a number/)
    assert.deepEqual(problems(withStep('Bend your knees to 90 degrees.')), [])
    assert.deepEqual(problems(withStep('Bend your knees to 90°.')), [])
    assert.deepEqual(problems(withStep('Bend your knees to about 45-degree angles.')), [])
  })

  it('rejects a number word with a unit', () => {
    for (const text of ['Hold for two seconds.', 'Pause for a few breaths.', 'Do three reps each side.', 'Repeat several times.', 'Rest one minute.']) {
      rejects(withStep(text), /counted number/)
    }
    assert.deepEqual(problems(withStep('Hold briefly at the top.')), [])
  })

  it('rejects sets×reps, load units and RPE', () => {
    rejects(withStep('Do 3x10.'), /sets, load|a number/)
    rejects(withStep('Load it to bodyweight in kg.'), /sets, load/)
    rejects(withStep('Add weight until it feels like an rpe of eight.'), /sets, load/)
    rejects(withStep('Use lbs on the bar.'), /sets, load/)
  })
})

describe('hype and medical', () => {
  it('rejects hype words', () => {
    for (const word of ['great', 'best', 'ultimate', 'amazing', 'excellent', 'perfect', 'effective']) {
      rejects({ description: `A squat, the ${word} leg move.` }, /hype word/)
    }
  })

  it('rejects medical words', () => {
    for (const text of ['Stop if you feel pain', 'Helps prevent knee trouble', 'Good for injury recovery', 'Used in rehab', 'Aids healing', 'A therapy move']) {
      rejects({ mistakes: [text] }, /medical word/)
    }
    assert.deepEqual(problems({ mistakes: ['Heels lift off the floor'] }), [])
  })
})

describe('unilateral and duplicates', () => {
  it('a unilateral entry names the other side in its steps', () => {
    rejects({ unilateral: true }, /unilateral entry/)
    for (const text of ['Repeat on each side.', 'Finish, then switch sides.', 'Do the same on the other side.', 'Do the reps with each leg.']) {
      assert.deepEqual(problems({ unilateral: true, ...withStep(text) }), [], text)
    }
    const oneSided = common.filter((entry) => entry.unilateral)
    assert.equal(oneSided.length, 23) // req-140 (sanctioned): + split squat, cable kickback, pistol, DB snatch
  })

  it('the same line twice in an entry is rejected, across fields too', () => {
    rejects({ formCues: ['Brace hard', 'Brace hard'] }, /repeats formCues/)
    rejects({ mistakes: [base.formCues[0]] }, /repeats formCues/)
    rejects({ steps: [...base.steps.slice(0, 3), base.steps[0]] }, /repeats steps/)
  })
})

describe('bundle', () => {
  it('text.js is imported only by exerciseLibrary.js', () => {
    const files = []
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(js|jsx|mjs)$/.test(name) && !name.endsWith('.test.js')) files.push(path)
      }
    }
    walk(here)
    const importers = files.filter((path) => /from '\.\/library\/text\.js'|from '\.\/text\.js'/.test(readFileSync(path, 'utf8')))
    assert.deepEqual(importers.map((path) => relative(here, path)), ['exerciseLibrary.js'])
  })
})
