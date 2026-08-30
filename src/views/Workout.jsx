import { useEffect, useState } from 'react'
import { RPE_OPTIONS, formatSetLine, roleLabel, rpeOptionValue } from '../ids'
import { go } from '../route'
import { recommendNextPrescription } from '../progress'
import { exerciseById, findRoutine, historySetPrefill, lastSetsForExercise } from '../storage'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { itemIsMarkedDone, itemKey, itemLoggingState, lastLoggedSetIndex } from '../workout-log'
import { navForBase, RoutineScreens } from './Routine'
import { Back, Missing } from './shared'

function usesWeight(ex) {
  return ex && ex.type !== 'bodyweight' && ex.type !== 'cardio'
}

function isDurationTarget(target) {
  const t = String(target || '').toLowerCase()
  return t.includes('min') || t.includes('sec') || /s$/.test(t.replace(/\s/g, ''))
}

function exerciseName(item) {
  return item.exerciseName || 'Exercise'
}

function findItem(items, itemId) {
  return (items || []).find((item) => itemKey(item) === itemId || item.id === itemId) || null
}

function abandonWorkout(store) {
  if (!window.confirm('Abandon?')) return
  store.abandonWorkout()
  go('/')
}

function liveExercise(store, item) {
  return (
    exerciseById(store.exercises, item.exerciseId) || {
      name: item.exerciseName,
      equipment: item.equipment,
      type: item.exerciseType,
      weightStep: item.weightStep,
      cues: '',
    }
  )
}

function exerciseEditorPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/exercise`
}

function setProgressLabel(item, state, currentType, currentWorkIndex) {
  const hasWu = Boolean(item?.warmup)
  const total = (hasWu ? 1 : 0) + state.workCount
  const current = currentType === 'wu' ? 1 : (hasWu ? 1 : 0) + currentWorkIndex + 1
  return `${current}/${total}`
}

function ExerciseTitle({ routineId, item, ex, bits }) {
  const inLibrary = Boolean(item?.exerciseId && ex?.id === item.exerciseId)
  const name = exerciseName(item)
  const meta = (bits || []).filter(Boolean).join(' · ')
  return (
    <>
      <h1>
        {inLibrary ? (
          <a href={`#${exerciseEditorPath(routineId, item)}`}>{name}</a>
        ) : (
          name
        )}
      </h1>
      {meta ? <p>{meta}</p> : null}
    </>
  )
}

function ExerciseSetupHeader({ item, ex, showNotes = true }) {
  return (
    <>
      {ex?.equipment ? <p>{ex.equipment}</p> : null}
      {showNotes && item?.notes ? <p>{item.notes}</p> : null}
    </>
  )
}

function isActiveFor(active, routineId) {
  return Boolean(active && (active.routineId || active.sessionId) === routineId)
}

export function Workout({ routineId, scheduleSlotId = null, date = null }) {
  const store = useStore()
  const { routine } = findRoutine(store.routines, routineId)
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const plan = !mine
    ? store.getPlannedWorkout({
        routineId,
        date: date || new Date().toISOString().slice(0, 10),
        scheduleSlotId,
      })
    : null

  if (!routine && !mine) {
    return <Missing>Not found.</Missing>
  }

  if (!mine) {
    if (!plan) {
      return <Missing>Not found.</Missing>
    }
    return (
      <section>
        <Back />
        <h1>{plan.routineName}</h1>
        <p>{[plan.focus, plan.date].filter(Boolean).join(' · ')}</p>
        <ol>
          {plan.items.map((item) => (
            <li key={item.id}>
              {exerciseName(item)}
              {' — '}
              {roleLabel(item.role)}
              {item.warmup ? ' · WU set' : ''}
              {' · '}
              {item.sets} {item.sets === 1 ? 'set' : 'sets'}
            </li>
          ))}
        </ol>
        {plan.items.length ? (
          <p>
            <button
              type="button"
              onClick={() =>
                startOrContinue(store, routineId, {
                  scheduledFor: plan.date,
                  scheduleSlotId: plan.scheduleSlotId,
                  occurrenceId: plan.occurrenceId,
                  plan,
                })
              }
            >
              Start
            </button>
          </p>
        ) : (
          <p><a href={`#${scheduleSlotId && date ? `/workout/${routineId}/${scheduleSlotId}/${date}/setup` : `/workout/${routineId}/setup`}`}>Add exercises</a></p>
        )}
      </section>
    )
  }

  const items = active.snapshot?.items || []

  if (items.length === 0) {
    return (
      <section>
        <Back />
        <h1>{active.snapshot?.routineName || active.snapshot?.sessionName || 'Workout'}</h1>
        <p>No exercises.</p>
        <p>
          <button type="button" onClick={() => abandonWorkout(store)}>Abandon</button>
        </p>
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>{active.snapshot?.routineName || active.snapshot?.sessionName || routine?.name || 'Workout'}</h1>
      <ol>
        {items.map((item) => {
          const completed = itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone
          const path = completed ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
          return (
            <li key={itemKey(item) || item.id}>
              <a href={`#${path}`}>{exerciseName(item)}</a>
              {' — '}
              {roleLabel(item.role)}
              {completed ? ' · done' : ''}
            </li>
          )
        })}
      </ol>
      <p>
        <a href={`#/workout/${routineId}/finish`}>Finish</a>
      </p>
      <p>
          <button type="button" onClick={() => abandonWorkout(store)}>Abandon</button>
      </p>
    </section>
  )
}

function itemLogPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/log`
}

function itemDonePath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/done`
}

function itemSetsPath(routineId, item, workout) {
  if (!item) return `/workout/${routineId}`
  return itemLoggingState(workout, item).plannedDone
    ? itemDonePath(routineId, item)
    : itemLogPath(routineId, item)
}

function goToItemReview(routineId, item) {
  go(itemDonePath(routineId, item), { replace: true })
}

function MissingItem() {
  return <Missing>Not found.</Missing>
}

export function WorkoutItem({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const completed = Boolean(
    item && (itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone),
  )

  useEffect(() => {
    if (!item) return
    go(completed ? itemDonePath(routineId, item) : itemLogPath(routineId, item), { replace: true })
  }, [completed, routineId, item])

  if (!mine || !item) return <MissingItem />
  return null
}

export function WorkoutItemLog({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const markedDone = Boolean(item && itemIsMarkedDone(active, item))

  useEffect(() => {
    if (markedDone) go(`/workout/${routineId}`, { replace: true })
  }, [markedDone, routineId])

  if (!mine || !item) return <MissingItem />
  if (markedDone) return <MissingItem />

  return <WorkoutItemLive routineId={routineId} item={item} />
}

function restoreFromLoggedSet(set) {
  const skipped = String(set?.reps || '').toLowerCase() === 'skipped'
  return {
    setType: set.setType || 'work',
    workIndex: set.setType === 'wu' ? 0 : null,
    weight: set.weight != null && Number(set.weight) !== 0 ? String(set.weight) : '',
    reps: skipped ? '' : set.reps != null && set.reps !== '' ? String(set.reps) : '',
    rpe: set.rpe != null && set.rpe !== '' ? String(set.rpe) : '',
    note: skipped ? '' : set.note || '',
  }
}

function WorkoutItemLive({ routineId, item }) {
  const store = useStore()
  const active = store.activeWorkout
  const ex = liveExercise(store, item)
  const last = lastSetsForExercise(store.workouts, item.exerciseId)
  const state = itemLoggingState(active, item)
  const { needsWu, workCount, currentWorkIndex, plannedDone } = state
  const currentType = needsWu ? 'wu' : 'work'
  const target = needsWu
    ? String(item.warmup?.reps ?? 12)
    : item.targets?.[currentWorkIndex] ?? item.targets?.[item.targets.length - 1] ?? ''
  const [now, setNow] = useState(() => Date.now())
  const [restore, setRestore] = useState(null)

  useEffect(() => {
    if (!active.restEndsAt && !active.restPausedRemaining) return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [active.restEndsAt, active.restPausedRemaining])

  const remainingMs = active.restPausedRemaining != null
    ? active.restPausedRemaining
    : active.restEndsAt
      ? Math.max(0, active.restEndsAt - now)
      : 0
  const resting = remainingMs > 0 || active.restPausedRemaining != null

  useEffect(() => {
    if (!resting && plannedDone) goToItemReview(routineId, item)
  }, [resting, plannedDone, routineId, item])

  function finishAfterThisSet() {
    if (needsWu) return false
    return currentWorkIndex + 1 >= workCount
  }

  function restAfterSet(done, skipped = false) {
    if (done || skipped) return { restEndsAt: null, restPausedRemaining: null }
    if (item.restSec > 0) {
      return { restEndsAt: Date.now() + item.restSec * 1000, restPausedRemaining: null }
    }
    return { restPausedRemaining: null }
  }

  function completeSet({ weight, reps, rpe, note }) {
    if (currentType === 'work' && ex?.type !== 'cardio' && !rpe) {
      window.alert('Pick effort.')
      return
    }
    const done = finishAfterThisSet()
    setRestore(null)
    store.completeSet(
      {
        routineItemId: itemKey(item),
        exerciseId: item.exerciseId,
        setType: currentType,
        weight: usesWeight(ex) ? Number(weight) || 0 : 0,
        reps: reps || '',
        rpe: rpe ? Number(rpe) : null,
        note,
        targetReps: target || '',
        targetWeight:
          currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
            ? item.suggestedWeights[currentWorkIndex]
            : null,
      },
      restAfterSet(done),
    )
    if (done) goToItemReview(routineId, item)
  }

  function skipSet() {
    setRestore(null)
    const done = finishAfterThisSet()
    store.completeSet(
      {
        routineItemId: itemKey(item),
        exerciseId: item.exerciseId,
        setType: currentType,
        weight: 0,
        reps: 'skipped',
        rpe: null,
        note: 'skipped',
        targetReps: target || '',
        targetWeight:
          currentType === 'work' ? item.suggestedWeights?.[currentWorkIndex] ?? null : null,
      },
      restAfterSet(done, true),
    )
    if (done) goToItemReview(routineId, item)
  }

  function previousSet() {
    const index = lastLoggedSetIndex(active, item)
    const lastLogged = index >= 0 ? active.sets[index] : null
    if (!lastLogged) return
    const next = restoreFromLoggedSet(lastLogged)
    next.workIndex = lastLogged.setType === 'wu' ? 0 : state.workLogged.length - 1
    setRestore(next)
    store.removeActiveSet(index)
  }

  const canGoBack = state.logged.length > 0

  return (
    <section>
      <Back />
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={ex}
        bits={[
          roleLabel(item.role),
          currentType === 'wu' ? 'WU set' : null,
          setProgressLabel(item, state, currentType, currentWorkIndex),
        ]}
      />
      {resting ? (
        <>
          <RestBox remainingMs={remainingMs} paused={active.restPausedRemaining != null} />
          {canGoBack ? (
            <p>
              <button type="button" onClick={previousSet}>Previous</button>
            </p>
          ) : null}
        </>
      ) : plannedDone ? null : (
        <SetLogForm
          key={`${itemKey(item)}-${currentType}-${currentWorkIndex}`}
          ex={ex}
          last={last}
          currentType={currentType}
          currentWorkIndex={currentWorkIndex}
          target={target}
          restore={restore}
          canGoBack={canGoBack}
          onComplete={completeSet}
          onSkip={skipSet}
          onPrevious={previousSet}
        />
      )}

      <ExerciseSetupHeader item={item} ex={ex} showNotes={false} />
      {ex?.cues ? <p>{ex.cues}</p> : null}
    </section>
  )
}

function SetLogForm({
  ex,
  last,
  currentType,
  currentWorkIndex,
  target,
  restore,
  canGoBack,
  onComplete,
  onSkip,
  onPrevious,
}) {
  const history = historySetPrefill(last, { setType: currentType, workIndex: currentWorkIndex })
  const fromRestore =
    restore &&
    restore.setType === currentType &&
    (currentType === 'wu' || restore.workIndex === currentWorkIndex)
  const seed = fromRestore ? restore : history
  const [weight, setWeight] = useState(() => (usesWeight(ex) ? seed.weight : ''))
  const [reps, setReps] = useState(() => (fromRestore ? restore.reps : target || ''))
  const [rpe, setRpe] = useState(() =>
    fromRestore && restore.rpe != null && restore.rpe !== ''
      ? String(rpeOptionValue(restore.rpe) || restore.rpe)
      : '3',
  )
  const [note, setNote] = useState(() => (fromRestore ? restore.note : ''))
  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : 'Reps'

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onComplete({ weight, reps, rpe, note })
      }}
    >
      {usesWeight(ex) ? (
        <p>
          <label>
            kg
            <br />
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
          </label>
        </p>
      ) : null}
      <p>
        <label>
          {repsLabel}
          <br />
          <input value={reps} onChange={(e) => setReps(e.target.value)} required />
        </label>
      </p>
      {currentType === 'work' && ex?.type !== 'cardio' ? (
        <>
          <p>Effort</p>
          <p>
            {RPE_OPTIONS.map((opt) => (
              <label key={opt.value}>
                <input
                  type="radio"
                  name="rpe"
                  value={opt.value}
                  checked={String(rpe) === String(opt.value)}
                  onChange={() => setRpe(opt.value)}
                />{' '}
                {opt.label}
              </label>
            ))}
          </p>
        </>
      ) : null}
      <p>
        <label>
          Note
          <br />
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </p>
      <p>
        <button type="submit">Complete</button>{' '}
        <button type="button" onClick={onSkip}>Skip</button>
        {canGoBack ? (
          <>
            {' '}
            <button type="button" onClick={onPrevious}>Previous</button>
          </>
        ) : null}
      </p>
    </form>
  )
}

export function WorkoutItemDone({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null

  if (!mine || !item) return <MissingItem />

  const today = itemLoggingState(active, item).logged
  const previous = lastSetsForExercise(store.workouts, item.exerciseId)

  return (
    <section>
      <Back />
      <h2>Today</h2>
      {today.length ? (
        <ol>
          {today.map((set, index) => {
            const setIndex = (active.sets || []).indexOf(set)
            return (
              <li key={index}>
                <a href={`#/workout/${routineId}/set/${setIndex}`}>{formatSetLine(set)}</a>
              </li>
            )
          })}
        </ol>
      ) : (
        <p>None.</p>
      )}
      <h2>Previous</h2>
      {previous ? (
        <ol>
          {previous.sets.map((set, index) => (
            <li key={index}>{formatSetLine(set)}</li>
          ))}
        </ol>
      ) : (
        <p>None.</p>
      )}
      <p>
        <button
          type="button"
          onClick={() => {
            const key = itemKey(item)
            store.patchActive({
              completedItemIds: [
                ...new Set([
                  ...(active.completedItemIds || active.completedSessionItemIds || []),
                  key,
                ]),
              ],
              restEndsAt: null,
              restPausedRemaining: null,
            })
            go(`/workout/${routineId}`, { replace: true })
          }}
        >
          Done
        </button>
        {' '}
        <button
          type="button"
          onClick={() => {
            store.addWorkingSet(itemKey(item))
            go(itemLogPath(routineId, item), { replace: true })
          }}
        >
          Add set
        </button>
      </p>
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={liveExercise(store, item)}
        bits={[roleLabel(item.role)]}
      />
      <ExerciseSetupHeader item={item} ex={liveExercise(store, item)} />
    </section>
  )
}

export function WorkoutItemExercise({ routineId, itemId }) {
  const store = useStore()
  const active = store.activeWorkout
  const mine = isActiveFor(active, routineId)
  const item = mine ? findItem(active.snapshot?.items, itemId) : null
  const ex = item ? exerciseById(store.exercises, item.exerciseId) : null
  const [weightStep, setWeightStep] = useState(ex?.weightStep || '')
  const [cues, setCues] = useState(ex?.cues || '')

  if (!mine || !item) {
    return <Missing>Not found.</Missing>
  }

  if (!ex) {
    return (
      <section>
        <Back />
        <h1>{exerciseName(item)}</h1>
        <p>Not found.</p>
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>{exerciseName(item)}</h1>
      <p>{ex.equipment}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          store.updateExercise(ex.id, {
            weightStep: weightStep.trim() || 'n/a',
            cues: cues.trim(),
          })
          go(
            itemLoggingState(active, item).plannedDone
              ? itemDonePath(routineId, item)
              : itemLogPath(routineId, item),
            { replace: true },
          )
        }}
      >
        <p>
          <label>
            Weight step
            <br />
            <input value={weightStep} onChange={(event) => setWeightStep(event.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Form cues
            <br />
            <textarea value={cues} onChange={(event) => setCues(event.target.value)} rows={3} />
          </label>
        </p>
        <p>
          <button type="submit">Save</button>{' '}
          <button
            type="button"
            onClick={() =>
              go(
                itemLoggingState(active, item).plannedDone
                  ? itemDonePath(routineId, item)
                  : itemLogPath(routineId, item),
              )
            }
          >
            Cancel
          </button>
        </p>
      </form>
    </section>
  )
}

export function WorkoutFinish({ routineId }) {
  const store = useStore()
  if (!isActiveFor(store.activeWorkout, routineId)) {
    return <Missing>Not found.</Missing>
  }
  return <FinishScreen />
}

export function WorkoutSetup({
  routineId,
  scheduleSlotId = null,
  date = null,
  screen = 'detail',
  itemId,
  exerciseId,
}) {
  const preview =
    scheduleSlotId && date
      ? `/workout/${routineId}/${scheduleSlotId}/${date}`
      : `/workout/${routineId}`
  const paths = navForBase(`${preview}/setup`, preview, { showDelete: false })
  return (
    <RoutineScreens
      routineId={routineId}
      paths={paths}
      screen={screen}
      itemId={itemId}
      exerciseId={exerciseId}
    />
  )
}

function RestBox({ remainingMs, paused }) {
  const store = useStore()
  const sec = Math.ceil(remainingMs / 1000)
  return (
    <>
      <h2>Rest</h2>
      <p>
        {paused ? 'Paused' : 'Rest'} {sec}s
      </p>
      <p>
        {paused ? (
          <button
            type="button"
            onClick={() =>
              store.patchActive({
                restEndsAt: Date.now() + (store.activeWorkout.restPausedRemaining || 0),
                restPausedRemaining: null,
              })
            }
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              store.patchActive({
                restPausedRemaining: Math.max(0, (store.activeWorkout.restEndsAt || Date.now()) - Date.now()),
                restEndsAt: null,
              })
            }
          >
            Pause
          </button>
        )}{' '}
        <button type="button" onClick={() => store.patchActive({ restEndsAt: null, restPausedRemaining: null })}>
          Skip
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            if (paused) {
              store.patchActive({ restPausedRemaining: (store.activeWorkout.restPausedRemaining || 0) + 30000 })
            } else {
              store.patchActive({ restEndsAt: (store.activeWorkout.restEndsAt || Date.now()) + 30000 })
            }
          }}
        >
          +30s
        </button>
      </p>
    </>
  )
}

export function WorkoutSetEdit({ routineId, index }) {
  const store = useStore()
  const workout = store.activeWorkout
  const set = workout?.routineId === routineId ? workout.sets?.[index] : null
  const item = workout?.snapshot?.items?.find(
    (candidate) => itemKey(candidate) === (set?.routineItemId || set?.sessionItemId),
  )
  const usesLoad = item?.exerciseType !== 'cardio' && item?.exerciseType !== 'bodyweight'
  const usesRpe = set?.setType !== 'wu' && item?.exerciseType !== 'cardio'
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  const [rpe, setRpe] = useState(() => (set?.rpe != null && set.rpe !== '' ? String(rpeOptionValue(set.rpe)) : ''))
  const [note, setNote] = useState(set?.note || '')
  const itemPath = itemSetsPath(routineId, item, workout)

  if (!workout || !set) {
    return <Missing>Not found.</Missing>
  }

  return (
    <section>
      <Back />
      <p>{workout.snapshot?.routineName || workout.snapshot?.sessionName}</p>
      <h1>Set</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          store.updateActiveSet(index, {
            weight: weight === '' ? 0 : Number(weight),
            reps,
            rpe: rpe === '' ? null : Number(rpe),
            note,
          })
          go(itemPath)
        }}
      >
        {usesLoad ? <p><label>kg<br /><input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" /></label></p> : null}
        <p><label>Reps<br /><input value={reps} onChange={(event) => setReps(event.target.value)} /></label></p>
        {usesRpe ? <p>
          <label>Effort<br />
            <select value={rpe} onChange={(event) => setRpe(event.target.value)}>
              <option value="">—</option>
              {RPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </p> : null}
        <p><label>Note<br /><input value={note} onChange={(event) => setNote(event.target.value)} /></label></p>
        <p><button type="submit">Save</button> <button type="button" onClick={() => go(itemPath)}>Cancel</button></p>
      </form>
    </section>
  )
}

function FinishScreen() {
  const store = useStore()
  const [overallNote, setOverallNote] = useState('')
  const [overallFeel, setOverallFeel] = useState('')
  const active = store.activeWorkout
  const started = active?.startedAt ? new Date(active.startedAt) : new Date()
  const [minutes] = useState(() => Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)))
  const setCount = (active?.sets || []).length
  const items = active?.snapshot?.items || []
  const progression = items.map((item) => {
    const exercise =
      exerciseById(store.exercises, item.exerciseId) ||
      { type: item.exerciseType, weightStep: item.weightStep }
    const sets = (active?.sets || []).filter(
      (set) =>
        set.setType !== 'wu' &&
        set.routineItemId === itemKey(item) &&
        String(set.reps).toLowerCase() !== 'skipped',
    )
    const recommendation = recommendNextPrescription({
      targets: item.targets,
      sets,
      exercise,
    })
    const skippedForItem = (active?.sets || []).some(
      (set) =>
        set.routineItemId === itemKey(item) &&
        String(set.reps).toLowerCase() === 'skipped',
    )
    return {
      routineItemId: itemKey(item),
      exerciseId: item.exerciseId,
      name: item.exerciseName,
      from: item.suggestedWeights || [],
      to: sets.length ? recommendation.weights : item.suggestedWeights || [],
      targetsFrom: item.targets || [],
      targetsTo: recommendation.targets,
      action: recommendation.action,
      reason: sets.length ? recommendation.reason : skippedForItem ? 'Skipped.' : 'None.',
    }
  })

  const name = active?.snapshot?.routineName || active?.snapshot?.sessionName

  return (
    <section>
      <Back />
      <h1>Finish</h1>
      <p>
        {name} — {minutes} min · {setCount} sets
      </p>
      <h2>Next time</h2>
      {progression.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {progression.map((item) => {
            const none = item.reason === 'Skipped.' || item.reason === 'None.'
            const next = none
              ? item.reason
              : item.to.length
                ? `${item.to.join('/')} kg`
                : (item.targetsTo || []).filter(Boolean).join('/') || item.reason
            return (
              <li key={item.routineItemId}>
                {item.name} — {next}
              </li>
            )
          })}
        </ul>
      )}
      <p>Feel</p>
      <p>
        {['Easy', 'Good', 'Hard', 'Exhausting'].map((f) => (
          <label key={f}>
            <input type="radio" name="feel" checked={overallFeel === f} onChange={() => setOverallFeel(f)} /> {f}
          </label>
        ))}
      </p>
      <p>
        <label>
          Note
          <br />
          <textarea value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={3} />
        </label>
      </p>
      <p>
        <button
          type="button"
          onClick={() => {
            store.finishWorkout({ overallNote, overallFeel, progression })
            go('/')
          }}
        >
          Save
        </button>
      </p>
    </section>
  )
}
