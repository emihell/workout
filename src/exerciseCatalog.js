import { catalogNameKey, loadExerciseLibrary, shownName } from './exerciseLibrary.js'

// req-139 / DEC-064 §2 — search reads our library only (exerciseLibrary.js: the pinned
// free-db copy, the extras, our own entries). RepDB is no longer fetched here; it comes
// back for pictures only (req-131). Exercises already added from RepDB are untouched.

const MACHINE_EQUIPMENT = new Set(['machine', 'cable'])
const BODYWEIGHT_EQUIPMENT = new Set(['body only', 'foam roll', 'bodyweight', 'body weight', 'none', ''])
const MACHINE_EQUIPMENT_HINTS = /machine|pec deck|leg press|leg curl|leg extension|hack squat|lat pulldown/

let catalogPromise = null

export { catalogNameKey, shownName }

// Test hook: forget the cached catalog so the next load starts over.
export function resetExerciseCatalog() {
  catalogPromise = null
}

// `loadLibrary` is injectable for tests only; the app always uses our library chunk.
// A failed load is an error ("Could not load."), never cached: the next open retries.
export function loadExerciseCatalog({ loadLibrary = loadExerciseLibrary } = {}) {
  if (!catalogPromise) {
    catalogPromise = Promise.resolve()
      .then(() => loadLibrary())
      .then((library) => {
        if (!Array.isArray(library) || !library.length) throw new Error('Could not load.')
        return library
      })
      .catch(() => {
        catalogPromise = null
        throw new Error('Could not load.')
      })
  }
  return catalogPromise
}

function compactText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

// req-139 review — a partial alias hit is judged per alias and must start at a word start
// inside it: the alias from word i onward, compacted, starts with the compacted query.
// (Was: all aliases joined and compacted, so "rdl" hit "Forwa-rd L-unge" and "row"
// hit "P-row-ler".)
function aliasWordStartMatch(alias, qCompact) {
  const words = String(alias || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return words.some((_, i) => words.slice(i).join('').startsWith(qCompact))
}

// Every item matching `query`, ranked: exact name or alias (0), name prefix (1), name
// contains (2), alias contains (2.5), muscle/equipment (3); ties alphabetical by the
// shown name. req-139 — the shown name (displayName ?? name) is the name; when a display
// name exists, free-db's name counts as an alias.
function rankedHits(list, query) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) return []
  const qCompact = compactText(q)
  const qKey = catalogNameKey(q)
  const scored = []
  for (const item of list || []) {
    const name = shownName(item).toLowerCase()
    const aliasList = item.displayName !== undefined ? [item.name, ...(item.aliases || [])] : item.aliases || []
    const muscles = [...(item.primaryMuscles || []), ...(item.secondaryMuscles || [])].join(' ').toLowerCase()
    const equipment = String(item.equipment || '').toLowerCase()
    const compactName = compactText(name)
    let score = -1
    // req-130 — a whole alias equal to the query scores like an exact name (the word
    // split below never matched a multi-word alias).
    // req-139 — the shown name also matches on its key ("pull up" = "Pull-Up"): an alias
    // that repeats the display name was dropped, and this keeps its exact hit.
    if (name === q || (qKey && (catalogNameKey(name) === qKey || aliasList.some((alias) => catalogNameKey(alias) === qKey)))) score = 0
    // req-130 review — no alias word-split here: a single word inside a multi-word
    // alias ("press" in "Triceps Press") would outrank real name hits. A partial alias
    // hit ranks just below a partial name hit, so aliases never reorder name matches.
    else if (name.startsWith(q)) score = 1
    else if (name.includes(q) || (qCompact.length >= 3 && compactName.includes(qCompact))) score = 2
    else if (qCompact && aliasList.some((alias) => aliasWordStartMatch(alias, qCompact))) score = 2.5
    else if (muscles.includes(q) || equipment.includes(q)) score = 3
    if (score >= 0) scored.push({ item, score, name })
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
  return scored.map((row) => row.item)
}

export function searchExerciseCatalog(list, query, limit = 25) {
  return rankedHits(list, query).slice(0, limit)
}

// req-139 / DEC-064 §3 — what Search shows: the common hits, and the rest of the
// library on request. Each part ranked as above and capped at `limit`; `restCount` is
// the untruncated count ("Show N more"). With no common hit, Search shows `rest` directly.
export function searchCommonFirst(list, query, limit = 25) {
  const hits = rankedHits(list, query)
  const common = hits.filter((item) => item.common)
  const rest = hits.filter((item) => !item.common)
  return { common: common.slice(0, limit), rest: rest.slice(0, limit), restCount: rest.length }
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
    // req-139 — the name saved is the shown one; libraryId keeps the link.
    name: shownName(item).trim(),
    type,
    equipment: equipmentLabel === 'Body Only' ? 'Bodyweight' : equipmentLabel,
    // req-126 / DEC-059 §2 — the catalog doesn't know the gym's increments: leave it empty
    // instead of inventing 5 (machine) or 2 (free).
    weightStep: 'n/a',
    muscles: [...(item.primaryMuscles || []), ...(item.secondaryMuscles || [])].map(titleCase).join(', '),
    cues: (item.instructions || []).join('\n').trim(),
    // req-130 — every catalog item is a library entry since req-139 (no RepDB hits).
    ...(item.id ? { libraryId: String(item.id) } : {}),
  }
}
