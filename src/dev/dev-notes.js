// req-86 (N8) / req-87 — the "note on this page" feedback-capture store.
//
// A tiny in-app pipe into the backlog: Emilio jots a note tied to the current
// screen so a req can be made from it later. req-86 shipped this DEV-ONLY (build-
// time stripped from prod). req-87 flips the gating to RUNTIME: the button/panel now
// ship in the production build and render only when a feedback toggle is ON (default
// OFF), so Emilio — the only user — can turn it on in Settings on the live site. The
// gate is `getFeedbackEnabled()` (below), read reactively via useSyncExternalStore in
// App.jsx; there is no longer an `import.meta.env.DEV` DCE gate. (The module still
// lives under `src/dev/` and the notes key still reads `-dev-` — the name is kept so
// the existing key isn't stranded; it's cosmetic now, not a build mechanism.)
//
// Hard data-trust guard (req-86/87): BOTH keys here — the notes store and the
// enabled flag — live under their OWN localStorage keys and NEVER read or write
// `workout-mvp-v8`. The user's real workout history is untouchable by this feature.
//
// The core is pure and storage-injected so it is unit-testable under `node --test`
// (which has no localStorage / window). The browser wrappers at the bottom bind it
// to `window.localStorage`.

export const DEV_NOTES_KEY = 'workout-dev-notes-v1'
// req-87 — the on/off flag's own key. Default OFF is the ABSENCE of this key: an
// unset flag reads false, so a fresh visitor/site captures and stores nothing until
// the Settings toggle is turned on. Turning it off removes the key (restores absence).
export const FEEDBACK_ENABLED_KEY = 'workout-feedback-enabled-v1'

// Build one note record. `at` is passed in (the caller stamps the time) so the
// core stays pure and testable. Shape: {route, timestamp, text, context}.
export function buildNote({ route, text, context } = {}, at) {
  return {
    route: String(route ?? ''),
    timestamp: String(at ?? ''),
    text: String(text ?? '').trim(),
    context: context && typeof context === 'object' ? context : {},
  }
}

// Cheap, req-useful context from a parsed route (route.js `parseRoute` output).
// The route name plus whatever ids that screen carries (routineId / workoutId /
// exerciseId / itemId / week / weekday / …) — enough to tie a note to the exact
// screen and object without copying any of the user's real history.
export function captureContext(routeInfo, { hash, appVersion } = {}) {
  const { name, ...params } = routeInfo || {}
  return {
    routeName: name ?? 'unknown',
    params,
    hash: String(hash ?? ''),
    appVersion: String(appVersion ?? 'unknown'),
  }
}

export function readNotes(storage) {
  if (!storage) return []
  try {
    const raw = storage.getItem(DEV_NOTES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeNotes(storage, notes) {
  if (!storage) return false
  try {
    storage.setItem(DEV_NOTES_KEY, JSON.stringify(notes))
    return true
  } catch {
    return false
  }
}

export function appendNote(storage, note) {
  const notes = readNotes(storage)
  notes.push(note)
  writeNotes(storage, notes)
  return notes
}

export function clearNotes(storage) {
  if (!storage) return false
  try {
    storage.removeItem(DEV_NOTES_KEY)
    return true
  } catch {
    return false
  }
}

// The export payload handed to the clipboard — pretty JSON the planning session
// can paste straight into a req.
export function notesJson(notes) {
  return JSON.stringify(notes ?? [], null, 2)
}

// ---- Browser wrappers (bound to window.localStorage) ----

function browserStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null
}

function appVersion() {
  // Injected by vite.config.js `define` at build time; `typeof` guard keeps this
  // safe under `node --test` where the global is undefined.
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
}

export function loadNotes() {
  return readNotes(browserStorage())
}

export function saveNote({ text, routeInfo, hash }, at) {
  const note = buildNote(
    { route: hash, text, context: captureContext(routeInfo, { hash, appVersion: appVersion() }) },
    at,
  )
  return appendNote(browserStorage(), note)
}

export function dropNotes() {
  return clearNotes(browserStorage())
}

// ---- req-87 enabled flag (pure, storage-injected) ----

// Default OFF: any value other than the literal 'true' (incl. an absent key) reads
// false. Storage failures degrade to false — the feature stays off, never on.
export function readEnabled(storage) {
  if (!storage) return false
  try {
    return storage.getItem(FEEDBACK_ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

// Turning ON writes 'true'; turning OFF REMOVES the key, so "off" is byte-for-byte
// the fresh/default state (absence), not a stored 'false'.
export function writeEnabled(storage, value) {
  if (!storage) return false
  try {
    if (value) storage.setItem(FEEDBACK_ENABLED_KEY, 'true')
    else storage.removeItem(FEEDBACK_ENABLED_KEY)
    return true
  } catch {
    return false
  }
}

// ---- req-87 enabled flag (subscribable browser store) ----
//
// Mirrors the storage.js signal trio (getX/subscribeX): an in-memory boolean plus a
// listener set, so App.jsx's gate and the Settings toggle both track it via
// useSyncExternalStore and a flip in Settings shows/hides the button live (no
// reload). Initialized once from localStorage at module load, so a reload restores
// the persisted state. Under `node --test` browserStorage() is null → reads false.
let feedbackEnabled = readEnabled(browserStorage())
const feedbackEnabledListeners = new Set()

export function getFeedbackEnabled() {
  return feedbackEnabled
}

export function subscribeFeedbackEnabled(listener) {
  feedbackEnabledListeners.add(listener)
  return () => feedbackEnabledListeners.delete(listener)
}

export function setFeedbackEnabled(value) {
  const next = Boolean(value)
  writeEnabled(browserStorage(), next)
  if (feedbackEnabled === next) return
  feedbackEnabled = next
  for (const listener of feedbackEnabledListeners) listener()
}
