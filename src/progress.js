export const GOAL_PROFILES = {
  lean: {
    id: 'lean',
    label: 'Lean',
    blurb: 'Stay lean. Higher reps, smaller weight jumps (2.5%).',
    pct: 0.025,
    defaultTargets: '12/12/10',
  },
  gain: {
    id: 'gain',
    label: 'Gain',
    blurb: 'Build muscle. Hypertrophy reps, 5% jumps.',
    pct: 0.05,
    defaultTargets: '12/10/8',
  },
  power: {
    id: 'power',
    label: 'Power',
    blurb: 'Get stronger. Lower reps, bigger jumps (7.5%).',
    pct: 0.075,
    defaultTargets: '8/6/5',
  },
}

export function normalizeGoal(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'lean' || v === 'gain' || v === 'power') return v
  if (v.includes('power') || v.includes('strength')) return 'power'
  if (v.includes('hypertrophy') || v.includes('build muscle') || v.includes('gain')) return 'gain'
  if (v.includes('lean') || v.includes('cut') || v.includes('lose') || v.includes('fat')) return 'lean'
  return 'gain'
}

export function goalLabel(value) {
  return GOAL_PROFILES[normalizeGoal(value)].label
}

export function goalPct(value) {
  return GOAL_PROFILES[normalizeGoal(value)].pct
}

export function stepSize(weightStep) {
  if (!weightStep || weightStep === 'n/a') return null
  if (weightStep === 'Alt 4/5') return 4.5
  const n = Number(weightStep)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function validWeights(exercise, max = 250) {
  if (Array.isArray(exercise?.weightOptions) && exercise.weightOptions.length) {
    return [...exercise.weightOptions].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  }
  if (exercise?.weightStep === 'Alt 4/5') {
    const out = []
    let weight = 9
    let addFive = true
    while (weight <= max) {
      out.push(weight)
      weight += addFive ? 5 : 4
      addFive = !addFive
    }
    return out
  }
  const step = Number(exercise?.weightStep)
  if (!Number.isFinite(step) || step <= 0) return []
  const out = []
  for (let weight = step; weight <= max; weight += step) {
    out.push(Math.round(weight * 100) / 100)
  }
  return out
}

export function moveToValidWeight(weight, exercise, direction) {
  const current = Number(weight) || 0
  const options = validWeights(exercise, Math.max(250, current + 100))
  if (!options.length) return Math.max(0, Math.round((current + direction * 0.5) * 2) / 2)
  if (direction > 0) return options.find((option) => option > current) ?? options.at(-1)
  return [...options].reverse().find((option) => option < current) ?? options[0]
}

export function snapWeight(weight, weightStep) {
  const step = stepSize(weightStep)
  if (step == null) return Math.round(Number(weight) * 2) / 2
  return Math.round(Number(weight) / step) * step
}

export function bumpWeight(weight, weightStep, dir, pct = 0.05) {
  const w = Number(weight) || 0
  if (w <= 0) return w
  const p = Math.abs(Number(pct) || 0.05)
  const raw = w * (1 + dir * p)
  const step = stepSize(weightStep)
  if (!step) {
    return Math.max(1, Math.round(raw * 2) / 2)
  }
  if (dir > 0) {
    const onePlate = w + step
    const fromPct = Math.ceil(raw / step) * step
    return Math.max(onePlate, fromPct)
  }
  const onePlate = Math.max(step, w - step)
  const fromPct = Math.max(step, Math.floor(raw / step) * step)
  return Math.min(onePlate, fromPct)
}

function parseReps(value) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function isDurationTarget(value) {
  const t = String(value || '').toLowerCase()
  return t.includes('min') || t.includes('sec') || /s$/.test(t.replace(/\s/g, ''))
}

function isAmrap(value) {
  return String(value || '').toLowerCase().includes('amrap')
}

function countableReps(value) {
  if (isDurationTarget(value) || isAmrap(value)) return null
  return parseReps(value)
}

function wasSkipped(set) {
  const r = String(set.reps || '').toLowerCase()
  const n = String(set.note || '').toLowerCase()
  return r === 'skipped' || n === 'skipped'
}

export function recommendNextPrescription({ targets, sets, exercise }) {
  const nextTargets = [...(targets || [])]
  const weights = []
  let movedUp = false
  let movedDown = false

  ;(sets || []).forEach((set, index) => {
    const actualWeight = Number(set.weight) || 0
    const actualReps = parseReps(set.reps)
    const targetReps = countableReps(targets?.[index] ?? targets?.at(-1))
    const rpe = set.rpe == null ? null : Number(set.rpe)
    const missed = actualReps != null && targetReps != null && actualReps < targetReps
    const bodyweight = exercise?.type === 'bodyweight' || exercise?.type === 'cardio'

    if (bodyweight || actualWeight <= 0) {
      weights.push(actualWeight)
      if (exercise?.type === 'bodyweight' && targetReps != null) {
        if (missed || rpe >= 5) {
          nextTargets[index] = String(Math.max(1, targetReps - 1))
          movedDown = true
        } else if (rpe != null && rpe <= 2) {
          nextTargets[index] = String(targetReps + 1)
          movedUp = true
        }
      }
      return
    }

    if (missed || rpe >= 5) {
      weights.push(moveToValidWeight(actualWeight, exercise, -1))
      movedDown = true
    } else if (!missed && rpe != null && rpe <= 2) {
      weights.push(moveToValidWeight(actualWeight, exercise, 1))
      movedUp = true
    } else {
      weights.push(actualWeight)
    }
  })

  return {
    weights,
    targets: nextTargets,
    action: movedDown ? 'down' : movedUp ? 'up' : 'keep',
    reason: movedDown
      ? 'Reduced one available load step after missed reps or failure.'
      : movedUp
        ? 'Raised one available load step after an easy completed set.'
        : 'Kept the most recent loads.',
  }
}

function mergeAction(current, next) {
  if (next === 'down' || current === 'down') return 'down'
  if (next === 'up' || current === 'up') return 'up'
  return 'keep'
}

export function planNextExercise(item, workingSets, exercise, goal = 'gain') {
  const type = exercise?.type
  const step = exercise?.weightStep
  const pct = goalPct(goal)
  const profile = normalizeGoal(goal)
  const nextWeights = [...(item.suggestedWeights || [])]
  const nextTargets = [...(item.targets || [])]
  let action = 'keep'

  workingSets.forEach((set, i) => {
    const target = countableReps(item.targets?.[i])
    const actual = parseReps(set.reps)
    const missed = actual != null && target != null && actual < target
    const rpe = set.rpe == null ? null : Number(set.rpe)
    const easy = rpe != null && rpe <= 2
    const fail = rpe != null && rpe >= 5
    const completed = !missed && !fail

    if (type === 'cardio') return
    if (isDurationTarget(item.targets?.[i]) || isDurationTarget(set.reps)) return

    const bodyweight = type === 'bodyweight' || Number(set.weight) === 0
    if (bodyweight) {
      const base = target ?? actual ?? 0
      if (!base || isAmrap(item.targets?.[i])) return
      if (missed || fail) {
        nextTargets[i] = String(Math.max(1, base - 1))
        action = mergeAction(action, 'down')
      } else if (completed && easy) {
        nextTargets[i] = String(base + 1)
        action = mergeAction(action, 'up')
      }
      return
    }

    const w = Number(set.weight) || 0
    if (!w) return

    if (missed || fail) {
      nextWeights[i] = bumpWeight(w, step, -1, pct)
      action = mergeAction(action, 'down')
      return
    }

    if (completed && easy) {
      if (profile === 'lean' && target != null && target < 15) {
        nextTargets[i] = String(target + 1)
        nextWeights[i] = w
        action = mergeAction(action, 'up')
        return
      }
      nextWeights[i] = bumpWeight(w, step, 1, pct)
      if (profile === 'power' && target != null && target > 5) {
        nextTargets[i] = String(target - 1)
      }
      action = mergeAction(action, 'up')
      return
    }

    nextWeights[i] = w
  })

  return { nextWeights, nextTargets, action }
}

export function applyProgression(session, workout, exercises, goal = 'gain') {
  const changes = []
  const nextExercises = (session.exercises || []).map((item) => {
    const work = (workout.sets || []).filter(
      (s) => s.exerciseId === item.exerciseId && s.setType !== 'wu' && !wasSkipped(s),
    )
    if (!work.length) return item
    const exercise = exercises.find((e) => e.id === item.exerciseId)
    const { nextWeights, nextTargets, action } = planNextExercise(item, work, exercise, goal)
    const sameWeights = JSON.stringify(nextWeights) === JSON.stringify(item.suggestedWeights || [])
    const sameTargets = JSON.stringify(nextTargets) === JSON.stringify(item.targets || [])
    if (action === 'keep' && sameWeights && sameTargets) {
      return { ...item, suggestedWeights: nextWeights.length ? nextWeights : item.suggestedWeights }
    }
    changes.push({
      exerciseId: item.exerciseId,
      name: exercise?.name || item.exerciseId,
      action,
      from: item.suggestedWeights || work.map((s) => s.weight),
      to: nextWeights,
      targetsFrom: item.targets,
      targetsTo: nextTargets,
    })
    return {
      ...item,
      suggestedWeights: nextWeights,
      targets: nextTargets.length ? nextTargets : item.targets,
    }
  })
  return { exercises: nextExercises, changes }
}

export function formatProgressionLine(c) {
  const weightsMoved =
    (c.from || []).length &&
    (c.to || []).length &&
    JSON.stringify(c.from) !== JSON.stringify(c.to)
  const repsMoved = JSON.stringify(c.targetsFrom || []) !== JSON.stringify(c.targetsTo || [])
  const bits = []
  if (weightsMoved) bits.push(`${(c.from || []).join('/')} → ${(c.to || []).join('/')} kg`)
  if (repsMoved) bits.push(`${(c.targetsFrom || []).join('/')} → ${(c.targetsTo || []).join('/')} reps`)
  if (!bits.length) return `${c.name}: same next time`
  return `${c.name}: ${bits.join(' · ')}`
}
