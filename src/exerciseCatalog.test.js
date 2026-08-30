import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogItemToExercise,
  fromRepdbItem,
  inferExerciseType,
  mergeCatalogs,
  searchExerciseCatalog,
} from './exerciseCatalog.js'
import { EXTRA_EXERCISES } from './exerciseExtras.js'

const catalog = [
  {
    id: 'Chest_Press',
    name: 'Chest Press',
    equipment: 'machine',
    category: 'strength',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    instructions: ['Sit down.', 'Press the handles forward.'],
  },
  {
    id: 'Incline_Dumbbell_Press',
    name: 'Incline Dumbbell Press',
    equipment: 'dumbbell',
    category: 'strength',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Press the dumbbells up.'],
  },
  {
    id: 'Pullups',
    name: 'Pullups',
    equipment: 'body only',
    category: 'strength',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps'],
    instructions: ['Pull your chin over the bar.'],
  },
  {
    id: 'Rowing',
    name: 'Rowing, Stationary',
    equipment: 'machine',
    category: 'cardio',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['biceps'],
    instructions: ['Row at a steady pace.'],
  },
]

describe('exercise catalog search', () => {
  it('ranks name matches ahead of muscle matches', () => {
    const hits = searchExerciseCatalog(catalog, 'chest')
    assert.equal(hits[0].name, 'Chest Press')
    assert.ok(hits.some((item) => item.name === 'Incline Dumbbell Press'))
  })

  it('needs at least two characters', () => {
    assert.deepEqual(searchExerciseCatalog(catalog, 'c'), [])
  })
})

describe('catalog mapping', () => {
  it('maps machine strength to machine with a 5 kg step', () => {
    const exercise = catalogItemToExercise(catalog[0])
    assert.equal(exercise.type, 'machine')
    assert.equal(exercise.equipment, 'Machine')
    assert.equal(exercise.weightStep, '5')
    assert.equal(exercise.muscles, 'Chest, Triceps, Shoulders')
    assert.match(exercise.cues, /Press the handles/)
  })

  it('maps body only to bodyweight', () => {
    assert.equal(inferExerciseType('body only', 'strength'), 'bodyweight')
    const exercise = catalogItemToExercise(catalog[2])
    assert.equal(exercise.type, 'bodyweight')
    assert.equal(exercise.equipment, 'Bodyweight')
    assert.equal(exercise.weightStep, 'n/a')
  })

  it('maps cardio machines to cardio', () => {
    const exercise = catalogItemToExercise(catalog[3])
    assert.equal(exercise.type, 'cardio')
    assert.equal(exercise.weightStep, 'n/a')
  })
})

describe('merged catalogs', () => {
  it('adds pike and diamond push-ups from the second catalog', () => {
    const extra = [
      fromRepdbItem({
        id: 'pike-push-ups',
        name_en: 'Pike Push Ups',
        is_bodyweight: true,
        category: 'strength',
        primary_muscles: ['anterior_deltoid'],
        secondary_muscles: ['triceps_brachii'],
        instructions_en: ['Hips high.', 'Lower your head toward the floor.'],
      }),
      fromRepdbItem({
        id: 'diamond-push-ups',
        name_en: 'Diamond Push Ups',
        is_bodyweight: true,
        category: 'strength',
        primary_muscles: ['triceps_brachii'],
        secondary_muscles: ['pectoralis_major'],
        instructions_en: ['Hands form a diamond.', 'Lower your chest.'],
      }),
    ]
    const merged = mergeCatalogs(catalog, extra)
    const pike = searchExerciseCatalog(merged, 'pike push')
    const diamond = searchExerciseCatalog(merged, 'diamond')
    assert.equal(pike[0].name, 'Pike Push Ups')
    assert.equal(diamond[0].name, 'Diamond Push Ups')
    const copied = catalogItemToExercise(diamond[0])
    assert.equal(copied.type, 'bodyweight')
    assert.equal(copied.equipment, 'Bodyweight')
  })

  it('does not duplicate a push-up that is already in the first catalog', () => {
    const extra = [
      fromRepdbItem({
        id: 'pushups',
        name_en: 'Push-Ups',
        is_bodyweight: true,
        category: 'strength',
        primary_muscles: [],
        secondary_muscles: [],
        instructions_en: [],
      }),
    ]
    const merged = mergeCatalogs([{ name: 'Pushups', equipment: 'body only' }], extra)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].name, 'Pushups')
  })
})

describe('local extras', () => {
  it('finds Prone YTW by ytw', () => {
    const hits = searchExerciseCatalog(EXTRA_EXERCISES, 'ytw')
    assert.equal(hits[0].name, 'Prone YTW')
    const copied = catalogItemToExercise(hits[0])
    assert.equal(copied.type, 'bodyweight')
  })

  it('finds Reverse Snow Angels', () => {
    const hits = searchExerciseCatalog(EXTRA_EXERCISES, 'snow angel')
    assert.equal(hits[0].name, 'Reverse Snow Angels')
  })
})
