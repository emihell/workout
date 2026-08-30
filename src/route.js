import { useEffect, useState } from 'react'

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

export function applyBack(stack, currentHash, fallback = '/') {
  const current = hashPath(currentHash)
  if (stack[stack.length - 1] === current) stack.pop()
  return stack[stack.length - 1] || fallback
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
  applyVisit(visits, hash)
  persistVisits()
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

export function go(path, { replace = false } = {}) {
  const next = hashPath(path)
  applyVisit(visits, next, { replace })
  persistVisits()
  if (typeof window !== 'undefined' && hashPath(window.location.hash) !== next) {
    window.location.hash = toHash(next)
  }
}

export function back(fallback = '/') {
  const current = typeof window === 'undefined' ? fallback : window.location.hash
  const prev = applyBack(visits, current, fallback)
  persistVisits()
  if (typeof window !== 'undefined') {
    window.location.hash = toHash(prev)
  }
  return prev
}

export function parseRoute(path) {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'today' }

  if (parts[0] === 'schedule' && parts[1] === 'loop') return { name: 'schedule-loop' }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] === 'add' && parts[4]) {
    return { name: 'schedule-day-add', week: Number(parts[1]), weekday: Number(parts[2]) }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] === 'add') {
    return { name: 'schedule-day-add', week: Number(parts[1]), weekday: Number(parts[2]) }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] && parts[4] === 'exercise' && parts[5] != null) {
    return {
      name: 'schedule-slot',
      week: Number(parts[1]),
      weekday: Number(parts[2]),
      slotId: parts[3],
    }
  }
  if (
    parts[0] === 'schedule' &&
    parts[1] != null &&
    parts[2] != null &&
    parts[3] &&
    parts[4] === 'plan' &&
    parts[5] &&
    parts[6] === 'item' &&
    parts[7]
  ) {
    return {
      name: 'schedule-plan-item',
      week: Number(parts[1]),
      weekday: Number(parts[2]),
      slotId: parts[3],
      date: parts[5],
      itemId: parts[7],
    }
  }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3]) {
    return { name: 'schedule-slot', week: Number(parts[1]), weekday: Number(parts[2]), slotId: parts[3] }
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
  if (parts[0] === 'exercises' && parts[1] && parts[2] === 'edit') return { name: 'exercise-edit', id: parts[1] }
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
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3] && parts[4] === 'log') {
    return { name: 'workout-item-log', routineId: parts[1], itemId: parts[3] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'item' && parts[3]) {
    return { name: 'workout-item', routineId: parts[1], itemId: parts[3] }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] === 'finish') {
    return { name: 'workout-finish', routineId: parts[1] }
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
  if (parts[0] === 'start') return { name: 'start' }

  if (parts[0] === 'history' && parts[1] === 'exercises') return { name: 'history-exercises' }
  if (parts[0] === 'history' && parts[1] === 'exercise' && parts[2]) {
    return { name: 'history-exercise', id: parts[2] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'exercise' && parts[3]) {
    return { name: 'history-workout-exercise', id: parts[1], exerciseId: parts[3] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'edit') return { name: 'history-edit', id: parts[1] }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'recalculate') {
    return { name: 'history-recalculate', id: parts[1] }
  }
  if (parts[0] === 'history' && parts[1] && parts[2] === 'delete') {
    return { name: 'history-delete', id: parts[1] }
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

  return { name: 'today' }
}
