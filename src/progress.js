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

  while (nextTargets.length < weights.length) {
    nextTargets.push(nextTargets.at(-1) ?? '')
  }

  return {
    weights,
    targets: nextTargets,
    action: movedDown ? 'down' : movedUp ? 'up' : 'keep',
    reason: movedDown
      ? 'Load down.'
      : movedUp
        ? 'Load up.'
        : 'Same load.',
  }
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
