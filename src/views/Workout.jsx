import { useEffect, useState } from 'react'
import { RPE_OPTIONS, formatSetLine, roleLabel } from '../ids'
import { go } from '../route'
import { goalLabel, recommendNextPrescription } from '../progress'
import { exerciseById, findSession, lastSetsForExercise } from '../storage'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { Back } from './shared'

function usesWeight(ex) {
  return ex && ex.type !== 'bodyweight' && ex.type !== 'cardio'
}

function isDurationTarget(target) {
  const t = String(target || '').toLowerCase()
  return t.includes('min') || t.includes('sec') || /s$/.test(t.replace(/\s/g, ''))
}

function roundHalf(n) {
  return Math.round(n * 2) / 2
}

export function Workout({ sessionId, scheduleSlotId = null, date = null }) {
  const store = useStore()
  const { session } = findSession(store.programs, sessionId)
  const active = store.activeWorkout
  const mine = active && active.sessionId === sessionId
  const plan = !mine
    ? store.getPlannedWorkout({
        sessionId,
        date: date || new Date().toISOString().slice(0, 10),
        scheduleSlotId,
      })
    : null

  if (!session && !mine) {
    return (
      <section>
        <p>Session not found.</p>
        <Back to="/" />
      </section>
    )
  }

  if (!mine) {
    if (!plan) {
      return (
        <section>
          <Back to="/" />
          <p>Workout plan not found.</p>
        </section>
      )
    }
    return (
      <section>
        <Back to={scheduleSlotId ? `/schedule/${store.schedule.slots.find((slot) => slot.id === scheduleSlotId)?.week ?? 0}/${store.schedule.slots.find((slot) => slot.id === scheduleSlotId)?.weekday ?? 0}/${scheduleSlotId}` : '/start'} />
        <p>{scheduleSlotId ? `Scheduled workout · ${plan.date}` : `Ad-hoc workout · ${plan.date}`}</p>
        <h1>{plan.sessionName}</h1>
        <p>{plan.focus} · {plan.items.length} exercises</p>
        <ol>
          {plan.items.map((item) => (
            <li key={item.id}>
              {item.exerciseName} — {roleLabel(item.role)}
              {item.warmup ? ' · WU set' : ''}
              {' · '}
              {item.sets} {item.sets === 1 ? 'set' : 'sets'} · {(item.targets || []).join('/')}
              {item.exerciseType === 'cardio' || item.exerciseType === 'bodyweight'
                ? ''
                : item.suggestedWeights?.some((weight) => Number(weight) > 0)
                  ? ` · ${item.suggestedWeights.join('/')} kg`
                  : ' · find starting weight'}
            </li>
          ))}
        </ol>
        {plan.items.length ? (
          <p>
            <button type="button" onClick={() => startOrContinue(store, sessionId, {
              scheduledFor: plan.date,
              scheduleSlotId: plan.scheduleSlotId,
              occurrenceId: plan.occurrenceId,
              plan,
            })}>
              {scheduleSlotId ? 'Start scheduled workout' : 'Start ad-hoc workout'}
            </button>
          </p>
        ) : (
          <p><a href={`#/programs/${plan.programId}/session/${plan.sessionId}`}>Add exercises before starting</a></p>
        )}
      </section>
    )
  }

  const items = active.snapshot?.items || []
  const index = Math.min(active.exerciseIndex || 0, Math.max(0, items.length - 1))
  const doneAll = items.length > 0 && (active.exerciseIndex || 0) >= items.length

  if (items.length === 0) {
    return (
      <section>
        <Back to="/" />
        <h1>{active.snapshot?.sessionName || 'Workout'}</h1>
        <p>This session has no exercises.</p>
        <p>
          <a href={`#/programs/${active.snapshot?.programId}/session/${sessionId}`}>Add exercises</a>
        </p>
        <p>
          <button
            type="button"
            onClick={() => {
              store.abandonWorkout()
              go('/')
            }}
          >
            Abandon workout
          </button>
        </p>
      </section>
    )
  }

  if (doneAll) {
    return <FinishScreen />
  }

  const item = items[index]
  const ex =
    exerciseById(store.exercises, item.exerciseId) ||
    {
      name: item.exerciseName,
      equipment: item.equipment,
      type: item.exerciseType,
      weightStep: item.weightStep,
    }
  return (
    <ExerciseStep
      key={`${item.exerciseId}-${index}-${(active.sets || []).length}`}
      session={{ name: active.snapshot?.sessionName || session?.name || 'Workout' }}
      item={item}
      ex={ex}
      index={index}
      total={items.length}
    />
  )
}

function ExerciseStep({ session, item, ex, index, total }) {
  const store = useStore()
  const active = store.activeWorkout
  const last = lastSetsForExercise(store.workouts, item.exerciseId)
  const extra = active.extraSets?.[item.sessionItemId] || 0
  const workCount = (Number(item.sets) || 1) + extra
  const logged = (active.sets || []).filter(
    (s) => s.sessionItemId === item.sessionItemId || (!s.sessionItemId && s.exerciseId === item.exerciseId),
  )
  const wuLogged = logged.some((s) => s.setType === 'wu')
  const workLogged = logged.filter((s) => s.setType !== 'wu')
  const needsWu = Boolean(item.warmup) && !wuLogged
  const currentWorkIndex = workLogged.length
  const exerciseDone = !needsWu && currentWorkIndex >= workCount

  const currentType = needsWu ? 'wu' : 'work'
  const target = needsWu
    ? String(item.warmup?.reps ?? 12)
    : item.targets?.[currentWorkIndex] ?? item.targets?.[item.targets.length - 1] ?? ''

  let suggestedWeight = ''
  if (usesWeight(ex)) {
    if (needsWu) {
      const first = item.suggestedWeights?.[0] ?? last?.sets?.find((s) => s.setType !== 'wu')?.weight
      if (first) suggestedWeight = String(roundHalf(Number(first) * 0.5))
    } else if (item.suggestedWeights?.[currentWorkIndex] != null) {
      suggestedWeight = String(item.suggestedWeights[currentWorkIndex])
    } else {
      const prevWork = last?.sets?.filter((s) => s.setType !== 'wu') || []
      if (prevWork[currentWorkIndex]?.weight != null) suggestedWeight = String(prevWork[currentWorkIndex].weight)
      else if (workLogged[workLogged.length - 1]?.weight != null) {
        suggestedWeight = String(workLogged[workLogged.length - 1].weight)
      }
    }
  }

  const initialReps = isDurationTarget(target) ? '' : String(target).replace(/[^\d.-]/g, '') || String(target)
  const [weight, setWeight] = useState(suggestedWeight)
  const [reps, setReps] = useState(initialReps)
  const [rpe, setRpe] = useState('')
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => Date.now())

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

  function completeSet(e) {
    e.preventDefault()
    if (currentType === 'work' && ex?.type !== 'cardio' && !rpe) {
      window.alert('Pick an effort (RPE) for working sets.')
      return
    }
    store.completeSet({
      sessionItemId: item.sessionItemId,
      exerciseId: item.exerciseId,
      setType: currentType,
      weight: usesWeight(ex) ? Number(weight) || 0 : 0,
      reps: reps || target || '',
      rpe: rpe ? Number(rpe) : null,
      note,
      targetReps: target || '',
      targetWeight:
        currentType === 'work' && item.suggestedWeights?.[currentWorkIndex] != null
          ? item.suggestedWeights[currentWorkIndex]
          : null,
    })
    if (item.restSec > 0) {
      store.patchActive({ restEndsAt: Date.now() + item.restSec * 1000, restPausedRemaining: null })
    }
  }

  function skipSet() {
    if (needsWu) {
      store.completeSet({
        sessionItemId: item.sessionItemId,
        exerciseId: item.exerciseId,
        setType: 'wu',
        weight: 0,
        reps: 'skipped',
        rpe: null,
        note: 'skipped',
        targetReps: target || '',
        targetWeight: null,
      })
      return
    }
    store.completeSet({
      sessionItemId: item.sessionItemId,
      exerciseId: item.exerciseId,
      setType: 'work',
      weight: 0,
      reps: 'skipped',
      rpe: null,
      note: 'skipped',
      targetReps: target || '',
      targetWeight: item.suggestedWeights?.[currentWorkIndex] ?? null,
    })
  }

  function nextExercise() {
    store.patchActive({
      exerciseIndex: index + 1,
      restEndsAt: null,
      restPausedRemaining: null,
    })
  }

  function skipExercise() {
    if (needsWu) {
      store.completeSet({
        sessionItemId: item.sessionItemId,
        exerciseId: item.exerciseId,
        setType: 'wu',
        weight: 0,
        reps: 'skipped',
        rpe: null,
        note: 'skipped',
        targetReps: String(item.warmup?.reps || ''),
        targetWeight: null,
      })
    }
    for (let setIndex = currentWorkIndex; setIndex < workCount; setIndex++) {
      store.completeSet({
        sessionItemId: item.sessionItemId,
        exerciseId: item.exerciseId,
        setType: 'work',
        weight: 0,
        reps: 'skipped',
        rpe: null,
        note: 'skipped',
        targetReps: item.targets?.[setIndex] || item.targets?.at(-1) || '',
        targetWeight:
          item.suggestedWeights?.[setIndex] ?? item.suggestedWeights?.at(-1) ?? null,
      })
    }
    nextExercise()
  }

  const repsLabel = ex?.type === 'cardio' || isDurationTarget(target) ? 'Duration / reps' : 'Reps'

  return (
    <section>
      <Back to="/" />
      <h1>{session.name}</h1>
      <p>
        Exercise {index + 1} of {total} · {roleLabel(item.role)}
      </p>
      <h2>{ex?.name || item.exerciseId}</h2>
      <p>
        {(active.snapshot?.items || []).map((candidate, candidateIndex) => (
          <button
            key={candidate.id}
            type="button"
            disabled={candidateIndex === index}
            onClick={() => store.patchActive({
              exerciseIndex: candidateIndex,
              restEndsAt: null,
              restPausedRemaining: null,
            })}
          >
            {candidateIndex + 1}. {candidate.exerciseName} · {roleLabel(candidate.role)}
          </button>
        ))}
      </p>
      <p>
        {ex?.equipment} · step {ex?.weightStep || 'n/a'}
      </p>
      {ex?.cues ? <p>{ex.cues}</p> : null}
      {item.notes ? <p>Notes: {item.notes}</p> : null}
      {item.calibrationRequired && currentType === 'work' ? (
        <p>
          Calibration: choose a conservative starting load and complete the recommended reps with clean form.
          If it feels very easy, use the next valid load for the following set; hold for moderate effort; move
          down after missed reps or failure.
        </p>
      ) : null}

      <h3>Previous performance</h3>
      {last ? (
        <ul>
          {last.sets.map((s, i) => (
            <li key={i}>{formatSetLine(s)}</li>
          ))}
        </ul>
      ) : (
        <p>No previous log for this exercise.</p>
      )}

      <p>
        Today&apos;s target: {item.warmup ? 'WU set then ' : ''}
        {(item.targets || []).join(' / ')}
        {item.suggestedWeights?.length ? ` @ ${(item.suggestedWeights || []).join(' / ')} kg` : ''}
      </p>

      {logged.length ? (
        <div>
          <h3>This session</h3>
          <ul>
            {logged.map((s, i) => (
              <li key={i}>
                {formatSetLine(s)}
                {i === logged.length - 1 ? (
                  <>
                    {' '}
                    <button type="button" onClick={() => go(`/workout/${active.sessionId}/set/${(active.sets || []).lastIndexOf(s)}`)}>
                      Edit
                    </button>{' '}
                    <button type="button" onClick={() => store.removeActiveSet((active.sets || []).lastIndexOf(s))}>
                      Undo
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {resting ? (
        <RestBox remainingMs={remainingMs} paused={active.restPausedRemaining != null} restSec={item.restSec} />
      ) : exerciseDone ? (
        <p>
          <button type="button" onClick={nextExercise}>
            Next exercise
          </button>
        </p>
      ) : (
        <form key={`${item.exerciseId}-${currentType}-${currentWorkIndex}`} onSubmit={completeSet}>
          <h3>{needsWu ? 'WU set' : `Set ${currentWorkIndex + 1} of ${workCount}`}</h3>
          <p>Target: {target || '—'}</p>
          {usesWeight(ex) ? (
            <p>
              <label>
                Weight (kg)
                <br />
                <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
              </label>
            </p>
          ) : (
            <p>{ex?.type === 'cardio' ? 'No load' : 'Bodyweight / no load'}</p>
          )}
          <p>
            <label>
              {repsLabel}
              <br />
              <input value={reps} onChange={(e) => setReps(e.target.value)} required />
            </label>
          </p>
          {currentType === 'work' && ex?.type !== 'cardio' ? (
            <>
              <p>How hard was it?</p>
              <p>
                {RPE_OPTIONS.map((opt) => (
                  <label key={opt.value} style={{ display: 'inline-block', marginRight: '0.75rem' }}>
                    <input
                      type="radio"
                      name="rpe"
                      value={opt.value}
                      checked={String(rpe) === String(opt.value)}
                      onChange={() => setRpe(opt.value)}
                    />{' '}
                    {opt.value} {opt.label}
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
            <button type="submit">Complete set</button>{' '}
            <button type="button" onClick={skipSet}>
              Skip set
            </button>
          </p>
        </form>
      )}

      <p>
        <button
          type="button"
          onClick={() => {
            store.patchActive({
              extraSets: {
                ...(active.extraSets || {}),
                [item.sessionItemId]: extra + 1,
              },
            })
          }}
        >
          Add set
        </button>{' '}
        <button type="button" onClick={skipExercise}>
          Skip exercise
        </button>
      </p>
      <p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Abandon this workout? Logged sets will be lost.')) {
              store.abandonWorkout()
              go('/')
            }
          }}
        >
          Abandon workout
        </button>
      </p>
    </section>
  )
}

function RestBox({ remainingMs, paused, restSec }) {
  const store = useStore()
  const sec = Math.ceil(remainingMs / 1000)
  return (
    <div>
      <h3>Rest</h3>
      <p>
        {paused ? 'Paused' : 'Resting'}: {sec}s (planned {restSec}s)
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
          Skip rest
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
          +30 seconds
        </button>
      </p>
    </div>
  )
}

export function WorkoutSetEdit({ sessionId, index }) {
  const store = useStore()
  const workout = store.activeWorkout
  const set = workout?.sessionId === sessionId ? workout.sets?.[index] : null
  const item = workout?.snapshot?.items?.find(
    (candidate) => candidate.sessionItemId === set?.sessionItemId,
  )
  const usesLoad = item?.exerciseType !== 'cardio' && item?.exerciseType !== 'bodyweight'
  const usesRpe = set?.setType !== 'wu' && item?.exerciseType !== 'cardio'
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  const [rpe, setRpe] = useState(set?.rpe ?? '')
  const [note, setNote] = useState(set?.note || '')

  if (!workout || !set) {
    return (
      <section>
        <Back to={`/workout/${sessionId}`} />
        <p>Active set not found.</p>
      </section>
    )
  }

  return (
    <section>
      <Back to={`/workout/${sessionId}`} />
      <p>Active workout · {workout.snapshot?.sessionName}</p>
      <h1>Edit set</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          store.updateActiveSet(index, {
            weight: weight === '' ? 0 : Number(weight),
            reps,
            rpe: rpe === '' ? null : Number(rpe),
            note,
          })
          go(`/workout/${sessionId}`)
        }}
      >
        {usesLoad ? <p><label>Weight (kg)<br /><input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" /></label></p> : null}
        <p><label>Reps / duration<br /><input value={reps} onChange={(event) => setReps(event.target.value)} /></label></p>
        {usesRpe ? <p>
          <label>RPE<br />
            <select value={rpe} onChange={(event) => setRpe(event.target.value)}>
              <option value="">—</option>
              {RPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value} {option.label}</option>)}
            </select>
          </label>
        </p> : null}
        <p><label>Note<br /><input value={note} onChange={(event) => setNote(event.target.value)} /></label></p>
        <p><button type="submit">Save</button> <button type="button" onClick={() => go(`/workout/${sessionId}`)}>Cancel</button></p>
      </form>
    </section>
  )
}

function FinishScreen() {
  const store = useStore()
  const [overallNote, setOverallNote] = useState('')
  const [overallFeel, setOverallFeel] = useState('Good')
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
        set.sessionItemId === item.sessionItemId &&
        String(set.reps).toLowerCase() !== 'skipped',
    )
    const recommendation = recommendNextPrescription({
      targets: item.targets,
      sets,
      exercise,
    })
    const skippedForItem = (active?.sets || []).some(
      (set) =>
        set.sessionItemId === item.sessionItemId &&
        String(set.reps).toLowerCase() === 'skipped',
    )
    return {
      sessionItemId: item.sessionItemId,
      exerciseId: item.exerciseId,
      name: item.exerciseName,
      from: item.suggestedWeights || [],
      to: sets.length ? recommendation.weights : item.suggestedWeights || [],
      targetsFrom: item.targets || [],
      targetsTo: recommendation.targets,
      action: recommendation.action,
      reason:
        !sets.length && skippedForItem
          ? 'No completed sets; the previous recommendation is kept.'
          : recommendation.reason,
    }
  })
  const skipped = (active?.sets || []).filter(
    (set) => String(set.reps).toLowerCase() === 'skipped',
  ).length

  return (
    <section>
      <Back to="/" />
      <h1>Session done</h1>
      <p>{active?.snapshot?.sessionName}</p>
      <p>
        Duration: {minutes} min · Exercises: {items.length} · Sets: {setCount}
      </p>
      {skipped ? <p>{skipped} skipped set{skipped === 1 ? '' : 's'} logged.</p> : null}
      <h3>Recommended next time ({goalLabel(active?.snapshot?.goal)})</h3>
      <ul>
        {progression.map((item) => (
          <li key={item.sessionItemId}>
            {item.name}: {item.to.length ? `${item.to.join('/')} kg` : item.targetsTo.join('/')} — {item.reason}
          </li>
        ))}
      </ul>
      <p>These recommendations are saved with this workout and will seed the next dated plan. You can edit that plan before training.</p>
      <p>How did it feel overall?</p>
      <p>
        {['Easy', 'Good', 'Hard', 'Exhausting'].map((f) => (
          <label key={f} style={{ marginRight: '0.75rem' }}>
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
          Save and finish
        </button>
      </p>
    </section>
  )
}
