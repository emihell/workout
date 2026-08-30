import { useState } from 'react'
import { FOCUS_OPTIONS, ROUTINE_ROLES, formatTargets, parseTargets, roleLabel } from '../ids'
import { go } from '../route'
import { routineById, historyPrescription } from '../storage'
import { useStore } from '../store-context'
import { Back } from './shared'

function routinePath(routineId, extra = '') {
  return `/routines/${routineId}${extra}`
}

export function Routines() {
  const store = useStore()
  const routines = (store.routines || []).filter((routine) => !routine.archivedAt)

  return (
    <section>
      <h1>Routines</h1>
      <p>Reusable workouts. Put them on a weekday in Schedule.</p>
      <p>
        <a href="#/routines/new">Add routine</a>
      </p>
      {routines.length === 0 ? <p>None yet.</p> : null}
      <ul>
        {routines.map((routine) => (
          <li key={routine.id}>
            <a href={`#${routinePath(routine.id)}`}>{routine.name}</a>{' '}
            ({routine.focus}, {routine.exercises.length} exercises)
          </li>
        ))}
      </ul>
    </section>
  )
}

export function RoutineNew() {
  const store = useStore()
  const [name, setName] = useState('')
  const [focus, setFocus] = useState('Machines')

  return (
    <section>
      <Back />
      <h1>Add routine</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const id = store.addRoutine({ name, focus })
          go(routinePath(id))
        }}
      >
        <p>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Focus
            <br />
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              {FOCUS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <button type="submit">Next</button>{' '}
          <button type="button" onClick={() => go('/routines')}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function RoutineDetail({ routineId }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)

  if (!routine) {
    return (
      <section>
        <p>Routine not found.</p>
        <Back />
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>{routine.name}</h1>
      <p>
        {routine.focus}
        {' · '}
        <a href={`#${routinePath(routine.id, '/edit')}`}>Edit name and focus</a>
      </p>
      <h2>Exercises</h2>
      <p>Sets, kg, rest, and notes live here and tick up after you finish a workout.</p>
      <p>
        <button type="button" onClick={() => go(routinePath(routine.id, '/exercise/new'))}>
          Add exercise
        </button>
      </p>
      {routine.exercises.length === 0 ? <p>None yet.</p> : null}
      <ol>
        {routine.exercises.map((item, index) => {
          const ex = store.exercises.find((e) => e.id === item.exerciseId)
          const kg = (item.suggestedWeights || []).some((weight) => Number(weight) > 0)
            ? ` · ${(item.suggestedWeights || []).join('/')} kg`
            : ''
          return (
            <li key={item.id || `${item.exerciseId}-${index}`}>
              <a href={`#${routinePath(routine.id, `/exercise/${item.id}`)}`}>{ex?.name || item.exerciseId}</a>
              {' — '}
              {roleLabel(item.role)}
              {item.warmup ? ' · WU set' : ''}
              {' · '}
              {item.sets || 1} {(item.sets || 1) === 1 ? 'set' : 'sets'}
              {formatTargets(item.targets) ? ` · ${formatTargets(item.targets)}` : ''}
              {kg}
              {' '}
              <button type="button" onClick={() => store.moveRoutineExercise(routine.id, index, -1)}>
                Up
              </button>{' '}
              <button type="button" onClick={() => store.moveRoutineExercise(routine.id, index, 1)}>
                Down
              </button>
            </li>
          )
        })}
      </ol>
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete ${routine.name}? It will leave the schedule, while completed history is preserved.`)) return
            store.removeRoutine(routine.id)
            go('/routines')
          }}
        >
          Delete routine
        </button>
      </p>
    </section>
  )
}

export function RoutineEdit({ routineId }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const [name, setName] = useState(routine?.name || '')
  const [focus, setFocus] = useState(routine?.focus || 'Machines')

  if (!routine) {
    return (
      <section>
        <p>Routine not found.</p>
        <Back />
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>Name and focus</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateRoutine(routine.id, { name: name.trim() || routine.name, focus })
          go(routinePath(routine.id))
        }}
      >
        <p>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Focus
            <br />
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              {FOCUS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go(routinePath(routine.id))}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function RoutineExercisePick({ routineId }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const [query, setQuery] = useState('')

  if (!routine) {
    return (
      <section>
        <p>Routine not found.</p>
        <Back />
      </section>
    )
  }

  const matches = store.exercises.filter((ex) => {
    if (ex.archivedAt) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${ex.name} ${ex.equipment} ${ex.muscles}`.toLowerCase().includes(q)
  })

  return (
    <section>
      <Back />
      <h1>Add exercise</h1>
      <p>Pick from the library, then set sets, reps, kg, and rest.</p>
      <p>
        <a href={`#${routinePath(routine.id, '/exercise/create')}`}>Create exercise</a>
      </p>
      {store.exercises.length === 0 ? (
        <p>Library empty. Create an exercise first.</p>
      ) : (
        <>
          <p>
            <label>
              Search
              <br />
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </p>
          {matches.length === 0 ? <p>No matches.</p> : null}
          <ul>
            {matches.map((ex) => (
              <li key={ex.id}>
                <a href={`#${routinePath(routine.id, `/exercise/new/${ex.id}`)}`}>
                  {ex.name}
                </a>{' '}
                ({ex.equipment})
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function ExerciseFields({ item, onChange, onCancel, defaults }) {
  const [role, setRole] = useState(item.role || defaults.role || 'main')
  const [warmup, setWarmup] = useState(Boolean(item.warmup))
  const [sets, setSets] = useState(() => {
    const value = item.sets ?? defaults.sets
    return value == null || value === '' ? '' : String(value)
  })
  const [targets, setTargets] = useState(formatTargets(item.targets || defaults.targets || []))
  const [weights, setWeights] = useState((item.suggestedWeights || defaults.suggestedWeights || []).join('/'))
  const [restSec, setRestSec] = useState(() => {
    const value = item.restSec ?? defaults.restSec
    return value == null || value === '' ? '' : String(value)
  })
  const [notes, setNotes] = useState(item.notes || '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const enteredSets = Number(sets)
        const targetParts = String(targets || '')
          .split(/[/,]/)
          .map((value) => value.trim())
          .filter(Boolean)
        const weightParts = String(weights || '')
          .split(/[/,]/)
          .map((value) => Number(value.trim()))
          .filter(Number.isFinite)
        const count = Math.max(
          Number.isFinite(enteredSets) && enteredSets > 0 ? enteredSets : 0,
          targetParts.length,
          weightParts.length,
          1,
        )
        onChange({
          role,
          warmup: warmup ? item.warmup || { reps: 12 } : null,
          sets: count,
          targets: parseTargets(targets, count),
          suggestedWeights: weights
            .split(/[/,]/)
            .map((value) => Number(value.trim()))
            .filter(Number.isFinite)
            .slice(0, count),
          restSec: Math.max(0, Number(restSec) || 0),
          notes,
        })
      }}
    >
      <p>
        <label>
          Role in this routine
          <br />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROUTINE_ROLES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <label>
          <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} /> WU set
        </label>
      </p>
      <p>
        <label>
          Sets
          <br />
          <input type="number" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
      </p>
      <p>
        <label>
          Reps
          <br />
          <input value={targets} onChange={(e) => setTargets(e.target.value)} />
        </label>
      </p>
      <p>
        <label>
          Kg
          <br />
          <input value={weights} onChange={(e) => setWeights(e.target.value)} />
        </label>
      </p>
      <p>
        <label>
          Rest between sets (sec)
          <br />
          <input type="number" min="0" value={restSec} onChange={(e) => setRestSec(e.target.value)} />
        </label>
      </p>
      <p>
        <label>
          Notes
          <br />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
        </label>
      </p>
      <p>
        <button type="submit">Save</button>{' '}
        <button type="button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  )
}

export function RoutineExerciseNew({ routineId, exerciseId }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const ex = store.exercises.find((e) => e.id === exerciseId)
  const history = historyPrescription(store.workouts, ex?.id)
  const defaults = {
    role: ex?.type === 'cardio' ? 'warmup' : 'main',
    restSec: history?.restSec ?? '',
    sets: history?.sets ?? '',
    targets: history?.targets || [],
    suggestedWeights: history?.suggestedWeights || [],
  }

  if (!routine || !ex) {
    return (
      <section>
        <p>Not found.</p>
        <Back />
      </section>
    )
  }

  return (
    <section>
      <Back />
      <p>{routine.name}</p>
      <h1>{ex.name}</h1>
      <p>Sets, kg, rest, and notes live here. After you finish a workout they tick up for next time. A WU set is an easy set before working weight.</p>
      <ExerciseFields
        item={{
          role: defaults.role,
          notes: history?.notes || '',
          warmup: history?.warmup || null,
          restSec: defaults.restSec,
          sets: defaults.sets,
          targets: defaults.targets,
          suggestedWeights: defaults.suggestedWeights,
        }}
        defaults={defaults}
        onCancel={() => go(routinePath(routine.id, '/exercise/new'))}
        onChange={(patch) => {
          store.addRoutineExercise(routine.id, { exerciseId: ex.id, ...patch })
          go(routinePath(routine.id))
        }}
      />
    </section>
  )
}

export function RoutineExerciseEdit({ routineId, itemId }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const index = routine?.exercises?.findIndex((candidate) => candidate.id === itemId)
  const item = routine?.exercises?.[index]
  const ex = store.exercises.find((e) => e.id === item?.exerciseId)
  const parent = routine ? routinePath(routine.id) : '/routines'

  if (!routine || index < 0 || !item) {
    return (
      <section>
        <p>Exercise not found.</p>
        <Back />
      </section>
    )
  }

  const defaults = {
    role: item.role || 'main',
    restSec: item.restSec || 0,
    sets: item.sets || 1,
    targets: item.targets || [],
    suggestedWeights: item.suggestedWeights || [],
  }

  return (
    <section>
      <Back />
      <p>{routine.name}</p>
      <h1>{ex?.name || item.exerciseId}</h1>
      <p>This is next time&apos;s prescription. It updates when you finish a workout. A WU set is an easy set before working weight.</p>
      <ExerciseFields
        key={`${routine.id}-${index}`}
        item={item}
        defaults={defaults}
        onCancel={() => go(parent)}
        onChange={(patch) => {
          store.updateRoutineExercise(routine.id, index, patch)
          go(parent)
        }}
      />
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Remove ${ex?.name || 'this exercise'} from the routine?`)) return
            store.removeRoutineExercise(routine.id, index)
            go(parent)
          }}
        >
          Remove from routine
        </button>
      </p>
    </section>
  )
}
