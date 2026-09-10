import { useEffect, useState } from 'react'
import { RPE_OPTIONS, formatSetLine, roleLabel } from '../ids'
import { go } from '../route'
import { recordButton } from '../analytics'
import { recommendNextPrescription } from '../progress'
import { exerciseById, findRoutine, historySetPrefill, lastSetsForExercise } from '../storage'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { carriedWorkingSet, initialSetFields, itemIsMarkedDone, itemKey, itemLoggingState, lastLoggedSetIndex, markItemDonePatch, reopenItemPatch, restRemaining } from '../workout-log'
import { navForBase, RoutineScreens } from './Routine'
import { SetEditForm } from './set-edit'
import { Back, ExercisesLink, Missing, NavLink } from './shared'
import {
  Button,
  Field,
  List,
  RestBar as UIRestBar,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  SetLogForm,
  Textarea,
  Title,
} from '../ui/index.jsx'

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
  recordButton('abandon-workout')
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
      <Title>
        {inLibrary ? (
          <a href={`#${exerciseEditorPath(routineId, item)}`}>{name}</a>
        ) : (
          name
        )}
      </Title>
      {meta ? <p className="ui-sub">{meta}</p> : null}
    </>
  )
}

function ExerciseSetupHeader({ item, ex, showNotes = true }) {
  return (
    <>
      {ex?.equipment ? <p className="ui-sub">{ex.equipment}</p> : null}
      {showNotes && item?.notes ? <p className="ui-sub">{item.notes}</p> : null}
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
    const previewMeta = [plan.focus, plan.date].filter(Boolean).join(' · ')
    return (
      <Screen>
        <Back />
        <Title subtitle={previewMeta}>{plan.routineName}</Title>
        <List>
          {plan.items.map((item) => (
            <Row key={item.id} value={`${item.sets} ${item.sets === 1 ? 'set' : 'sets'}`}>
              {exerciseName(item)} — {roleLabel(item.role)}
              {item.warmup ? ' · WU set' : ''}
            </Row>
          ))}
        </List>
        {plan.items.length ? (
          <Button
            variant="primary"
            block
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
          </Button>
        ) : (
          <p>
            <NavLink to={scheduleSlotId && date ? `/workout/${routineId}/${scheduleSlotId}/${date}/setup` : `/workout/${routineId}/setup`}>
              Add exercises
            </NavLink>
          </p>
        )}
      </Screen>
    )
  }

  const items = active.snapshot?.items || []

  if (items.length === 0) {
    return (
      <Screen>
        <Back />
        <Title>{active.snapshot?.routineName || active.snapshot?.sessionName || 'Workout'}</Title>
        <p className="ui-sub">No exercises.</p>
        <Button variant="quiet" block onClick={() => abandonWorkout(store)}>
          Abandon
        </Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <Back />
      <RestBar />
      <Title>{active.snapshot?.routineName || active.snapshot?.sessionName || routine?.name || 'Workout'}</Title>
      <List>
        {items.map((item) => {
          const completed = itemIsMarkedDone(active, item) || itemLoggingState(active, item).plannedDone
          const path = itemCurrentPath(routineId, item, completed)
          return (
            <Row key={itemKey(item) || item.id} to={path}>
              {exerciseName(item)} — {roleLabel(item.role)}
              {completed ? ' · done' : ''}
            </Row>
          )
        })}
      </List>
      <List>
        <Row to={`/workout/${routineId}/finish`}>Finish</Row>
      </List>
      <Button variant="quiet" block onClick={() => abandonWorkout(store)}>
        Abandon
      </Button>
    </Screen>
  )
}

function itemLogPath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/log`
}

function itemDonePath(routineId, item) {
  return `/workout/${routineId}/item/${itemKey(item)}/done`
}

// One branch, written once: a done exercise goes to its done screen, otherwise
// its log screen. The `done` boolean varies by caller (marked-done+plannedDone
// on the overview, plannedDone alone on the setup form), so it stays an argument.
function itemCurrentPath(routineId, item, done) {
  return done ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
}

function itemSetsPath(routineId, item, workout) {
  if (!item) return `/workout/${routineId}`
  return itemCurrentPath(routineId, item, itemLoggingState(workout, item).plannedDone)
}

// req-11 / DEC-013 — completing the last set marks the exercise done and returns
// to the workout overview (the exercise menu), replacing the old per-exercise
// review screen in the flow. WorkoutItemDone stays reachable by re-entering a
// completed exercise from the overview.
function markDoneAndGoToOverview(store, workout, routineId, item) {
  store.patchActive(markItemDonePatch(workout, item))
  go(`/workout/${routineId}`, { replace: true })
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
    go(itemCurrentPath(routineId, item, completed), { replace: true })
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

// req-02 / DEC-002: for an exercise with NO finished-workout history, the kg+reps
// carried onto the next working set — the most recent non-skipped working set
// logged this session. Null for a with-history exercise (`last` present), a
// warm-up set, or when nothing has been logged yet, so the existing history /
// blank-kg / target-reps paths stay untouched.
function carryFor(ex, last, currentType, workLogged) {
  if (last || currentType !== 'work') return null
  const src = carriedWorkingSet(workLogged)
  if (!src) return null
  return {
    weight: src.weight != null && Number(src.weight) !== 0 ? String(src.weight) : '',
    reps: src.reps != null && src.reps !== '' ? String(src.reps) : '',
  }
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
  const [restore, setRestore] = useState(null)
  const { resting } = useRestCountdown(active)

  useEffect(() => {
    if (!resting && plannedDone) markDoneAndGoToOverview(store, active, routineId, item)
  }, [resting, plannedDone, routineId, item, store, active])

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
    recordButton('complete-set')
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
    if (done) markDoneAndGoToOverview(store, active, routineId, item)
  }

  function skipSet() {
    recordButton('skip-set')
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
    if (done) markDoneAndGoToOverview(store, active, routineId, item)
  }

  function previousSet() {
    const index = lastLoggedSetIndex(active, item)
    const lastLogged = index >= 0 ? active.sets[index] : null
    if (!lastLogged) return
    recordButton('previous-set')
    const next = restoreFromLoggedSet(lastLogged)
    next.workIndex = lastLogged.setType === 'wu' ? 0 : state.workLogged.length - 1
    setRestore(next)
    store.removeActiveSet(index)
  }

  const canGoBack = state.logged.length > 0
  const weighted = usesWeight(ex)
  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration' : 'Reps'
  const showEffort = currentType === 'work' && ex?.type !== 'cardio'
  // Seed the set-log fields from the same sources the app has always used —
  // restore (Previous), then carry (no-history working set), then history /
  // target. Domain logic stays here; the ui/ SetLogForm only holds the values.
  const historyPrefill = historySetPrefill(last, { setType: currentType, workIndex: currentWorkIndex })
  const fromRestore =
    restore &&
    restore.setType === currentType &&
    (currentType === 'wu' || restore.workIndex === currentWorkIndex)
  const seed = initialSetFields({
    weighted,
    fromRestore,
    restore,
    hasHistory: Boolean(last),
    history: historyPrefill,
    carry: carryFor(ex, last, currentType, state.workLogged),
    target,
  })

  return (
    <Screen>
      <ExercisesLink routineId={routineId} />
      <RestBar />
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
        canGoBack ? (
          <Button variant="quiet" onClick={previousSet}>
            Previous
          </Button>
        ) : null
      ) : plannedDone ? null : (
        <SetLogForm
          key={`${itemKey(item)}-${currentType}-${currentWorkIndex}`}
          weighted={weighted}
          showEffort={showEffort}
          repsLabel={repsLabel}
          effortOptions={RPE_OPTIONS}
          initialWeight={seed.weight}
          initialReps={seed.reps}
          initialEffort={seed.effort}
          initialNote={seed.note}
          canGoBack={canGoBack}
          onComplete={({ weight, reps, effort, note }) => completeSet({ weight, reps, rpe: effort, note })}
          onSkip={skipSet}
          onPrevious={previousSet}
        />
      )}

      {resting ? null : (
        <>
          <ExerciseSetupHeader item={item} ex={ex} showNotes={false} />
          {ex?.cues ? <p className="ui-sub">{ex.cues}</p> : null}
        </>
      )}
    </Screen>
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
    <Screen>
      <ExercisesLink routineId={routineId} />
      <RestBar />
      <SectionHeader>Today</SectionHeader>
      {today.length ? (
        <List>
          {today.map((set, index) => {
            const setIndex = (active.sets || []).indexOf(set)
            return (
              <Row key={index} to={`/workout/${routineId}/set/${setIndex}`}>
                {formatSetLine(set)}
              </Row>
            )
          })}
        </List>
      ) : (
        <p className="ui-sub">None.</p>
      )}
      <SectionHeader>Previous</SectionHeader>
      {previous ? (
        <List>
          {previous.sets.map((set, index) => (
            <Row key={index}>{formatSetLine(set)}</Row>
          ))}
        </List>
      ) : (
        <p className="ui-sub">None.</p>
      )}
      <Button
        onClick={() => {
          // Re-opening a completed exercise: clear the done mark first so the
          // log screen's markedDone guard doesn't bounce straight back here.
          store.patchActive(reopenItemPatch(active, item))
          store.addWorkingSet(itemKey(item))
          go(itemLogPath(routineId, item), { replace: true })
        }}
      >
        Add set
      </Button>
      <ExerciseTitle
        routineId={routineId}
        item={item}
        ex={liveExercise(store, item)}
        bits={[roleLabel(item.role)]}
      />
      <ExerciseSetupHeader item={item} ex={liveExercise(store, item)} />
    </Screen>
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
      <Screen>
        <Back />
        <Title>{exerciseName(item)}</Title>
        <p className="ui-sub">Not found.</p>
      </Screen>
    )
  }

  return (
    <Screen>
      <Back />
      <RestBar />
      <Title>{exerciseName(item)}</Title>
      <p className="ui-sub">{ex.equipment}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          store.updateExercise(ex.id, {
            weightStep: weightStep.trim() || 'n/a',
            cues: cues.trim(),
          })
          go(
            itemCurrentPath(routineId, item, itemLoggingState(active, item).plannedDone),
            { replace: true },
          )
        }}
      >
        <Field
          label="Weight step"
          value={weightStep}
          onChange={(event) => setWeightStep(event.target.value)}
        />
        <Textarea
          label="Form cues"
          value={cues}
          onChange={(event) => setCues(event.target.value)}
          rows={3}
        />
        <div className="ui-actions">
          <Button type="submit" variant="primary">
            Save
          </Button>
          <Button
            onClick={() =>
              go(itemCurrentPath(routineId, item, itemLoggingState(active, item).plannedDone))
            }
          >
            Cancel
          </Button>
        </div>
      </form>
    </Screen>
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

// Reads the workout-level rest state (restEndsAt / restPausedRemaining, both
// already persisted on activeWorkout) and ticks a display clock while a rest is
// running. Used by the persistent RestBar for display and by WorkoutItemLive for
// its set-flow gating, so the countdown logic lives in one place.
function useRestCountdown(active) {
  const restEndsAt = active?.restEndsAt ?? null
  const restPausedRemaining = active?.restPausedRemaining ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!restEndsAt && restPausedRemaining == null) return undefined
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [restEndsAt, restPausedRemaining])
  return restRemaining(active, now)
}

// The single, persistent rest UI. Self-contained: it reads only activeWorkout rest
// state and renders nothing when no rest is active, so it can be dropped into any
// in-workout screen and the counter keeps ticking regardless of which screen shows.
function RestBar() {
  const store = useStore()
  const active = store.activeWorkout
  const { remainingMs, paused, resting } = useRestCountdown(active)
  if (!active || !resting) return null
  const sec = Math.ceil(remainingMs / 1000)
  // req-11 / DEC-013: [Pause/Resume] [+30s] on the left, "Next" (end the rest and
  // advance) as the primary on the right. The handlers are unchanged from the
  // inline version — only the markup moved onto the ui/ RestBar molecule.
  const onPauseResume = () => {
    if (paused) {
      recordButton('rest-resume')
      store.patchActive({
        restEndsAt: Date.now() + (store.activeWorkout.restPausedRemaining || 0),
        restPausedRemaining: null,
      })
    } else {
      recordButton('rest-pause')
      store.patchActive({
        restPausedRemaining: Math.max(0, (store.activeWorkout.restEndsAt || Date.now()) - Date.now()),
        restEndsAt: null,
      })
    }
  }
  const onAddTime = () => {
    recordButton('rest-plus-30')
    if (paused) {
      store.patchActive({ restPausedRemaining: (store.activeWorkout.restPausedRemaining || 0) + 30000 })
    } else {
      store.patchActive({ restEndsAt: (store.activeWorkout.restEndsAt || Date.now()) + 30000 })
    }
  }
  const onNext = () => {
    recordButton('rest-next')
    store.patchActive({ restEndsAt: null, restPausedRemaining: null })
  }
  return (
    <UIRestBar
      seconds={sec}
      paused={paused}
      onPauseResume={onPauseResume}
      onAddTime={onAddTime}
      onNext={onNext}
    />
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
  const itemPath = itemSetsPath(routineId, item, workout)

  if (!workout || !set) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back />
      <RestBar />
      <p className="ui-sub">{workout.snapshot?.routineName || workout.snapshot?.sessionName}</p>
      <Title>Set</Title>
      <SetEditForm
        set={set}
        showLoad={usesLoad}
        showEffort={usesRpe}
        cancelTo={itemPath}
        onSave={({ weight, reps, rpe, note }) => {
          store.updateActiveSet(index, {
            weight: weight === '' ? 0 : Number(weight),
            reps,
            rpe: rpe === '' ? null : Number(rpe),
            note,
          })
          go(itemPath)
        }}
      />
    </Screen>
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
    <Screen>
      <Back />
      <RestBar />
      <Title>Finish</Title>
      <p className="ui-sub">
        {name} — {minutes} min · {setCount} sets
      </p>
      <SectionHeader>Next time</SectionHeader>
      {progression.length === 0 ? (
        <p className="ui-sub">None.</p>
      ) : (
        <List>
          {progression.map((item) => {
            const none = item.reason === 'Skipped.' || item.reason === 'None.'
            const next = none
              ? item.reason
              : item.to.length
                ? `${item.to.join('/')} kg`
                : (item.targetsTo || []).filter(Boolean).join('/') || item.reason
            return (
              <Row key={item.routineItemId} value={next}>
                {item.name}
              </Row>
            )
          })}
        </List>
      )}
      <SectionHeader>Feel</SectionHeader>
      <SegmentedControl
        options={['Easy', 'Good', 'Hard', 'Exhausting']}
        value={overallFeel}
        onChange={setOverallFeel}
        ariaLabel="Feel"
      />
      <Textarea label="Note" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={3} />
      <Button
        variant="primary"
        block
        onClick={() => {
          recordButton('finish-workout')
          store.finishWorkout({ overallNote, overallFeel, progression })
          go('/')
        }}
      >
        Save
      </Button>
    </Screen>
  )
}
