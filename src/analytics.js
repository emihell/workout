// req-08 / DEC-011 — local usage analytics.
//
// Bounded aggregate counts in a SEPARATE localStorage key, deliberately isolated
// from the workout state (`workout-mvp-v9`): never in the workout backup, no
// migration, and a corrupt/oversized analytics blob can't touch workout history.
//
// Writes are best-effort and MUST fail silently. This is the opposite of the
// save-failure banner (req-01 / DEC-001): losing analytics is acceptable, losing
// the user's history is not. A throwing write (quota, iOS private mode) is
// swallowed here and never surfaces into the UI, blocks navigation, or reaches the
// workout save path — same feature/guard shape as route.js's `lastVisit` record.
//
// req-197 — counts are bucketed per local day, and each day counts screen events per
// build, so gym use can be told apart from test clicking during builds:
//   { v: 2, days: { "YYYY-MM-DD": { screens, transitions, buttons, builds: { sha: n } } } }
// A pre-req-197 blob ({screens, transitions, buttons}, no `v`) is kept whole as
// days["before-dates"]. Settings → Export analytics downloads the object, then resets it.

import { dateKey } from './schedule.js'

const ANALYTICS_KEY = 'workout-mvp-analytics'
const LEGACY_DAY = 'before-dates'

export { ANALYTICS_KEY, LEGACY_DAY }

// The build this bundle came from: the short sha injected by vite.config.js
// (`__BUILD_ID__`) on `vite build`; "dev" under `npm run dev`, when the sha can't be read,
// or under `node --test` where the global is undefined.
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__ ? __BUILD_ID__ : 'dev'

export function emptyAnalytics() {
  return { v: 2, days: {} }
}

export function emptyDay() {
  return { screens: {}, transitions: {}, buttons: {}, builds: {} }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function countBucket(value) {
  return isObject(value) ? value : {}
}

function normalizeDay(value) {
  const day = isObject(value) ? value : {}
  return {
    screens: countBucket(day.screens),
    transitions: countBucket(day.transitions),
    buttons: countBucket(day.buttons),
    builds: countBucket(day.builds),
  }
}

// Pure count logic — no storage, safe to test directly. Operates on ONE day bucket.
// Increments the screen count for `name` and, when a previous route name is given,
// the `prev>>name` transition count. Keyed by the parsed route NAME (bounded, ~44
// values), never the id-bearing path, so the store stays bounded no matter how many
// workouts or exercises exist.
export function applyScreen(bucket, name, prevName) {
  if (!name) return bucket
  bucket.screens[name] = (bucket.screens[name] || 0) + 1
  if (prevName && prevName !== name) {
    const key = `${prevName}>>${name}`
    bucket.transitions[key] = (bucket.transitions[key] || 0) + 1
  }
  return bucket
}

export function applyButton(bucket, name) {
  if (!name) return bucket
  bucket.buttons[name] = (bucket.buttons[name] || 0) + 1
  return bucket
}

// The day bucket for `day`, created on first use.
export function dayBucket(data, day) {
  if (!isObject(data.days)) data.days = {}
  if (!isObject(data.days[day])) data.days[day] = emptyDay()
  return data.days[day]
}

// Pure: a screen event on `day` from build `build`. `prev` is { name, day } of the
// previous screen event, or null; a transition counts only when it was on the same day
// (req-197: transitions never cross a day boundary).
export function applyScreenEvent(data, name, prev, day, build) {
  if (!name) return data
  const bucket = dayBucket(data, day)
  applyScreen(bucket, name, prev && prev.day === day ? prev.name : null)
  bucket.builds[build] = (bucket.builds[build] || 0) + 1
  return data
}

export function applyButtonEvent(data, name, day) {
  if (!name) return data
  applyButton(dayBucket(data, day), name)
  return data
}

// Pure: the stored JSON text → a v2 object. Anything unreadable → empty. A v1 blob
// (no `v`) is kept, counts unchanged, as days["before-dates"].
export function parseAnalytics(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw || 'null')
  } catch {
    return emptyAnalytics()
  }
  if (!isObject(parsed)) return emptyAnalytics()
  if (parsed.v === 2) {
    const days = {}
    if (isObject(parsed.days)) {
      for (const [day, value] of Object.entries(parsed.days)) days[day] = normalizeDay(value)
    }
    return { v: 2, days }
  }
  if (parsed.v !== undefined) return emptyAnalytics()
  const legacy = normalizeDay(parsed)
  const hasCounts = ['screens', 'transitions', 'buttons'].some((k) => Object.keys(legacy[k]).length > 0)
  return hasCounts ? { v: 2, days: { [LEGACY_DAY]: legacy } } : emptyAnalytics()
}

export function loadAnalytics() {
  if (typeof localStorage === 'undefined') return emptyAnalytics()
  try {
    return parseAnalytics(localStorage.getItem(ANALYTICS_KEY))
  } catch {
    return emptyAnalytics()
  }
}

// Every day bucket added up — for reading counts regardless of which day they fell on.
export function sumDays(data) {
  const total = emptyDay()
  for (const day of Object.values(isObject(data?.days) ? data.days : {})) {
    for (const field of ['screens', 'transitions', 'buttons', 'builds']) {
      for (const [key, n] of Object.entries(countBucket(day?.[field]))) {
        total[field][key] = (total[field][key] || 0) + n
      }
    }
  }
  return total
}

let data = loadAnalytics()
let prevScreen = null // { name, day } of the last recorded screen event

function persist() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data))
  } catch {
    // ignore quota / private mode — analytics is best-effort, never surfaced
  }
}

// Record a screen view keyed by route name, plus the transition from the previous
// screen (same day only). Never throws — a failure anywhere is swallowed so
// navigation continues. `now` is injectable for tests.
export function recordScreen(name, now = new Date()) {
  try {
    if (!name) return
    const day = dateKey(now)
    applyScreenEvent(data, name, prevScreen, day, BUILD_ID)
    prevScreen = { name, day }
    persist()
  } catch {
    // best-effort; never throw into the route seam
  }
}

// Record a primary action-button press by a stable string key. Never throws.
export function recordButton(name, now = new Date()) {
  try {
    if (!name) return
    applyButtonEvent(data, name, dateKey(now))
    persist()
  } catch {
    // best-effort; never throw into a button handler
  }
}

// The raw analytics object (live reference).
export function exportAnalytics() {
  return data
}

// Clear the stored analytics. The previous screen is kept, so the next move still
// counts its transition into the new data. Never throws.
export function resetAnalytics() {
  try {
    data = emptyAnalytics()
    persist()
  } catch {
    // best-effort
  }
}

// Settings → Export analytics (req-197): hand the current object to `download`, then
// reset, then count this press in the NEW data — the downloaded file never holds its
// own export press. If `download` throws, nothing is reset.
export function exportAndResetAnalytics(download, now = new Date()) {
  const snapshot = data
  download(snapshot)
  resetAnalytics()
  recordButton('export-analytics', now)
  return snapshot
}
