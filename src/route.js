import { useEffect, useState } from 'react'
import { recordScreen } from './analytics.js'

const NAV_KEY = 'workout-mvp-nav-2'

export function hashPath(hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

export function toHash(path) {
  const next = hashPath(path)
  return `#${next}`
}

export function applyVisit(stack, path, { replace = false } = {}) {
  const next = hashPath(path)
  if (stack[stack.length - 1] === next) return stack
  if (replace && stack.length) {
    stack[stack.length - 1] = next
    return stack
  }
  stack.push(next)
  if (stack.length > 50) stack.splice(0, stack.length - 50)
  return stack
}

function loadVisits() {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(sessionStorage.getItem(NAV_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

const visits = loadVisits()

function persistVisits() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify(visits))
  } catch {
    // ignore quota / private mode
  }
}

function remember(hash) {
  const path = hashPath(hash)
  // Only a real move to a new path counts as a screen view — mirrors applyVisit's
  // consecutive-dedupe, so returning to the same screen isn't recounted and the
  // initial '#/' redirect doesn't double-count `today`. req-08: fail-silent.
  const changed = visits[visits.length - 1] !== path
  applyVisit(visits, hash)
  persistVisits()
  if (changed) recordScreen(parseRoute(path).name)
}

// req-153 — every browser history entry remembers the path BENEATH it, in
// `history.state.below`, so a replace can tell when its target is the entry right
// under it (overview → item → last set → replace to the overview) and step back onto
// it instead of leaving two identical entries (a device Back that does nothing).
// The in-app visit stack can't say this: a device Back pushes onto it, not pops.
// A new entry (a go() push or a plain link) is stamped when its hashchange arrives,
// from the event's oldURL; the first entry of the page is stamped `below: null`.
function entryState() {
  const state = window.history?.state
  return state && typeof state === 'object' && 'below' in state ? state : null
}

function stampEntry(below) {
  if (!window.history?.replaceState || entryState()) return
  window.history.replaceState({ ...(window.history.state || {}), below }, '')
}

function onHashStamp(event) {
  const old = event?.oldURL
  stampEntry(old ? hashPath(old.slice(old.indexOf('#') === -1 ? old.length : old.indexOf('#'))) : null)
}

let stampsInstalled = false
export function installEntryStamps() {
  if (typeof window === 'undefined' || stampsInstalled) return
  stampsInstalled = true
  stampEntry(null)
  window.addEventListener('hashchange', onHashStamp)
}

// Test-only: forget the installed listener (tests swap in a fresh fake window).
export function resetEntryStampsForTest() {
  stampsInstalled = false
  pendingBack = null
}

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')

  useEffect(() => {
    installEntryStamps()
    remember(window.location.hash || '#/')
    const onHash = () => {
      const next = window.location.hash || '#/'
      setHash(next)
      remember(next)
    }
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) {
      window.location.hash = '#/'
    }
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const path = hash.replace(/^#/, '') || '/'
  return parseRoute(path)
}

// Replace the current entry's URL, keeping what's beneath it, and announce it the way a
// real fragment navigation would (replaceState itself fires no hashchange).
function replaceEntry(next) {
  const oldURL = window.location.href
  const below = entryState()?.below ?? null
  window.history.replaceState({ ...(window.history.state || {}), below }, '', toHash(next))
  window.dispatchEvent(new window.HashChangeEvent('hashchange', { oldURL, newURL: window.location.href }))
}

// The target is the entry beneath: step back onto it. history.back() is async, and a
// second go() often follows in the same tick (Skip's go + the log screen's "marked done →
// overview" effect), which would step back AGAIN and walk off the app. So while a step
// back is in flight, later go() calls only record what they want (`after`), applied on
// arrival. If the landing isn't the target after all (an entry stamped before req-153
// shipped, say), replace to it.
let pendingBack = null

// A back that never arrives (no hashchange within BACK_TIMEOUT_MS) must not leave
// navigation stuck: the timer settles it the same way.
export const BACK_TIMEOUT_MS = 400

function backOnto(next) {
  const pending = { target: next, after: null }
  pendingBack = pending
  let timer = null
  const settle = () => {
    if (pendingBack !== pending) return
    window.removeEventListener('hashchange', settle)
    if (timer) clearTimeout(timer)
    pendingBack = null
    if (hashPath(window.location.hash) !== pending.target) replaceEntry(pending.target)
    if (pending.after) go(pending.after.path, { replace: pending.after.replace })
  }
  window.addEventListener('hashchange', settle)
  timer = setTimeout(settle, BACK_TIMEOUT_MS)
  window.history.back()
}

// req-152 / DEC-081 — `replace` replaces the BROWSER history entry too (it used to only
// rewrite the in-app visit stack, so device Back still stopped on the replaced screen —
// e.g. a dead `/workout/<id>/finish` after Save). req-153 — and when the entry beneath
// already is the target, it steps back onto it instead, so no duplicate entry is left.
// Same document throughout: no reload, hashchange fires (natively or dispatched).
export function go(path, { replace = false } = {}) {
  const next = hashPath(path)
  if (pendingBack) {
    // A replace to where we're already stepping back is a no-op; anything else waits.
    if (!(replace && next === pendingBack.target)) pendingBack.after = { path: next, replace }
    return
  }
  if (typeof window === 'undefined' || hashPath(window.location.hash) === next) {
    applyVisit(visits, next, { replace })
    persistVisits()
    return
  }
  if (replace && entryState()?.below === next) {
    if (visits[visits.length - 2] === next) visits.pop()
    persistVisits()
    backOnto(next)
    return
  }
  applyVisit(visits, next, { replace })
  persistVisits()
  if (replace) replaceEntry(next)
  else window.location.hash = toHash(next)
}

// req-14 / DEC-024 — the bottom tab bar has three tabs (Workouts / Library /
// Settings). `activeTab` maps any route name (as returned by parseRoute) to the
// tab that should be highlighted, so a deep route — editing a routine, opening a
// schedule slot, mid-workout — still lights the correct tab. Pure and unit-tested
// (route.test.js). Grouping (DEC-024): routines/* + exercises/* → Library;
// today, schedule/*, history/*, the in-workout flow + start → Workouts; settings
// → Settings. 'components' is the dev showcase and belongs to no tab (null).
export function activeTab(routeName) {
  const name = String(routeName || '')
  if (name === 'settings') return 'settings'
  if (name === 'components') return null
  // req-56: schedule* moved to Library — Schedule is now the first Library
  // segment, so every schedule screen lights the Library circle (was Workouts).
  if (name.startsWith('routine') || name.startsWith('exercise') || name.startsWith('schedule')) {
    return 'library'
  }
  // today, history*, workout* (in-workout) — and any future route that falls
  // through — land on Workouts, the default surface.
  return 'workouts'
}

function parseRoutineNested(rest) {
  if (!rest.length) return { screen: 'detail' }
  if (rest[0] === 'plan') return null
  if (rest[0] === 'edit') return { screen: 'edit' }
  if (rest[0] === 'exercise' && rest[1] === 'create' && rest[2] === 'manual') {
    return { screen: 'exercise-create-manual' }
  }
  if (rest[0] === 'exercise' && rest[1] === 'create' && rest[2] === 'search') {
    return { screen: 'exercise-create-search' }
  }
  if (rest[0] === 'exercise' && rest[1] === 'create') return { screen: 'exercise-create' }
  if (rest[0] === 'exercise' && rest[1] === 'new' && rest[2]) {
    return { screen: 'exercise-new', exerciseId: rest[2] }
  }
  if (rest[0] === 'exercise' && rest[1] === 'new') return { screen: 'exercise-pick' }
  if (rest[0] === 'exercise' && rest[1] != null) return { screen: 'exercise', itemId: rest[1] }
  return { screen: 'detail' }
}

// req-99 — a route may carry a `?from=<encoded-path>` return target (the exercise
// settings link from the routine editor uses it so Save/Back land back where you
// came from). Split the query off before path parsing so no branch sees the `?`,
// and only the routes that opt in read a param out of it. `path` is the hash body
// (already `#`-stripped); the query travels with it through hashPath/go untouched.
function queryParam(rawQuery, key) {
  for (const pair of String(rawQuery || '').split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const k = eq < 0 ? pair : pair.slice(0, eq)
    if (k !== key) continue
    const v = eq < 0 ? '' : pair.slice(eq + 1)
    try {
      return decodeURIComponent(v)
    } catch {
      return v
    }
  }
  return null
}

function safeDecode(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function parseRoute(path) {
  const [rawPath, rawQuery] = String(path).split('?')
  const parts = rawPath.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'today' }

  if (parts[0] === 'schedule' && parts[1] === 'loop') return { name: 'schedule-loop' }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] === 'add' && parts[4]) {
    return { name: 'schedule-day-add', week: Number(parts[1]), weekday: Number(parts[2]) }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] === 'add') {
    return { name: 'schedule-day-add', week: Number(parts[1]), weekday: Number(parts[2]) }
  }
  if (
    parts[0] === 'schedule' &&
    parts[1] != null &&
    parts[2] != null &&
    parts[3] &&
    parts[4] === 'plan'
  ) {
    return {
      name: 'schedule-slot',
      week: Number(parts[1]),
      weekday: Number(parts[2]),
      slotId: parts[3],
      screen: 'detail',
    }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] && parts[4]) {
    const nested = parseRoutineNested(parts.slice(4))
    if (nested) {
      return {
        name: 'schedule-slot',
        week: Number(parts[1]),
        weekday: Number(parts[2]),
        slotId: parts[3],
        ...nested,
      }
    }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3]) {
    return {
      name: 'schedule-slot',
      week: Number(parts[1]),
      weekday: Number(parts[2]),
      slotId: parts[3],
      screen: 'detail',
    }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null) {
    return { name: 'schedule-day', week: Number(parts[1]), weekday: Number(parts[2]) }
  }
  if (parts[0] === 'schedule') return { name: 'schedule' }

  if (parts[0] === 'routines') {
    if (parts[1] === 'new') return { name: 'routine-new' }
    if (parts[1] && parts[2] === 'edit') {
      return { name: 'routine-edit', routineId: parts[1] }
    }
    if (parts[1] && parts[2] === 'exercise' && parts[3] === 'create' && parts[4] === 'manual') {
      return { name: 'routine-exercise-create-manual', routineId: parts[1] }
    }
    if (parts[1] && parts[2] === 'exercise' && parts[3] === 'create' && parts[4] === 'search') {
      return { name: 'routine-exercise-create-search', routineId: parts[1] }
    }
    if (parts[1] && parts[2] === 'exercise' && parts[3] === 'create') {
      return { name: 'routine-exercise-create', routineId: parts[1] }
    }
    if (parts[1] && parts[2] === 'exercise' && parts[3] === 'new' && parts[4]) {
      return { name: 'routine-exercise-new', routineId: parts[1], exerciseId: parts[4] }
    }
    if (parts[1] && parts[2] === 'exercise' && parts[3] === 'new') {
      return { name: 'routine-exercise-pick', routineId: parts[1] }
    }
    if (parts[1] && parts[2] === 'exercise' && parts[3] != null) {
      return { name: 'routine-exercise', routineId: parts[1], itemId: parts[3] }
    }
    if (parts[1]) return { name: 'routine', routineId: parts[1] }
    return { name: 'routines' }
  }

  if (parts[0] === 'exercises' && parts[1] === 'new' && parts[2] === 'manual') {
    return { name: 'exercise-new-manual' }
  }
  if (parts[0] === 'exercises' && parts[1] === 'new' && parts[2] === 'search') {
    return { name: 'exercise-new-search' }
  }
  if (parts[0] === 'exercises' && parts[1] === 'new') return { name: 'exercise-new' }
  if (parts[0] === 'exercises' && parts[1] === 'type' && parts[2]) {
    return { name: 'exercises-type', type: parts[2] }
  }
  if (parts[0] === 'exercises' && parts[1] && parts[2] === 'edit') {
    const from = queryParam(rawQuery, 'from')
    return from ? { name: 'exercise-edit', id: parts[1], from } : { name: 'exercise-edit', id: parts[1] }
  }
  if (parts[0] === 'exercises' && parts[1]) return { name: 'exercise', id: parts[1] }
  if (parts[0] === 'exercises') return { name: 'exercises' }

  if (parts[0] === 'workout' && parts[1] && parts[2] === 'set' && parts[3] != null) {
    return { name: 'workout-set', routineId: parts[1], index: Number(parts[3]) }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3] && parts[4] === 'done') {
    return { name: 'workout-item-done', routineId: parts[1], itemId: parts[3] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3] && parts[4] === 'exercise') {
    return { name: 'workout-item-exercise', routineId: parts[1], itemId: parts[3] }
  }
  // req-109 — the Replace exercise picker, reached from the item's log screen.
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3] && parts[4] === 'replace') {
    return { name: 'workout-item-replace', routineId: parts[1], itemId: parts[3] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3] && parts[4] === 'log') {
    return { name: 'workout-item-log', routineId: parts[1], itemId: parts[3] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3]) {
    return { name: 'workout-item', routineId: parts[1], itemId: parts[3] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'finish') {
    return { name: 'workout-finish', routineId: parts[1] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'setup') {
    return { name: 'workout-setup', routineId: parts[1], ...parseRoutineNested(parts.slice(3)) }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] && parts[3] && parts[4] === 'setup') {
    return {
      name: 'workout-setup',
      routineId: parts[1],
      scheduleSlotId: parts[2],
      date: parts[3],
      ...parseRoutineNested(parts.slice(5)),
    }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] && parts[3]) {
    return {
      name: 'workout-preview',
      routineId: parts[1],
      scheduleSlotId: parts[2],
      date: parts[3],
    }
  }
  if (parts[0] === 'workout' && parts[1]) return { name: 'workout', routineId: parts[1] }

  if (parts[0] === 'history' && parts[1] === 'exercises') return { name: 'history-exercises' }
  if (parts[0] === 'history' && parts[1] === 'exercise' && parts[2]) {
    return { name: 'history-exercise', id: parts[2] }
  }
  if (parts[0] === 'history' && parts[1] === 'month' && parts[2]) {
    return { name: 'history-month', month: parts[2] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'exercise' && parts[3]) {
    return { name: 'history-workout-exercise', id: parts[1], exerciseId: parts[3] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'edit') return { name: 'history-edit', id: parts[1] }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'recalculate') {
    return { name: 'history-recalculate', id: parts[1] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'routine') {
    return { name: 'history-routine', id: parts[1], ...parseRoutineNested(parts.slice(3)) }
  }
  // req-117 — the History add-set form (unsaved until Save): exercise + item ids.
  if (parts[0] === 'history' && parts[1] && parts[2] === 'set' && parts[3] === 'new' && parts[4] && parts[5]) {
    return {
      name: 'history-set-add',
      id: parts[1],
      exerciseId: safeDecode(parts[4]),
      itemId: safeDecode(parts[5]),
    }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'set' && parts[3] === 'new') {
    return { name: 'history-set-new', id: parts[1] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'set' && parts[3] != null) {
    return { name: 'history-set', id: parts[1], index: Number(parts[3]) }
  }
  if (parts[0] === 'history' && parts[1]) return { name: 'history-detail', id: parts[1] }
  if (parts[0] === 'history') return { name: 'history' }

  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'components') return { name: 'components' }

  return { name: 'today' }
}
