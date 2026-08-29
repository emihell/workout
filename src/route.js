import { useEffect, useState } from 'react'

export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) {
      window.location.hash = '#/'
    }
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const path = hash.replace(/^#/, '') || '/'
  return parseRoute(path)
}

export function go(path) {
  const next = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`
  window.location.hash = next
}

export function parseRoute(path) {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'today' }

  if (parts[0] === 'schedule' && parts[1] === 'loop') return { name: 'schedule-loop' }
  if (parts[0] === 'schedule' && parts[1] != null && parts[2] != null && parts[3] === 'add' && parts[4]) {
    return { name: 'schedule-day-sessions', week: Number(parts[1]), weekday: Number(parts[2]), programId: parts[4] }
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

  if (parts[0] === 'programs' && parts[1] === 'new') return { name: 'program-new' }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'edit') return { name: 'program-edit', id: parts[1] }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'session' && parts[3] === 'new') {
    return { name: 'session-new', programId: parts[1] }
  }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'session' && parts[3] && parts[4] === 'exercise' && parts[5] === 'new' && parts[6]) {
    return {
      name: 'session-exercise-new',
      programId: parts[1],
      sessionId: parts[3],
      exerciseId: parts[6],
    }
  }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'session' && parts[3] && parts[4] === 'exercise' && parts[5] === 'new') {
    return { name: 'session-exercise-pick', programId: parts[1], sessionId: parts[3] }
  }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'session' && parts[3] && parts[4] === 'exercise' && parts[5] != null) {
    return {
      name: 'session-exercise',
      programId: parts[1],
      sessionId: parts[3],
      itemId: parts[5],
    }
  }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'session' && parts[3] && parts[4] === 'edit') {
    return { name: 'session-edit', programId: parts[1], sessionId: parts[3] }
  }
  if (parts[0] === 'programs' && parts[1] && parts[2] === 'session' && parts[3]) {
    return { name: 'session', programId: parts[1], sessionId: parts[3] }
  }
  if (parts[0] === 'programs' && parts[1]) return { name: 'program', id: parts[1] }
  if (parts[0] === 'programs' || parts[0] === 'program') return { name: 'programs' }

  if (parts[0] === 'exercises' && parts[1] === 'new') return { name: 'exercise-new' }
  if (parts[0] === 'exercises' && parts[1] && parts[2] === 'edit') return { name: 'exercise-edit', id: parts[1] }
  if (parts[0] === 'exercises' && parts[1]) return { name: 'exercise', id: parts[1] }
  if (parts[0] === 'exercises') return { name: 'exercises' }

  if (parts[0] === 'workout' && parts[1] && parts[2] === 'set' && parts[3] != null) {
    return { name: 'workout-set', sessionId: parts[1], index: Number(parts[3]) }
  }
  if (parts[0] === 'workout' && parts[1] && parts[2] && parts[3]) {
    return {
      name: 'workout-preview',
      sessionId: parts[1],
      scheduleSlotId: parts[2],
      date: parts[3],
    }
  }
  if (parts[0] === 'workout' && parts[1]) return { name: 'workout', sessionId: parts[1] }
  if (parts[0] === 'start' && parts[1]) return { name: 'start-program', id: parts[1] }
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

  return { name: 'today' }
}
