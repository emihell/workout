// req-86 (N8) — dev-only "note on this page" capture store.
//
// A tiny in-app pipe into the backlog: while using the app in DEV, Emilio jots a
// note tied to the current screen so a req can be made from it later. This whole
// feature is DEV-ONLY and must never ship to the live GitHub Pages build — the
// only render site is gated on `import.meta.env.DEV` (App.jsx), which Vite
// statically replaces with `false` in the production build, dead-code-eliminating
// this module and its UI out of `dist/` entirely (verified by a build grep in
// reports/req-86.md — no key, no strings, no render).
//
// Hard data-trust guard (req-86): this store lives under its OWN localStorage key
// and NEVER reads or writes `workout-mvp-v8`. The user's real workout history is
// untouchable by a dev convenience. The two keys share no code path.
//
// The core is pure and storage-injected so it is unit-testable under `node --test`
// (which has no localStorage / window). The browser wrappers at the bottom bind it
// to `window.localStorage`.

export const DEV_NOTES_KEY = 'workout-dev-notes-v1'

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
