// req-08 / DEC-011 — local usage analytics.
//
// Bounded aggregate counts in a SEPARATE localStorage key, deliberately isolated
// from the workout state (`workout-mvp-v8`): never in the workout backup, no
// migration, and a corrupt/oversized analytics blob can't touch workout history.
//
// Writes are best-effort and MUST fail silently. This is the opposite of the
// save-failure banner (req-01 / DEC-001): losing analytics is acceptable, losing
// the user's history is not. A throwing write (quota, iOS private mode) is
// swallowed here and never surfaces into the UI, blocks navigation, or reaches the
// workout save path — same feature/guard shape as route.js's `visits` stack.

const ANALYTICS_KEY = 'workout-mvp-analytics'

export { ANALYTICS_KEY }

export function emptyAnalytics() {
  return { screens: {}, transitions: {}, buttons: {} }
}

function countBucket(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

// Pure count logic — no storage, safe to test directly. Increments the screen
// count for `name` and, when a previous route name is given, the `prev>>name`
// transition count. Keyed by the parsed route NAME (bounded, ~44 values), never
// the id-bearing path, so the store stays bounded no matter how many workouts or
// exercises exist.
export function applyScreen(data, name, prevName) {
  if (!name) return data
  data.screens[name] = (data.screens[name] || 0) + 1
  if (prevName && prevName !== name) {
    const key = `${prevName}>>${name}`
    data.transitions[key] = (data.transitions[key] || 0) + 1
  }
  return data
}

export function applyButton(data, name) {
  if (!name) return data
  data.buttons[name] = (data.buttons[name] || 0) + 1
  return data
}

function loadAnalytics() {
  if (typeof localStorage === 'undefined') return emptyAnalytics()
  try {
    const parsed = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return emptyAnalytics()
    return {
      screens: countBucket(parsed.screens),
      transitions: countBucket(parsed.transitions),
      buttons: countBucket(parsed.buttons),
    }
  } catch {
    return emptyAnalytics()
  }
}

let data = loadAnalytics()
let prevScreen = null

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data))
  } catch {
    // ignore quota / private mode — analytics is best-effort, never surfaced
  }
}

// Record a screen view keyed by route name, plus the transition from the previous
// screen. Never throws — a failure anywhere is swallowed so navigation continues.
export function recordScreen(name) {
  try {
    if (!name) return
    applyScreen(data, name, prevScreen)
    prevScreen = name
    persist()
  } catch {
    // best-effort; never throw into the route seam
  }
}

// Record a primary action-button press by a stable string key. Never throws.
export function recordButton(name) {
  try {
    if (!name) return
    applyButton(data, name)
    persist()
  } catch {
    // best-effort; never throw into a button handler
  }
}

// The raw analytics object, for the Settings "Export analytics" download.
export function exportAnalytics() {
  return data
}
