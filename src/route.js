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

// req-165 (BACKLOG Tier-3) — only the LAST visited path is kept (per tab, in
// sessionStorage). Its one reader is screen-view analytics: recordScreen counts a real move
// to a NEW path (so returning to the same screen isn't recounted and the initial '#/'
// redirect doesn't double-count `today`). The rest of the old visit stack had no reader
// since req-49 removed the stack-pop Back; replace vs push both left its top equal to the
// new path, so the top is all that decided anything.
export function visitChange(last, path) {
  const next = hashPath(path)
  return { last: next, changed: last !== next }
}

// Reads NAV_KEY as written before req-165 (the stack array) or after (a one-element array).
function loadLastVisit() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(sessionStorage.getItem(NAV_KEY) || '[]')
    const last = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').at(-1) : null
    return last ?? null
  } catch {
    return null
  }
}

let lastVisit = loadLastVisit()

function setLastVisit(path) {
  lastVisit = path
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify([lastVisit]))
  } catch {
    // ignore quota / private mode
  }
}

function remember(hash) {
  // req-08: fail-silent.
  const { last, changed } = visitChange(lastVisit, hash)
  setLastVisit(last)
  if (changed) recordScreen(parseRoute(last).name)
}

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')

  useEffect(() => {
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

// req-152 / DEC-081 — `replace` replaces the BROWSER history entry too (it used to only
// rewrite the in-app visit record, so device Back still stopped on the replaced screen —
// e.g. a dead `/workout/<id>/finish` after Save). location.replace with the same URL and a
// new hash is a same-document fragment navigation: no reload, hashchange still fires.
export function go(path, { replace = false } = {}) {
  const next = hashPath(path)
  // Marked visited BEFORE the hash changes, so go()'s own hashchange isn't a new screen
  // view (unchanged since before req-165).
  setLastVisit(next)
  if (typeof window !== 'undefined' && hashPath(window.location.hash) !== next) {
    if (replace) {
      const { href } = window.location
      const hashAt = href.indexOf('#')
      window.location.replace(`${hashAt === -1 ? href : href.slice(0, hashAt)}${toHash(next)}`)
    } else {
      window.location.hash = toHash(next)
    }
  }
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

function safeDecode(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

// req-99 — a route may carry a `?from=<encoded-path>` return target (first used by the
// exercise settings link from the routine editor, so Save/Back land back where you came
// from). The query is split off before path parsing so no branch sees the `?`; the
// query travels with the path through hashPath/go untouched.
//
// req-171 — a return target is only honoured when it is an in-app path this router
// knows: `/`-prefixed (not `//`, which a browser reads as another host), decodable, and
// matching a route shape. Anything else — empty, off-app, `%E0%A4%A`, an unknown route —
// is dropped, so the screen's Back falls back to its fixed parent.
function returnPathOf(rawQuery) {
  const raw = rawQueryValue(rawQuery, 'from')
  if (!raw) return null
  let path
  try {
    path = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  return matchRoute(path.split('?')[0]) ? path : null
}

function rawQueryValue(rawQuery, key) {
  for (const pair of String(rawQuery || '').split('&')) {
    const eq = pair.indexOf('=')
    if (eq > 0 && pair.slice(0, eq) === key) return pair.slice(eq + 1)
  }
  return null
}

// req-171 — `?from=` on any route (was exercise-edit only, req-99): the path of the
// screen the user came from, for a screen with more than one way in. Present on the
// parsed route only when valid (returnPathOf).
export function parseRoute(path) {
  const [rawPath, rawQuery] = String(path).split('?')
  const route = matchRoute(rawPath) || { name: 'today' }
  const from = returnPathOf(rawQuery)
  return from ? { ...route, from } : route
}

// `?from=` for a link: `path` carrying `from` (as given — a path, not yet encoded), or
// `path` unchanged when there is none.
export function withFrom(path, from) {
  return from ? `${path}?from=${encodeURIComponent(from)}` : path
}

// A link from the screen at `here` (its own path, without query) down to `child`,
// whose fixed parent IS `here`. When `here` was itself entered with a `from`, the link
// carries `here?from=…` so the child's Back returns to this exact screen and this
// screen's Back still returns to where it was entered from — the chain unwinds.
export function childLink(child, here, from) {
  return from ? withFrom(child, withFrom(here, from)) : child
}

// For an exit that returns past the immediate parent (e.g. History's recalc → the
// workout): walks the `from` chain for the first path whose route passes `match`.
// null when the chain has none — the caller then uses its fixed target.
export function findInFromChain(from, match) {
  let path = from
  for (let hops = 0; path && hops < 20; hops += 1) {
    const route = parseRoute(path)
    if (match(route)) return path
    path = route.from
  }
  return null
}

// The route shape of a path (no query), or null when no route matches.
function matchRoute(rawPath) {
  const parts = String(rawPath).split('/').filter(Boolean)
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
    return { name: 'exercise-edit', id: parts[1] }
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

  return null
}
