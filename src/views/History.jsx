import { useState } from 'react'
import { RPE_OPTIONS, formatSetLine, roleLabel } from '../ids'
import { formatProgressionLine } from '../progress'
import { go } from '../route'
import { dateKey } from '../schedule'
import {
  durationLabel,
  exerciseById,
  exercisesInHistory,
  findSession,
  groupSetsByExercise,
  groupWorkoutsBySession,
  workoutVolume,
} from '../storage'
import { useStore } from '../store-context'
import { Back } from './shared'

function sessionTitle(program, session) {
  if (program && session) return `${program.name} — ${session.name}`
  if (session) return session.name
  return 'Session'
}

function whenLabel(workout) {
  return new Date(workout.finishedAt || workout.startedAt).toLocaleString()
}

function workoutDateKey(workout) {
  if (workout.performedOn) return workout.performedOn
  const stamp = workout.finishedAt || workout.startedAt
  if (stamp) return dateKey(stamp)
  return workout.scheduledFor || 'unknown'
}

function compactDate(key) {
  if (key === 'unknown') return 'Unknown date'
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function sortWorkoutsByDate(workouts) {
  return [...(workouts || [])].sort((a, b) => {
    const left = workoutDateKey(a)
    const right = workoutDateKey(b)
    if (left === 'unknown' && right !== 'unknown') return 1
    if (right === 'unknown' && left !== 'unknown') return -1
    if (left !== right) return right.localeCompare(left)
    return new Date(b.finishedAt || b.startedAt || 0).getTime() - new Date(a.finishedAt || a.startedAt || 0).getTime()
  })
}

function addSetToWorkout(store, workout, exerciseId, sessionItemId = null) {
  const last = (workout.sets || [])
    .filter((s) =>
      sessionItemId ? s.sessionItemId === sessionItemId : s.exerciseId === exerciseId,
    )
    .at(-1)
  const resolvedItemId = sessionItemId || last?.sessionItemId || `history-${workout.id}-${exerciseId}`
  const sets = [
    ...(workout.sets || []),
    {
      exerciseId,
      sessionItemId: resolvedItemId,
      setType: 'work',
      weight: last?.weight || 0,
      reps: '',
      rpe: null,
      note: '',
    },
  ]
  const exercise = exerciseById(store.exercises, exerciseId)
  const snapshot = workout.snapshot
    ? {
        ...workout.snapshot,
        items: (workout.snapshot.items || []).some(
          (item) => item.sessionItemId === resolvedItemId,
        )
          ? workout.snapshot.items
          : [
              ...(workout.snapshot.items || []),
              {
                sessionItemId: resolvedItemId,
                exerciseId,
                exerciseName: exercise?.name || 'Deleted exercise',
                equipment: exercise?.equipment || '',
                exerciseType: exercise?.type || 'free',
                weightStep: exercise?.weightStep || 'n/a',
                role: 'main',
                targets: [],
                suggestedWeights: [],
                restSec: 0,
                notes: 'Added during history correction',
                warmup: null,
              },
            ],
      }
    : workout.snapshot
  store.updateWorkout(workout.id, { sets, snapshot })
  go(`/history/${workout.id}/set/${sets.length - 1}`)
}

export function History() {
  const store = useStore()
  const workouts = sortWorkoutsByDate(store.workouts || [])

  return (
    <section>
      <h1>History</h1>
      <p>
        <a href="#/history/exercises">By exercise</a>
      </p>
      {workouts.length === 0 ? <p>None yet.</p> : null}
      <ul>
        {workouts.map((workout) => {
          const { program, session } = findSession(store.programs, workout.sessionId)
          const programName = workout.snapshot?.programName || program?.name || 'Program'
          const sessionName = workout.snapshot?.sessionName || session?.name || 'Session'
          return (
            <li key={workout.id}>
              <a href={`#/history/${workout.id}`}>
                {compactDate(workoutDateKey(workout))} - {programName} - {sessionName}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function HistoryExercises() {
  const store = useStore()
  const list = exercisesInHistory(store.workouts || [], store.exercises, store.programs)

  return (
    <section>
      <Back to="/history" />
      <h1>By exercise</h1>
      <p>Each exercise, and the sessions it belongs to.</p>
      {list.length === 0 ? <p>No logged exercises yet.</p> : null}
      <ul>
        {list.map((item) => (
          <li key={item.id}>
            <a href={`#/history/exercise/${item.id}`}>{item.exercise?.name || item.id}</a>
            {item.sessions.length
              ? ` — ${item.sessions.map((x) => x.session.name).join(', ')}`
              : ' — not on a session'}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HistoryExercise({ exerciseId }) {
  const store = useStore()
  const ex = exerciseById(store.exercises, exerciseId)
  const visits = (store.workouts || []).filter((w) => (w.sets || []).some((s) => s.exerciseId === exerciseId))
  const groups = groupWorkoutsBySession(visits, store.programs)

  return (
    <section>
      <Back to="/history/exercises" />
      <h1>{ex?.name || exerciseId}</h1>
      {groups.length === 0 ? <p>No logged sets.</p> : null}
      {groups.map((group) => (
        <article key={group.groupId || group.sessionId}>
          <h2>{sessionTitle(group.program, group.session)}</h2>
          <ul>
            {group.workouts.map((w) => {
              const count = (w.sets || []).filter((s) => s.exerciseId === exerciseId).length
              return (
                <li key={w.id}>
                  <a href={`#/history/${w.id}/exercise/${exerciseId}`}>{whenLabel(w)}</a>
                  {` — ${count} set${count === 1 ? '' : 's'}`}
                </li>
              )
            })}
          </ul>
        </article>
      ))}
    </section>
  )
}

export function HistoryDetail({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  if (!workout) {
    return (
      <section>
        <p>Not found.</p>
        <Back to="/history" />
      </section>
    )
  }

  const { program, session } = findSession(store.programs, workout.sessionId)
  const snapshot = workout.snapshot
  const sets = workout.sets || []
  const groups = groupSetsByExercise(sets, {
    exercises: snapshot?.items || session?.exercises || [],
  })

  return (
    <section>
      <Back to="/history" />
      <h1>{snapshot ? `${snapshot.programName} — ${snapshot.sessionName}` : sessionTitle(program, session)}</h1>
      <p>{whenLabel(workout)}</p>
      <p>
        Duration: {durationLabel(workout.startedAt, workout.finishedAt) || '—'} · Sets: {sets.length} · Volume:{' '}
        {workoutVolume(workout)} kg
      </p>
      <p>
        {workout.overallFeel ? `Felt ${workout.overallFeel}. ` : ''}
        <a href={`#/history/${workout.id}/edit`}>Correct workout</a>
      </p>
      {workout.overallNote ? <p>{workout.overallNote}</p> : null}

      <h2>Exercises</h2>
      {groups.length === 0 ? <p>No sets logged.</p> : null}
      <ul>
        {groups.map((group) => {
          const ex = exerciseById(store.exercises, group.exerciseId)
          const snapshotItem = snapshot?.items?.find(
            (item) => item.sessionItemId === group.sessionItemId || item.exerciseId === group.exerciseId,
          )
          const n = group.items.length
          return (
            <li key={group.sessionItemId}>
              <a href={`#/history/${workout.id}/exercise/${group.sessionItemId}`}>{snapshotItem?.exerciseName || ex?.name || group.exerciseId}</a>
              {` — ${roleLabel(snapshotItem?.role)}${snapshotItem?.warmup ? ' · WU set' : ''} · ${n} set${n === 1 ? '' : 's'}`}
            </li>
          )
        })}
      </ul>
      <p>
        <a href={`#/history/${workout.id}/set/new`}>Correct log: add exercise</a>
      </p>

      {workout.progression?.length ? (
        <div>
          <h3>Recommendation recorded at finish</h3>
          <p>Correcting sets can preview and apply a recalculation for future automatic plans.</p>
          <ul>
            {workout.progression.map((c) => (
              <li key={c.sessionItemId || c.exerciseId}>
                {c.to
                  ? `${c.name}: ${c.to.length ? `${c.to.join('/')} kg` : (c.targetsTo || []).join('/')} — ${c.reason}`
                  : formatProgressionLine(c)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p>
        <button
          type="button"
          onClick={() => {
            go(`/history/${workout.id}/delete`)
          }}
        >
          Delete workout
        </button>
      </p>
    </section>
  )
}

export function HistoryWorkoutExercise({ workoutId, exerciseId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const snapshotItem = workout?.snapshot?.items?.find(
    (item) => item.sessionItemId === exerciseId || item.exerciseId === exerciseId,
  )
  const actualExerciseId = snapshotItem?.exerciseId || exerciseId
  const ex = exerciseById(store.exercises, actualExerciseId)
  const items = (workout?.sets || [])
    .map((s, index) => ({ s, index }))
    .filter((x) =>
      snapshotItem
        ? x.s.sessionItemId === snapshotItem.sessionItemId
        : x.s.exerciseId === exerciseId,
    )

  if (!workout) {
    return (
      <section>
        <p>Not found.</p>
        <Back to="/history" />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/history/${workout.id}`} />
      <h1>{snapshotItem?.exerciseName || ex?.name || exerciseId}</h1>
      <p>
        {roleLabel(snapshotItem?.role)}
        {snapshotItem?.warmup ? ' · WU set' : ''}
      </p>
      <p>{whenLabel(workout)}</p>
      {items.length === 0 ? <p>No sets yet.</p> : null}
      <ol>
        {items.map(({ s, index }) => (
          <li key={index}>
            <a href={`#/history/${workout.id}/set/${index}`}>{formatSetLine(s)}</a>
            {s.note ? ` — ${s.note}` : ''}
          </li>
        ))}
      </ol>
      <p>
        <button type="button" onClick={() => addSetToWorkout(store, workout, actualExerciseId, snapshotItem?.sessionItemId)}>
          Add set
        </button>
      </p>
    </section>
  )
}

export function HistoryEdit({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const [overallFeel, setOverallFeel] = useState(workout?.overallFeel || '')
  const [overallNote, setOverallNote] = useState(workout?.overallNote || '')

  if (!workout) {
    return (
      <section>
        <p>Not found.</p>
        <Back to="/history" />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/history/${workout.id}`} />
      <h1>Correct workout</h1>
      <p>Correct the overall note and feel here. Open an exercise to correct individual sets.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateWorkout(workout.id, { overallFeel, overallNote })
          go(`/history/${workout.id}`)
        }}
      >
        <p>
          {['', 'Easy', 'Good', 'Hard', 'Exhausting'].map((f) => (
            <label key={f || 'none'} style={{ marginRight: '0.75rem' }}>
              <input type="radio" name="feel" checked={overallFeel === f} onChange={() => setOverallFeel(f)} /> {f || '—'}
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
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go(`/history/${workout.id}`)}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function HistorySetNew({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)

  if (!workout) {
    return (
      <section>
        <p>Not found.</p>
        <Back to="/history" />
      </section>
    )
  }

  const { session } = findSession(store.programs, workout.sessionId)
  const snapshotItems = workout.snapshot?.items || []
  const fromSession = snapshotItems.length
    ? snapshotItems.map((item) => ({
        sessionItemId: item.sessionItemId,
        exerciseId: item.exerciseId,
        name: item.exerciseName,
      }))
    : (session?.exercises || []).map((item) => ({
        sessionItemId: item.id,
        exerciseId: item.exerciseId,
        name: exerciseById(store.exercises, item.exerciseId)?.name,
      }))
  const byKey = new Map(fromSession.map((item) => [item.sessionItemId || item.exerciseId, item]))
  for (const set of workout.sets || []) {
    const key = set.sessionItemId || set.exerciseId
    if (!byKey.has(key)) {
      byKey.set(key, {
        sessionItemId: set.sessionItemId,
        exerciseId: set.exerciseId,
        name: exerciseById(store.exercises, set.exerciseId)?.name,
      })
    }
  }
  for (const exercise of store.exercises.filter((candidate) => !candidate.archivedAt)) {
    const alreadyIncluded = [...byKey.values()].some(
      (choice) => choice.exerciseId === exercise.id,
    )
    if (!alreadyIncluded) {
      const sessionItemId = `history-${workout.id}-${exercise.id}`
      byKey.set(sessionItemId, {
        sessionItemId,
        exerciseId: exercise.id,
        name: exercise.name,
      })
    }
  }
  const choices = [...byKey.values()]

  return (
    <section>
      <Back to={`/history/${workout.id}`} />
      <h1>Add set</h1>
      <p>Pick the exercise.</p>
      {choices.length === 0 ? <p>No exercises to add a set for.</p> : null}
      <ul>
        {choices.map((choice) => {
          return (
            <li key={choice.sessionItemId || choice.exerciseId}>
              <button type="button" onClick={() => addSetToWorkout(store, workout, choice.exerciseId, choice.sessionItemId)}>
                {choice.name || choice.exerciseId}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function HistorySet({ workoutId, index }) {
  const store = useStore()
  const workout = store.workouts.find((x) => x.id === workoutId)
  const set = workout?.sets?.[index]
  const [setType, setSetType] = useState(set?.setType || 'work')
  const [weight, setWeight] = useState(set?.weight ?? '')
  const [reps, setReps] = useState(set?.reps ?? '')
  const [rpe, setRpe] = useState(set?.rpe ?? '')
  const [note, setNote] = useState(set?.note || '')

  if (!workout || !set) {
    return (
      <section>
        <p>Set not found.</p>
        <Back to="/history" />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/history/${workout.id}/exercise/${set.sessionItemId || set.exerciseId}`} />
      <p>{workout.snapshot?.sessionName || 'Workout'} · history correction</p>
      <h1>Set</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const sets = (workout.sets || []).map((s, i) =>
            i === index
              ? {
                  ...s,
                  setType,
                  weight: weight === '' ? '' : Number(weight),
                  reps,
                  rpe: rpe === '' ? null : Number(rpe),
                  note,
                }
              : s,
          )
          store.updateWorkout(workout.id, { sets })
          go(`/history/${workout.id}/recalculate`)
        }}
      >
        <p>
          <label>
            Type
            <br />
            <select value={setType} onChange={(e) => setSetType(e.target.value)}>
              <option value="wu">WU set</option>
              <option value="work">Work</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            kg
            <br />
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
          </label>
        </p>
        <p>
          <label>
            Reps
            <br />
            <input value={reps} onChange={(e) => setReps(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            RPE
            <br />
            <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
              <option value="">—</option>
              {RPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} {opt.label}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Note
            <br />
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </p>
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go(`/history/${workout.id}/exercise/${set.sessionItemId || set.exerciseId}`)}>Cancel</button>
        </p>
      </form>
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('Remove this set?')) return
            store.updateWorkout(workout.id, { sets: (workout.sets || []).filter((_, i) => i !== index) })
            go(`/history/${workout.id}/recalculate`)
          }}
        >
          Remove set
        </button>
      </p>
    </section>
  )
}

export function HistoryRecalculate({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  if (!workout) {
    return (
      <section>
        <Back to="/history" />
        <p>Workout not found.</p>
      </section>
    )
  }
  const today = new Date().toISOString().slice(0, 10)
  const affected = (store.plannedWorkouts || []).filter(
    (plan) =>
      plan.sessionId === workout.sessionId &&
      plan.date >= today &&
      !plan.manuallyEdited,
  )

  return (
    <section>
      <Back to={`/history/${workout.id}`} />
      <h1>Recalculate future recommendations?</h1>
      <p>The correction is saved. Recalculation will regenerate future automatic plans from corrected history.</p>
      <p>
        {affected.length
          ? `${affected.length} automatically generated future plan${affected.length === 1 ? '' : 's'} will be regenerated.`
          : 'No saved automatic future plans need clearing; the next one will use this correction.'}
      </p>
      <p>Plans you manually edited are preserved.</p>
      <p>
        <button
          type="button"
          onClick={() => {
            store.recalculateFuturePlans(workout.id)
            go(`/history/${workout.id}`)
          }}
        >
          Apply recalculation
        </button>{' '}
        <button type="button" onClick={() => go(`/history/${workout.id}`)}>Keep future plans</button>
      </p>
    </section>
  )
}

export function HistoryDelete({ workoutId }) {
  const store = useStore()
  const workout = store.workouts.find((candidate) => candidate.id === workoutId)
  if (!workout) {
    return (
      <section>
        <Back to="/history" />
        <p>Workout not found.</p>
      </section>
    )
  }
  return (
    <section>
      <Back to={`/history/${workout.id}`} />
      <h1>Delete completed workout?</h1>
      <p>{workout.snapshot?.sessionName || 'Session'} · {whenLabel(workout)}</p>
      <p>This removes the history record. Future automatic recommendations will be regenerated from the remaining history; manually edited dated plans stay unchanged.</p>
      <p>
        <button
          type="button"
          onClick={() => {
            store.recalculateFuturePlans(workout.id)
            store.removeWorkout(workout.id)
            go('/history')
          }}
        >
          Delete workout
        </button>{' '}
        <button type="button" onClick={() => go(`/history/${workout.id}`)}>Cancel</button>
      </p>
    </section>
  )
}
