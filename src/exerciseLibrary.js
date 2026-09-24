// req-130 / DEC-060 — our own exercise library: a pinned copy of free-exercise-db
// (Unlicense) with our extras, our own entries and our added fields folded in.
// Provenance: src/library/PROVENANCE.md.
//
// src/library/exercises.json is GENERATED from the pinned source by
// scripts/build-library.mjs using deriveLibrary() below — never hand-edit it; change
// the tables here (and in src/library/common.js, own-exercises.js) and re-run the
// script (exerciseLibrary.test.js fails on drift).
//
// Nothing from RepDB goes in the library, links included: RepDB stays a live,
// unmodified fetch in exerciseCatalog.js.
//
// Ids are stored data (exercise.libraryId) and permanent: free-db ids unchanged,
// `extra-*` for the extras, `own-*` for entries of ours. Never rename or reuse one.

import { EXTRA_EXERCISES } from './exerciseExtras.js'
import { commonExercises, EQUIPMENT_EXCEPTIONS, GROUP_EXCEPTIONS } from './library/common.js'
import { OWN_EXERCISES } from './library/own-exercises.js'

export { OWN_EXERCISES }

// Name key used for dedupe, aliases and the resolver (re-exported by exerciseCatalog.js).
export function catalogNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/push[\s-]*ups?/g, 'pushup')
    .replace(/[^a-z0-9]+/g, '')
}

export const FREE_DB_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f'
// sha256 of the pinned dist/exercises.json (JSON.stringify(list, null, 2) + '\n'
// reproduces it byte for byte).
export const FREE_DB_SHA256 = '5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf'
export const FREE_DB_SOURCE_URL = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FREE_DB_COMMIT}/dist/exercises.json`
export const FREE_DB_PHOTO_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FREE_DB_COMMIT}/exercises/`

// The fields we add to a free-db entry (stripped again to prove the rest is unchanged).
export const OWN_FIELDS = [
  'aliases', 'muscleGroups', 'photos',
  // req-133 — the DEC-062 fields, on common entries only (no reader until req-134/135/132).
  'muscles', 'pattern', 'equipmentList', 'logAs', 'unilateral', 'common', 'family',
]

// primaryMuscles → coarse group. Every primary muscle in the library must be here.
// rhomboids / rear delts come from the extras (unconfirmed, req-130 spec).
export const MUSCLE_GROUPS = {
  Chest: ['chest'],
  Back: ['lats', 'middle back', 'lower back', 'traps', 'rhomboids'],
  Shoulders: ['shoulders', 'neck', 'rear delts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
  Core: ['abdominals'],
}

const GROUP_OF = new Map(
  Object.entries(MUSCLE_GROUPS).flatMap(([group, muscles]) => muscles.map((m) => [m, group])),
)

// Groups in table order; throws on a muscle the table doesn't cover.
export function muscleGroupsFor(primaryMuscles) {
  const found = new Set()
  for (const muscle of primaryMuscles || []) {
    const group = GROUP_OF.get(muscle)
    if (!group) throw new Error(`No muscle group for primary muscle "${muscle}".`)
    found.add(group)
  }
  return Object.keys(MUSCLE_GROUPS).filter((group) => found.has(group))
}

// req-133 / DEC-062 — the muscle tree: group → muscle → part. Choosing a node includes
// everything under it; entries are tagged at the finest node that is true (a parent
// when its parts are hit about equally). Roots are the MUSCLE_GROUPS labels. Keys
// (catalogNameKey of id, label and aliases) are unique across nodes.
export const MUSCLE_TREE = {
  arms: { label: 'Arms', parent: null, aliases: ['arm'] },
  biceps: { label: 'Biceps', parent: 'arms', aliases: ['bicep'] },
  triceps: { label: 'Triceps', parent: 'arms', aliases: ['tricep'] },
  forearms: { label: 'Forearms', parent: 'arms', aliases: ['forearm', 'grip'] },
  brachialis: { label: 'Brachialis', parent: 'arms', aliases: [] },
  shoulders: { label: 'Shoulders', parent: null, aliases: [] },
  deltoids: { label: 'Deltoids', parent: 'shoulders', aliases: ['delts', 'deltoid'] },
  'front-delt': { label: 'Front delt', parent: 'deltoids', aliases: ['front delts', 'anterior deltoid'] },
  'side-delt': { label: 'Side delt', parent: 'deltoids', aliases: ['side delts', 'lateral deltoid', 'medial deltoid'] },
  'rear-delt': { label: 'Rear delt', parent: 'deltoids', aliases: ['rear delts', 'posterior deltoid'] },
  'rotator-cuff': { label: 'Rotator cuff', parent: 'shoulders', aliases: [] },
  neck: { label: 'Neck', parent: 'shoulders', aliases: [] },
  chest: { label: 'Chest', parent: null, aliases: [] },
  pecs: { label: 'Pecs', parent: 'chest', aliases: ['pectorals', 'pec'] },
  'upper-chest': { label: 'Upper chest', parent: 'pecs', aliases: ['clavicular'] },
  'mid-lower-chest': { label: 'Mid/lower chest', parent: 'pecs', aliases: ['lower chest', 'sternal'] },
  back: { label: 'Back', parent: null, aliases: [] },
  lats: { label: 'Lats', parent: 'back', aliases: ['latissimus', 'lat'] },
  traps: { label: 'Traps', parent: 'back', aliases: ['trapezius', 'trap'] },
  rhomboids: { label: 'Rhomboids', parent: 'back', aliases: ['upper back', 'mid back'] },
  'lower-back': { label: 'Lower back', parent: 'back', aliases: ['erectors', 'erector spinae'] },
  core: { label: 'Core', parent: null, aliases: [] },
  abs: { label: 'Abs', parent: 'core', aliases: ['abdominals', 'stomach', 'six pack', 'rectus abdominis'] },
  obliques: { label: 'Obliques', parent: 'core', aliases: ['side abs'] },
  'hip-flexors': { label: 'Hip flexors', parent: 'core', aliases: ['iliopsoas'] },
  legs: { label: 'Legs', parent: null, aliases: ['leg'] },
  quads: { label: 'Quads', parent: 'legs', aliases: ['quadriceps', 'quad', 'front thigh'] },
  hamstrings: { label: 'Hamstrings', parent: 'legs', aliases: ['hamstring', 'hams'] },
  glutes: { label: 'Glutes', parent: 'legs', aliases: ['glute', 'butt', 'gluteus'] },
  'glute-max': { label: 'Glute max', parent: 'glutes', aliases: ['gluteus maximus'] },
  'glute-med': { label: 'Glute med', parent: 'glutes', aliases: ['gluteus medius'] },
  calves: { label: 'Calves', parent: 'legs', aliases: ['calf', 'gastrocnemius', 'soleus'] },
  adductors: { label: 'Adductors', parent: 'legs', aliases: ['inner thigh'] },
  abductors: { label: 'Abductors', parent: 'legs', aliases: ['outer thigh'] },
}

// free-db's 17 muscle strings + the extras' two (the req-130 table's 19) → tree node.
// No serratus/tibialis (deliberate).
export const FREE_DB_MUSCLE_TO_TREE = {
  chest: 'pecs',
  lats: 'lats',
  'middle back': 'rhomboids',
  'lower back': 'lower-back',
  traps: 'traps',
  shoulders: 'deltoids',
  neck: 'neck',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abdominals: 'abs',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abductors: 'abductors',
  adductors: 'adductors',
  rhomboids: 'rhomboids',
  'rear delts': 'rear-delt',
}

export const PATTERNS = [
  'squat', 'hinge', 'lunge', 'bridge', 'hip-extension', 'horizontal-push', 'vertical-push',
  'horizontal-pull', 'vertical-pull', 'pullover', 'fly', 'raise', 'curl', 'elbow-extension',
  'leg-curl', 'leg-extension', 'hip-abduction', 'hip-adduction', 'calf-raise', 'shrug', 'carry',
  'core-flexion', 'core-stability', 'core-rotation', 'cardio', 'plyometric', 'olympic', 'mobility',
]

export const EQUIPMENT = [
  'barbell', 'ez-bar', 'trap-bar', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith-machine',
  'bench', 'pull-up-bar', 'dip-bars', 'suspension', 'roman-chair', 'bands', 'bodyweight',
  'medicine-ball', 'exercise-ball', 'ab-wheel', 'landmine', 'foam-roller', 'box', 'sled', 'plate',
  'sandbag', 'battle-ropes', 'jump-rope', 'cardio-machine',
]
export const LOAD_EQUIPMENT = [
  'barbell', 'ez-bar', 'trap-bar', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith-machine',
  'landmine', 'sled', 'plate', 'sandbag', 'medicine-ball',
]

// How it's logged (applied to the app's model later, by req-132).
export const LOG_AS = ['weight-reps', 'bodyweight-reps', 'weight-time', 'time', 'cardio']

// A pattern that implies a primary muscle: at least one primary must be one of these or under one.
export const PATTERN_PRIMARY = {
  curl: ['biceps', 'brachialis', 'forearms'],
  'elbow-extension': ['triceps'],
  'leg-curl': ['hamstrings'],
  'leg-extension': ['quads'],
  'calf-raise': ['calves'],
  shrug: ['traps'],
  'horizontal-pull': ['lats', 'rhomboids', 'traps', 'rear-delt'],
  'vertical-pull': ['lats', 'rhomboids', 'traps', 'rear-delt'],
}

// The obvious free-db equipment → our equipment (any one of the values must be listed).
// 'other', blank and missing make no claim.
export const FREE_DB_EQUIPMENT_TO_LIST = {
  barbell: ['barbell'],
  dumbbell: ['dumbbell'],
  cable: ['cable'],
  machine: ['machine', 'smith-machine', 'cardio-machine'],
  kettlebells: ['kettlebell'],
  'e-z curl bar': ['ez-bar'],
  'body only': ['bodyweight'],
  bands: ['bands'],
  'medicine ball': ['medicine-ball'],
  'exercise ball': ['exercise-ball'],
  'foam roll': ['foam-roller'],
}

// Aliases never allowed on their own (req-130 review: they reorder single-word search).
const BARE_ALIAS_KEYS = new Set(['press', 'row', 'machine'])

export const COMMON_COUNT_RANGE = [130, 170]

// The group root of a tree node (undefined for an unknown id).
export function muscleGroupOf(nodeId) {
  const seen = new Set()
  let id = nodeId
  while (MUSCLE_TREE[id] && MUSCLE_TREE[id].parent && !seen.has(id)) {
    seen.add(id)
    id = MUSCLE_TREE[id].parent
  }
  return MUSCLE_TREE[id] && !MUSCLE_TREE[id].parent ? MUSCLE_TREE[id].label : undefined
}

// True when `nodeId` is `ancestorId` or sits under it.
export function isUnderMuscle(nodeId, ancestorId) {
  for (let id = nodeId, steps = 0; id && steps < 10; id = MUSCLE_TREE[id]?.parent, steps += 1) {
    if (id === ancestorId) return true
  }
  return false
}

// Groups in table order from the primary tree tags.
function groupsForMuscles(muscles) {
  const found = new Set(muscles.filter((m) => m.role === 'primary').map((m) => muscleGroupOf(m.id)))
  return Object.keys(MUSCLE_GROUPS).filter((group) => found.has(group))
}

// A family of one is named after its entry: `fam-` + the id in kebab case.
export function ownFamilyId(entryId) {
  return `fam-${String(entryId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
}

// Problems with the tree itself: unknown parents, a chain that doesn't reach a group,
// a root that isn't a MUSCLE_GROUPS label, a key on two nodes.
export function muscleTreeProblems(tree = MUSCLE_TREE) {
  const problems = []
  const keyOwner = new Map()
  for (const [id, node] of Object.entries(tree)) {
    let at = id
    for (let steps = 0; tree[at]?.parent && steps < 10; steps += 1) at = tree[at].parent
    if (!tree[at]) problems.push(`muscle ${id}: parent chain hits unknown node "${at}"`)
    else if (tree[at].parent) problems.push(`muscle ${id}: parent chain does not end at a group`)
    else if (!(tree[at].label in MUSCLE_GROUPS)) problems.push(`muscle ${id}: group "${tree[at].label}" is not a MUSCLE_GROUPS label`)
    for (const key of new Set([id, node.label, ...node.aliases].map(catalogNameKey))) {
      if (keyOwner.has(key)) problems.push(`muscle key "${key}" on ${keyOwner.get(key)} and ${id}`)
      else keyOwner.set(key, id)
    }
  }
  return problems
}

const NEW_FIELDS = ['muscles', 'pattern', 'equipmentList', 'logAs', 'unilateral', 'common', 'family']

// Everything the fixed structure rejects, one line each ([] = clean). Run by
// deriveLibrary (the build refuses) and by the tests (against failing fixtures too).
export function libraryProblems(list, {
  equipmentExceptions = EQUIPMENT_EXCEPTIONS,
  groupExceptions = GROUP_EXCEPTIONS,
} = {}) {
  const problems = []
  const bad = (entry, message) => problems.push(`${entry.id}: ${message}`)
  const nameOwner = new Map(list.map((entry) => [catalogNameKey(entry.name), entry.id]))
  const aliasOwner = new Map()
  const families = new Map()
  for (const entry of list) {
    if (entry.common) families.set(entry.family, (families.get(entry.family) || 0) + 1)
  }
  for (const entry of list) {
    for (const alias of entry.aliases || []) {
      const key = catalogNameKey(alias)
      if (BARE_ALIAS_KEYS.has(key)) bad(entry, `bare alias "${alias}"`)
      if (aliasOwner.has(key) && aliasOwner.get(key) !== entry.id) bad(entry, `alias "${alias}" is also on ${aliasOwner.get(key)}`)
      aliasOwner.set(key, entry.id)
      if (nameOwner.has(key) && nameOwner.get(key) !== entry.id) bad(entry, `alias "${alias}" is ${nameOwner.get(key)}'s name`)
    }
    if (entry.id.startsWith('own-')) {
      for (const muscle of [...(entry.primaryMuscles || []), ...(entry.secondaryMuscles || [])]) {
        if (!(muscle in FREE_DB_MUSCLE_TO_TREE)) bad(entry, `legacy muscle "${muscle}" is not in the req-130 table`)
      }
      if (!entry.equipment || !(entry.instructions || []).length) bad(entry, 'own entry lacks legacy equipment/instructions')
    }
    if (!entry.common) {
      for (const field of NEW_FIELDS) if (field in entry) bad(entry, `${field} on a non-common entry`)
      continue
    }
    const muscles = entry.muscles || []
    const primary = muscles.filter((m) => m.role === 'primary').map((m) => m.id)
    const equipment = entry.equipmentList || []
    for (const m of muscles) {
      if (!(m.id in MUSCLE_TREE)) bad(entry, `muscle "${m.id}" is off the tree`)
      if (m.role !== 'primary' && m.role !== 'secondary') bad(entry, `muscle role "${m.role}"`)
    }
    if (new Set(muscles.map((m) => m.id)).size !== muscles.length) bad(entry, 'a muscle is tagged twice')
    if (!primary.length) bad(entry, 'no primary muscle')
    if (!PATTERNS.includes(entry.pattern)) bad(entry, `pattern "${entry.pattern}" is off the list`)
    if (!equipment.length) bad(entry, 'no equipment')
    for (const item of equipment) if (!EQUIPMENT.includes(item)) bad(entry, `equipment "${item}" is off the list`)
    if (new Set(equipment).size !== equipment.length) bad(entry, 'equipment listed twice')
    if (!LOG_AS.includes(entry.logAs)) bad(entry, `logAs "${entry.logAs}" is off the list`)
    if (typeof entry.unilateral !== 'boolean') bad(entry, 'unilateral is not a boolean')
    if (!/^fam-[a-z0-9]+(-[a-z0-9]+)*$/.test(String(entry.family))) bad(entry, `family "${entry.family}" is not fam-kebab-case`)
    else if (families.get(entry.family) < 2 && entry.family !== ownFamilyId(entry.id)) {
      bad(entry, `family "${entry.family}" has one member; a family of one is ${ownFamilyId(entry.id)}`)
    }
    const required = PATTERN_PRIMARY[entry.pattern]
    if (required && !primary.some((id) => required.some((need) => isUnderMuscle(id, need)))) {
      bad(entry, `pattern ${entry.pattern} needs a primary in ${required.join('/')}`)
    }
    const loaded = equipment.some((item) => LOAD_EQUIPMENT.includes(item))
    if ((entry.logAs === 'bodyweight-reps' || entry.logAs === 'time') && loaded) bad(entry, `${entry.logAs} with load equipment`)
    if ((entry.logAs === 'weight-reps' || entry.logAs === 'weight-time') && !loaded) bad(entry, `${entry.logAs} without load equipment`)
    if ((entry.pattern === 'cardio') !== (entry.logAs === 'cardio')) bad(entry, 'cardio pattern and cardio logAs must go together')
    const expected = FREE_DB_EQUIPMENT_TO_LIST[entry.equipment]
    if (expected && !expected.some((item) => equipment.includes(item)) && !equipmentExceptions[entry.id]) {
      bad(entry, `free-db equipment "${entry.equipment}" → none of ${expected.join('/')} listed`)
    }
    const treeGroups = new Set(primary.map(muscleGroupOf))
    const tableGroups = muscleGroupsFor(entry.primaryMuscles)
    const missing = tableGroups.filter((group) => !treeGroups.has(group))
    if (missing.length && !groupExceptions[entry.id]) bad(entry, `free-db primary groups ${missing.join('/')} not in the tree tags`)
  }
  return problems
}

function withOwnFields(entry, { aliases = [], photos = [], tags }) {
  const out = { ...entry }
  for (const field of OWN_FIELDS) delete out[field]
  const allAliases = [...aliases, ...(tags?.aliases || [])]
  if (allAliases.length) out.aliases = allAliases
  // req-133 — tagged entries: groups from the primary tree tags, same labels and order.
  out.muscleGroups = tags ? groupsForMuscles(tags.muscles) : muscleGroupsFor(entry.primaryMuscles)
  out.photos = photos
  if (tags) {
    out.muscles = tags.muscles
    out.pattern = tags.pattern
    out.equipmentList = tags.equipmentList
    out.logAs = tags.logAs
    out.unilateral = tags.unilateral
    out.common = true
    out.family = tags.family
  }
  return out
}

// The pinned free-db list → our library: free-db entries (order and fields unchanged,
// our fields appended), then the extras, then our own entries. Refuses on any problem.
export function deriveLibrary(freeDb) {
  const common = new Map(commonExercises().map((tags) => [tags.id, tags]))
  const list = [
    ...freeDb.map((entry) =>
      withOwnFields(entry, {
        photos: (entry.images || []).map((path) => FREE_DB_PHOTO_BASE + path),
        tags: common.get(entry.id),
      }),
    ),
    ...EXTRA_EXERCISES.map((entry) => withOwnFields(entry, { aliases: entry.aliases || [], tags: common.get(entry.id) })),
    ...OWN_EXERCISES.map((entry) => withOwnFields(entry, { tags: common.get(entry.id) })),
  ]
  const known = new Set(list.map((entry) => entry.id))
  for (const id of common.keys()) {
    if (!known.has(id)) throw new Error(`Common entry "${id}" is not in the library.`)
  }
  const problems = [...muscleTreeProblems(), ...libraryProblems(list)]
  if (problems.length) throw new Error(`Library problems:\n${problems.join('\n')}`)
  return list
}

// Lazy chunk (~1 MB) so the main bundle doesn't carry it. The `with` attribute is
// required by node --test (ERR_IMPORT_ATTRIBUTE_MISSING without it).
let libraryPromise = null
export function loadExerciseLibrary() {
  if (!libraryPromise) {
    libraryPromise = import('./library/exercises.json', { with: { type: 'json' } })
      .then((mod) => mod.default)
      .catch((error) => {
        libraryPromise = null
        throw error
      })
  }
  return libraryPromise
}

const indexes = new WeakMap()
function indexFor(library) {
  let index = indexes.get(library)
  if (!index) {
    index = { byId: new Map(), byName: new Map(), byAlias: new Map() }
    for (const entry of library) {
      index.byId.set(entry.id, entry)
      const nameKey = catalogNameKey(entry.name)
      if (nameKey && !index.byName.has(nameKey)) index.byName.set(nameKey, entry)
      for (const alias of entry.aliases || []) {
        const aliasKey = catalogNameKey(alias)
        if (aliasKey && !index.byAlias.has(aliasKey)) index.byAlias.set(aliasKey, entry)
      }
    }
    indexes.set(library, index)
  }
  return index
}

// The library entry for a stored exercise: its libraryId when that's in the library,
// else the exact name key, else an alias key, else null. No fuzzy guess.
export function libraryEntryFor(exercise, library) {
  if (!exercise || !library) return null
  const index = indexFor(library)
  if (exercise.libraryId && index.byId.has(exercise.libraryId)) return index.byId.get(exercise.libraryId)
  const key = catalogNameKey(exercise.name)
  if (!key) return null
  return index.byName.get(key) || index.byAlias.get(key) || null
}
