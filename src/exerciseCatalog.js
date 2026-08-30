import { EXTRA_EXERCISES } from './exerciseExtras.js'

const FREE_EXERCISE_DB_URL = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json'
const REPDB_URL = 'https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@main/exercises.json'

const MACHINE_EQUIPMENT = new Set(['machine', 'cable'])
const BODYWEIGHT_EQUIPMENT = new Set(['body only', 'foam roll', 'bodyweight', 'body weight', 'none', ''])
const MACHINE_EQUIPMENT_HINTS = /machine|pec deck|leg press|leg curl|leg extension|hack squat|lat pulldown/

let catalogPromise = null

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error('Could not load the exercise database.')
    return response.json()
  })
}

export function catalogNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/push[\s-]*ups?/g, 'pushup')
    .replace(/[^a-z0-9]+/g, '')
}

export function fromRepdbItem(item) {
  const equipmentRaw = String(item.equipment || '').toLowerCase().replace(/_/g, ' ')
  let equipment = 'body only'
  if (!item.is_bodyweight && equipmentRaw) {
    if (MACHINE_EQUIPMENT_HINTS.test(equipmentRaw)) equipment = 'machine'
    else if (equipmentRaw === 'cable') equipment = 'cable'
    else equipment = equipmentRaw
  }
  return {
    id: `repdb-${item.id}`,
    name: String(item.name_en || item.name || '').trim(),
    equipment,
    category: item.category || 'strength',
    primaryMuscles: item.primary_muscles || [],
    secondaryMuscles: item.secondary_muscles || [],
    instructions: item.instructions_en || item.instructions || [],
  }
}

export function mergeCatalogs(primary, extra) {
  const merged = []
  const seen = new Set()
  for (const item of [...(primary || []), ...(extra || [])]) {
    const name = String(item?.name || '').trim()
    if (!name) continue
    const key = catalogNameKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

export function loadExerciseCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.allSettled([fetchJson(FREE_EXERCISE_DB_URL), fetchJson(REPDB_URL)]).then(
      (results) => {
        const freeDb = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : []
        const repdbPayload = results[1].status === 'fulfilled' ? results[1].value : null
        const repdb = Array.isArray(repdbPayload?.exercises) ? repdbPayload.exercises.map(fromRepdbItem) : []
        const merged = mergeCatalogs(freeDb, [...repdb, ...EXTRA_EXERCISES])
        if (!merged.length) throw new Error('Could not load the exercise database.')
        return merged
      },
    ).catch((error) => {
      catalogPromise = null
      throw error
    })
  }
  return catalogPromise
}

function compactText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function searchExerciseCatalog(list, query, limit = 25) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) return []
  const qCompact = compactText(q)
  const scored = []
  for (const item of list || []) {
    const name = String(item.name || '').toLowerCase()
    const aliases = (item.aliases || []).join(' ').toLowerCase()
    const muscles = [...(item.primaryMuscles || []), ...(item.secondaryMuscles || [])].join(' ').toLowerCase()
    const equipment = String(item.equipment || '').toLowerCase()
    const compactName = compactText(`${name} ${aliases}`)
    let score = -1
    if (name === q) score = 0
    else if (name.startsWith(q) || aliases.split(/\s+/).some((alias) => alias === q)) score = 1
    else if (name.includes(q) || aliases.includes(q)) score = 2
    else if (qCompact.length >= 3 && compactName.includes(qCompact)) score = 2
    else if (muscles.includes(q) || equipment.includes(q)) score = 3
    if (score >= 0) scored.push({ item, score, name })
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
  return scored.slice(0, limit).map((row) => row.item)
}

function titleCase(value) {
  return String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function inferExerciseType(equipment, category) {
  const cat = String(category || '').toLowerCase()
  const eq = String(equipment || '').toLowerCase()
  if (cat === 'cardio') return 'cardio'
  if (MACHINE_EQUIPMENT.has(eq) || MACHINE_EQUIPMENT_HINTS.test(eq)) return 'machine'
  if (BODYWEIGHT_EQUIPMENT.has(eq) || cat === 'stretching' || cat === 'plyometrics') return 'bodyweight'
  return 'free'
}

export function catalogItemToExercise(item) {
  const type = inferExerciseType(item.equipment, item.category)
  const equipmentLabel = item.equipment ? titleCase(item.equipment) : type === 'bodyweight' ? 'Bodyweight' : 'Unknown'
  return {
    name: String(item.name || '').trim(),
    type,
    equipment: equipmentLabel === 'Body Only' ? 'Bodyweight' : equipmentLabel,
    weightStep: type === 'bodyweight' || type === 'cardio' ? 'n/a' : type === 'machine' ? '5' : '2',
    muscles: [...(item.primaryMuscles || []), ...(item.secondaryMuscles || [])].map(titleCase).join(', '),
    cues: (item.instructions || []).join('\n').trim(),
  }
}
