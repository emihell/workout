import { libraryItemMatch } from './exercise-names.js'
import { catalogNameKey, loadExerciseLibrary, shownName } from './exerciseLibrary.js'

// req-139 / DEC-064 §2 — search reads our library only (exerciseLibrary.js: the pinned
// free-db copy, the extras, our own entries). History: RepDB was used until req-142; nothing
// of it remains. Exercises added from it earlier (repdb-* ids) are untouched and resolve by name.

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

// req-143 — hidden = never offered anywhere (merged or triaged out; src/library/triage.js).
// It stays in the library so libraryEntryFor still resolves a stored exercise pointing at it.
export function listable(entry) {
  return !entry?.hidden
}

// Every item matching `query`, ranked: exact name or alias (0), name prefix (1), name
// contains (2), alias contains (2.5), muscle/equipment (3); ties alphabetical by the
// shown name. req-139 — the shown name (displayName ?? name) is the name; when a display
// name exists, free-db's name counts as an alias. req-143: hidden entries are skipped
// unless `keep(item)` (Search: the ones the user already has).
function rankedHits(list, query, keep = null) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) return []
  const qCompact = compactText(q)
  const qKey = catalogNameKey(q)
  // req-143 — a query that is exactly a merged entry's name (by key) finds its mergedInto
  // target, in the target's own tier; an unwritten target (a queued own-*) isn't in the
  // list, so nothing shows. Scored 0.5: just after direct exact hits, so an alias still
  // wins its own query ("air bike" → Fan Bike before Bicycle Crunch, req-139).
  const redirects = new Set()
  for (const item of list || []) {
    if (item.mergedInto && catalogNameKey(item.name) === qKey) redirects.add(item.mergedInto)
  }
  const scored = []
  for (const item of list || []) {
    if (!listable(item) && !keep?.(item)) continue
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
    if (redirects.has(item.id) && (score < 0 || score > 0.5)) score = 0.5
    if (score >= 0) scored.push({ item, score, name })
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
  return scored.map((row) => row.item)
}

// Kept though only tests call it (req-165, F-DEAD-5): it is rankedHits + a limit — the
// ranking the app's searchCommonFirst uses — and the ranking tests pin search order
// through it (the DEC-022 F3 "helper exported for tests" case).
export function searchExerciseCatalog(list, query, limit = 25) {
  return rankedHits(list, query).slice(0, limit)
}

// req-139 / DEC-064 §3 — what Search shows: the staple hits, and the rest of the
// library on request. Each part ranked as above and capped at `limit`; `restCount` is
// the untruncated count ("Show N more"). With no staple hit, Search shows `rest` directly.
// req-140 / DEC-066 §1 — the split reads `staple`, not `common` (a fully written niche
// entry sits behind "Show more"). The `common` key name is kept for the callers.
// req-143 — a hidden entry matching one of `exercises` (live or archived, libraryItemMatch)
// still shows, so owning one never turns into "No matches" (unconfirmed).
export function searchCommonFirst(list, query, limit = 25, { exercises = [] } = {}) {
  const owned = exercises.length ? (item) => libraryItemMatch(exercises, item) !== null : null
  const hits = rankedHits(list, query, owned)
  // req-151 — an exact hit on a listed non-staple's own name (shown name or free-db name) leads
  // the first tier instead of hiding behind "Show more" ("l-sit" → L-Sit, then Wall Sit). It goes
  // after any staple exact hits, so a staple that matches exactly still wins as before. With no
  // staple hit nothing is behind "Show more" (the rest shows directly), so nothing is pulled.
  const qKey = catalogNameKey(String(query || '').trim())
  const ownExact = (item) => Boolean(qKey) && [shownName(item), item.name].some((name) => catalogNameKey(name) === qKey)
  const staples = hits.filter((item) => item.staple)
  const pulled = staples.length ? hits.filter((item) => !item.staple && listable(item) && ownExact(item)) : []
  const lead = staples.findIndex((item) => !ownExact(item))
  const at = lead === -1 ? staples.length : lead
  const common = [...staples.slice(0, at), ...pulled, ...staples.slice(at)]
  const rest = hits.filter((item) => !item.staple && !pulled.includes(item))
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

// req-180 (DEC-097 §6) — the library's `logAs` decides what equipment can't: a `cardio`
// entry is a cardio exercise (Battle Ropes was typed free), and `time` / `weight-time`
// entries are timed (Plank was untimed). Only records created from now on (no bulk write).
const TIMED_LOG_AS = new Set(['time', 'weight-time'])

export function catalogItemToExercise(item) {
  const type = item.logAs === 'cardio' ? 'cardio' : inferExerciseType(item.equipment, item.category)
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
    ...(TIMED_LOG_AS.has(item.logAs) ? { hasDuration: true } : {}),
    // req-130 — every catalog item is a library entry since req-139 (no RepDB hits).
    ...(item.id ? { libraryId: String(item.id) } : {}),
  }
}
