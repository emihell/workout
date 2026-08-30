export function itemKey(item) {
  return item?.routineItemId || item?.sessionItemId || item?.id || ''
}

export function setsForItem(sets, item) {
  const key = itemKey(item)
  return (sets || []).filter(
    (set) =>
      set.routineItemId === key ||
      set.sessionItemId === key ||
      set.routineItemId === item?.id ||
      set.sessionItemId === item?.id ||
      (!set.routineItemId && !set.sessionItemId && set.exerciseId === item?.exerciseId),
  )
}

export function workCountFor(item) {
  return Number(item?.sets) || 1
}

export function withOneMoreSet(item) {
  const targets = [...(item?.targets || [])]
  const weights = [...(item?.suggestedWeights || [])]
  const lastTarget = targets.at(-1) ?? ''
  const lastWeight = weights.at(-1)
  return {
    ...item,
    sets: (Number(item?.sets) || 1) + 1,
    targets: [...targets, lastTarget],
    suggestedWeights: lastWeight != null ? [...weights, lastWeight] : weights,
  }
}

export function addWorkingSetToState(state, itemId) {
  const active = state?.activeWorkout
  if (!active) return state
  const key = itemId
  let bumped = null
  const items = (active.snapshot?.items || []).map((item) => {
    if (itemKey(item) !== key) return item
    bumped = withOneMoreSet(item)
    return bumped
  })
  if (!bumped) return state
  return {
    ...state,
    activeWorkout: {
      ...active,
      snapshot: { ...active.snapshot, items },
    },
  }
}

function skippedSet({ item, setType, workIndex }) {
  const key = itemKey(item)
  const target =
    setType === 'wu'
      ? String(item.warmup?.reps ?? 12)
      : item.targets?.[workIndex] ?? item.targets?.[item.targets?.length - 1] ?? ''
  return {
    routineItemId: key,
    exerciseId: item.exerciseId,
    setType,
    weight: 0,
    reps: 'skipped',
    rpe: null,
    note: 'skipped',
    targetReps: target || '',
    targetWeight: setType === 'work' ? item.suggestedWeights?.[workIndex] ?? null : null,
  }
}

export function withSkippedUnloggedSets(workout) {
  if (!workout) return workout
  const sets = [...(workout.sets || [])]
  for (const item of workout.snapshot?.items || []) {
    const logged = () => setsForItem(sets, item)
    if (item.warmup && !logged().some((set) => set.setType === 'wu')) {
      sets.push(skippedSet({ item, setType: 'wu', workIndex: 0 }))
    }
    const workCount = workCountFor(item)
    while (logged().filter((set) => set.setType !== 'wu').length < workCount) {
      const workIndex = logged().filter((set) => set.setType !== 'wu').length
      sets.push(skippedSet({ item, setType: 'work', workIndex }))
    }
  }
  const keys = (workout.snapshot?.items || []).map((item) => itemKey(item)).filter(Boolean)
  return {
    ...workout,
    sets,
    completedItemIds: [...new Set([...(workout.completedItemIds || []), ...keys])],
  }
}

export function itemLoggingState(workout, item) {
  const logged = setsForItem(workout?.sets, item)
  const wuLogged = logged.some((set) => set.setType === 'wu')
  const workLogged = logged.filter((set) => set.setType !== 'wu')
  const needsWu = Boolean(item?.warmup) && !wuLogged
  const workCount = workCountFor(item)
  return {
    logged,
    wuLogged,
    workLogged,
    needsWu,
    workCount,
    currentWorkIndex: workLogged.length,
    plannedDone: !needsWu && workLogged.length >= workCount,
  }
}

export function itemIsMarkedDone(workout, item) {
  const key = itemKey(item)
  const ids = workout?.completedItemIds || workout?.completedSessionItemIds || []
  return ids.includes(key)
}

export function lastLoggedSetIndex(workout, item) {
  const logged = setsForItem(workout?.sets, item)
  const lastSet = logged[logged.length - 1]
  if (!lastSet) return -1
  return (workout.sets || []).lastIndexOf(lastSet)
}
