// req-164 (F-STRUCT-6) — persistence, split out of storage.js: the stored keys, load
// (with migration and the legacy-key cleanup), save, the save-failed / unreadable /
// external-change signals, and the unreadable-state copies (DEC-032, DEC-086).
import { SCHEMA_VERSION, migrateState } from './model.js'
import { defaultSchedule, withDefaultAnchor } from './schedule.js'
import { FILL_MARKER, fillRoutineKgFromHistory } from './routine-kg-fill.js'

const STORAGE_KEY = 'workout-mvp-v9'
const LEGACY_KEYS = ['workout-mvp-v8', 'workout-mvp-v7', 'workout-mvp-v6', 'workout-mvp-v5']

// "Last save failed" signal. saveState writes are unguarded against a throwing
// localStorage.setItem (quota exceeded, Safari/iOS private mode), and the write
// runs inside the store's setState updater — an escaped throw would lose data
// silently. We swallow the throw here and expose the failure as a subscribable
// external store so the app can show a persistent banner until a save succeeds.
let saveFailed = false
const saveFailedListeners = new Set()

function setSaveFailed(value) {
  if (saveFailed === value) return
  saveFailed = value
  for (const listener of saveFailedListeners) listener()
}

export function getSaveFailed() {
  return saveFailed
}

export function subscribeSaveFailed(listener) {
  saveFailedListeners.add(listener)
  return () => saveFailedListeners.delete(listener)
}

// req-36 / DEC-032 — "the stored data is present but unreadable" signal, parallel
// to saveFailed above. When a corrupt-but-present `workout-mvp-v9` value can't be
// parsed/migrated (F-RISK-2), loadState latches this instead of silently returning
// emptyState. While it is set, saveState refuses to write, so the raw corrupt value
// stays on disk and recoverable — the app must never overwrite the one record it
// exists to protect. Surfaced by a distinct persistent banner (App.jsx). Absent /
// blank / valid loads clear it, so the flag reflects the *current* stored value.
let loadUnreadable = false
const loadUnreadableListeners = new Set()

function setLoadUnreadable(value) {
  if (loadUnreadable === value) return
  loadUnreadable = value
  for (const listener of loadUnreadableListeners) listener()
}

export function getLoadUnreadable() {
  return loadUnreadable
}

export function subscribeLoadUnreadable(listener) {
  loadUnreadableListeners.add(listener)
  return () => loadUnreadableListeners.delete(listener)
}

// req-41 / DEC-029 (audit F-RISK-3) — warn when *another same-origin tab* changed
// our data. Each tab holds its own in-memory state and saveState writes the whole
// key, so two open tabs are last-writer-wins: a stale tab can clobber another's
// finished workout with no warning. We can't reconcile without a backend, so this
// is warn-only (no merge, no hold-saves): surface the condition and let the user
// reload. Pure predicate for the one testable decision — "is this StorageEvent one
// that changed our persisted state?". A `null` key means localStorage.clear()
// (also a change); a matching key is our own key being (re)written or removed.
// The `storage` event fires only in the *other* tabs, never the writer, so the
// banner lands on the stale tab — exactly the one that needs it.
export function isExternalStateChange(event) {
  return event.key === STORAGE_KEY || event.key === null
}

// Signal trio mirroring saveFailed/loadUnreadable above, backed by a single window
// `storage` listener. Warn-only and one-way: once another tab changes the data the
// signal latches true until this tab reloads (a reload re-reads the latest on mount
// and mounts a fresh module, clearing it) — there is nothing to un-warn about while
// this tab still holds its stale snapshot. The window listener is registered lazily
// on first subscribe and removed on last unsubscribe; `typeof window` guards it so
// storage.js still imports under `node --test` (no window, listener never wired).
let externalChanged = false
const externalChangeListeners = new Set()
let storageEventHandler = null

function handleStorageEvent(event) {
  if (externalChanged) return
  if (!isExternalStateChange(event)) return
  externalChanged = true
  for (const listener of externalChangeListeners) listener()
}

export function getExternalChanged() {
  return externalChanged
}

export function subscribeExternalChange(listener) {
  externalChangeListeners.add(listener)
  if (typeof window !== 'undefined' && !storageEventHandler) {
    storageEventHandler = handleStorageEvent
    window.addEventListener('storage', storageEventHandler)
  }
  return () => {
    externalChangeListeners.delete(listener)
    if (externalChangeListeners.size === 0 && typeof window !== 'undefined' && storageEventHandler) {
      window.removeEventListener('storage', storageEventHandler)
      storageEventHandler = null
    }
  }
}

export function emptyState() {
  return migrateState({
    schemaVersion: SCHEMA_VERSION,
    exercises: [],
    routines: [],
    schedule: defaultSchedule(),
    workouts: [],
    draftWorkouts: [],
    activeWorkout: null,
    legacyRecommendations: {},
  })
}

// req-06 — remove the superseded legacy keys (now including v8, req-85), but ONLY
// after the current value is confirmed persisted by reading it back. A save that
// fails *silently* (iOS/Safari Private Mode has historically accepted the write and
// stored nothing) must never trigger a delete — that is the one path that could
// destroy the only surviving copy of the user's history. "saveState didn't throw" is
// NOT confirmation; the read-back is the entire safety mechanism. Best-effort and
// self-contained: a throwing removeItem/getItem is swallowed here so a cleanup failure
// degrades to "legacy stays", never to loadState returning emptyState and orphaning it.
function removeLegacyKeysIfCurrentPersisted() {
  try {
    if (localStorage.getItem(STORAGE_KEY) == null) return
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    // read-back or removeItem threw — leave every legacy key in place.
  }
}

// req-178 — a blank device starts with the one-time fill already marked done: it has no
// routines to fill, and a routine typed on it later must never be overwritten by the fill.
// NOT in emptyState(), which is also the merge base for stored values (a stored value
// without the marker must still be filled).
function blankDeviceState(now = new Date()) {
  return { ...emptyState(), [FILL_MARKER]: now.toISOString() }
}

export function loadState() {
  // Reading the raw value is separated from parsing/migrating it (req-36) so we can
  // tell "no value" (blank device) apart from "value present but unreadable". Only
  // the second is the corrupt-key case that must NOT be overwritten.
  let current
  let raw
  try {
    current = localStorage.getItem(STORAGE_KEY)
    raw = current || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
  } catch {
    // localStorage itself is unreadable (access denied). Nothing legible to
    // preserve, so behave like a blank device rather than latching the signal.
    setLoadUnreadable(false)
    return blankDeviceState()
  }

  // Absent or genuinely empty → blank device. The pre-req-36 path (emptyState(), saves
  // work normally, signal clear), plus req-178's fill marker (blankDeviceState).
  if (!raw) {
    setLoadUnreadable(false)
    return blankDeviceState()
  }

  // A value IS present. If parse or migrate throws it is corrupt-but-present: latch
  // the unreadable signal (which makes saveState refuse to write, DEC-032) and hand
  // back emptyState so the UI still renders — under the distinct banner. The raw
  // value stays on disk untouched and recoverable. A legacy-only key that won't
  // parse counts too (it is the only surviving copy).
  try {
    const parsed = JSON.parse(raw)
    // req-115 — a value that parses to a non-plain-object ("x", [1,2], 42, null) is
    // unreadable too: spreading it would "succeed", overwrite it with empty state and
    // delete the legacy keys. Throw into the DEC-032 path below instead.
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('stored value is not an object')
    }
    // req-120 (audit C) — legacy is read from the RAW value (the merge below injects
    // schemaVersion 9): a legacy key, or a current key not yet at v9, gets the legacy
    // plan backfill; a v9 key never does. Same condition as the save below.
    const legacy = !current || Number(parsed.schemaVersion) !== SCHEMA_VERSION
    const migrated = migrateState({ ...emptyState(), ...parsed }, { legacy })
    // req-114 (audit G) — a stored schedule with no `anchor` (an import from before
    // applyBackup defaulted it) gets this Monday, and is saved once so the anchor is
    // fixed on disk rather than re-defaulted to a new "this Monday" every week. A
    // present anchor is untouched, and then nothing extra is written. Not in
    // migrateState: the default is clock-dependent.
    const schedule = withDefaultAnchor(migrated.schedule)
    const anchorDefaulted = schedule !== migrated.schedule
    const anchored = anchorDefaulted ? { ...migrated, schedule } : migrated
    // req-178 (DEC-096 §6, DEC-100) — the one-time fill: routine kg from latest history,
    // once per stored state (the marker is kept by migrateState's spread and by backups),
    // saved with the rest. A state already marked comes back as it is.
    const filled = fillRoutineKgFromHistory(anchored, { at: new Date().toISOString() })
    const fillRan = filled.state !== anchored
    const state = filled.state
    setLoadUnreadable(false)
    if (legacy || anchorDefaulted || fillRan) {
      saveState(state)
    }
    // Only reached when this device had data (fresh migration, or already current
    // with a legacy copy left over from an interrupted cleanup). The read-back gate
    // decides whether any legacy key is actually removed.
    removeLegacyKeysIfCurrentPersisted()
    return state
  } catch {
    setLoadUnreadable(true)
    return emptyState()
  }
}

// req-157 (audit F-RISK-5, DEC-085 §2, refines DEC-032) — Import is the one way out of the
// unreadable state. req-161 (DEC-086) — it reads, FRESH from disk, EVERY workout key that is
// present (the current key, then each legacy key, in loadState's order), not only the one
// the load read: a corrupt v9 beside a leftover v8 (an interrupted cleanup) must keep both,
// because the first readable save lets the next load's cleanup delete v8. `values[0]` is
// the one loadState read.
//   { values: [{ key, raw }, …] } — each stored string;
//   { gone }   — getItem answered and nothing is stored any more (nothing left to keep);
//   { error }  — getItem THREW: we can't tell, so the caller must keep the lock;
//   { unlocked } — not in the unreadable state.
export function readUnreadableValues() {
  if (!getLoadUnreadable()) return { unlocked: true }
  try {
    const values = [STORAGE_KEY, ...LEGACY_KEYS].map((key) => ({ key, raw: localStorage.getItem(key) })).filter((v) => v.raw)
    return values.length ? { values } : { gone: true }
  } catch {
    return { error: true }
  }
}

// req-157 — the on-device copy of an unreadable value, kept BEFORE the lock is lifted, so
// the raw string survives even if its download never reaches the user (iOS asks "Download?"
// after the page has moved on; a home-screen app can ignore a blob download). Written with
// setItem and read back: only an exact === match counts. The key is never read by the app,
// never migrated, and NEVER deleted by it — it's there for recovery by hand. localStorage
// keeps JS strings as they are, so an unpaired surrogate (a value cut mid-emoji) survives
// here even though a UTF-8 download can't carry it.
//
// req-161 (DEC-086) — the key names its source: `workout-mvp-unreadable-<ISO time>-v8` for
// a copy of `workout-mvp-v8`. A retry doesn't pile up copies: when a copy of the SAME source
// with the SAME content (===) already exists, it is reused and nothing is written (req-157's
// unsuffixed copies name no source, so they never count as a match). A differing value gets
// its own copy. `quota` says setItem threw a storage-full error, so the caller can say what
// to do about it.
export const UNREADABLE_COPY_PREFIX = 'workout-mvp-unreadable-'
const WORKOUT_KEY_PREFIX = 'workout-mvp-'

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 22
}

function existingCopyOf(raw, suffix) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(UNREADABLE_COPY_PREFIX) && key.endsWith(suffix) && localStorage.getItem(key) === raw) return key
  }
  return null
}

export function keepUnreadableCopy(raw, sourceKey, now = new Date()) {
  const suffix = `-${sourceKey.slice(WORKOUT_KEY_PREFIX.length)}`
  try {
    const existing = existingCopyOf(raw, suffix)
    if (existing) return { key: existing, reused: true }
  } catch {
    return { error: true }
  }
  let key = null
  try {
    // Never write over another copy: a second Import within the same millisecond (or a
    // clock set back) gets `<ISO>~2-v9`, `~3`, … rather than the same key.
    const base = `${UNREADABLE_COPY_PREFIX}${now.toISOString()}`
    key = `${base}${suffix}`
    for (let n = 2; localStorage.getItem(key) != null; n++) key = `${base}~${n}${suffix}`
    localStorage.setItem(key, raw)
    if (localStorage.getItem(key) !== raw) return { error: true, key }
    return { key }
  } catch (error) {
    return { error: true, key, quota: isQuotaError(error) }
  }
}

// req-157 — lifts the DEC-032 write lock. Only importWithBackup calls it: after the copy is
// kept and the download call has returned (or when getItem said the value is gone).
export function releaseUnreadable() {
  setLoadUnreadable(false)
}

export function saveState(state) {
  // req-36 / DEC-032 — the stored value was unreadable; refuse to overwrite it so
  // the corrupt-but-possibly-recoverable key is preserved untouched. No setItem.
  if (getLoadUnreadable()) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    setSaveFailed(false)
    return true
  } catch {
    setSaveFailed(true)
    return false
  }
}
