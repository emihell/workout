import { useState } from 'react'
import { FOCUS_OPTIONS, ROUTINE_ROLES, formatTargets, parseTargets, roleLabel } from '../ids'
import { go } from '../route'
import { routineById, historyPrescription } from '../storage'
import { useStore } from '../store-context'
import { ExerciseNew, ExerciseNewManual, ExerciseNewSearch } from './Exercises'
import { Back, Missing } from './shared'

function routinePath(routineId, extra = '') {
  return `/routines/${routineId}${extra}`
}

export function navForBase(base, done, { extra = null, showDelete = true } = {}) {
  return {
    base,
    done,
    extra,
    showDelete,
    edit: `${base}/edit`,
    pick: `${base}/exercise/new`,
    create: `${base}/exercise/create`,
    createManual: `${base}/exercise/create/manual`,
    createSearch: `${base}/exercise/create/search`,
    newItem: (exerciseId) => `${base}/exercise/new/${exerciseId}`,
    item: (itemId) => `${base}/exercise/${itemId}`,
  }
}

function pathsFor(routineId, paths) {
  return paths || navForBase(`/routines/${routineId}`, '/routines')
}

export function Routines() {
  const store = useStore()
  const routines = (store.routines || []).filter((routine) => !routine.archivedAt)

  return (
    <section>
      <h1>Routines</h1>
      <p>
        <a href="#/routines/new">Add routine</a>
      </p>
      {routines.length === 0 ? <p>None.</p> : null}
      <ul>
        {routines.map((routine) => (
          <li key={routine.id}>
            <a href={`#${routinePath(routine.id)}`}>{routine.name}</a>
            {' — '}
            {routine.focus}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function RoutineNewForm({ onSave, onCancel, submitLabel = 'Next' }) {
  const [name, setName] = useState('')
  const [focus, setFocus] = useState('Machines')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ name, focus })
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
        <button type="submit">{submitLabel}</button>{' '}
        <button type="button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  )
}

export function RoutineNew() {
  const store = useStore()

  return (
    <section>
      <Back />
      <h1>Add routine</h1>
      <RoutineNewForm
        onSave={({ name, focus }) => {
          const id = store.addRoutine({ name, focus })
          go(routinePath(id))
        }}
        onCancel={() => go('/routines')}
      />
    </section>
  )
}

export function RoutineDetail({ routineId, paths }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const nav = pathsFor(routineId, paths)

  if (!routine) {
    return <Missing>Not found.</Missing>
  }

  const meta = [nav.extra, routine.focus].filter(Boolean).join(' · ')

  return (
    <section>
      <Back />
      <h1>{routine.name}</h1>
      <p>
        {meta}
        {meta ? ' · ' : ''}
        <a href={`#${nav.edit}`}>Edit</a>
      </p>
      <h2>Exercises</h2>
      <p>
        <a href={`#${nav.pick}`}>Add exercise</a>
      </p>
      {routine.exercises.length === 0 ? <p>None.</p> : null}
      <ol>
        {routine.exercises.map((item, index) => {
          const ex = store.exercises.find((e) => e.id === item.exerciseId)
          const kg = (item.suggestedWeights || []).some((weight) => Number(weight) > 0)
            ? ` · ${(item.suggestedWeights || []).join('/')} kg`
            : ''
          return (
            <li key={item.id || `${item.exerciseId}-${index}`}>
              <a href={`#${nav.item(item.id)}`}>{ex?.name || item.exerciseId}</a>
              {' — '}
              {roleLabel(item.role)}
              {item.warmup ? ' · WU set' : ''}
              {' · '}
              {item.sets || 1} {(item.sets || 1) === 1 ? 'set' : 'sets'}
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
        <button type="button" onClick={() => go(nav.done)}>
          Done
        </button>
      </p>
      {nav.showDelete ? (
        <p>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Delete ${routine.name}?`)) return
              store.removeRoutine(routine.id)
              go(nav.done)
            }}
          >
            Delete
          </button>
        </p>
      ) : null}
    </section>
  )
}

export function RoutineEdit({ routineId, paths }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const nav = pathsFor(routineId, paths)
  const [name, setName] = useState(routine?.name || '')
  const [focus, setFocus] = useState(routine?.focus || 'Machines')

  if (!routine) {
    return <Missing>Not found.</Missing>
  }

  return (
    <section>
      <Back />
      <h1>Name</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateRoutine(routine.id, { name: name.trim() || routine.name, focus })
          go(nav.base)
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
          <button type="button" onClick={() => go(nav.base)}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function RoutineExercisePick({ routineId, paths }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const nav = pathsFor(routineId, paths)
  const [query, setQuery] = useState('')

  if (!routine) {
    return <Missing>Not found.</Missing>
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
      <p>
        <a href={`#${nav.create}`}>Create exercise</a>
      </p>
      {store.exercises.length === 0 ? (
        <p>None.</p>
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
                <a href={`#${nav.newItem(ex.id)}`}>
                  {ex.name}
                </a>
                {' — '}
                {ex.equipment}
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
          Role
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
          Rest (s)
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

export function RoutineExerciseNew({ routineId, exerciseId, paths }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const nav = pathsFor(routineId, paths)
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
    return <Missing>Not found.</Missing>
  }

  return (
    <section>
      <Back />
      <p>{routine.name}</p>
      <h1>{ex.name}</h1>
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
        onCancel={() => go(nav.pick)}
        onChange={(patch) => {
          store.addRoutineExercise(routine.id, { exerciseId: ex.id, ...patch })
          go(nav.base)
        }}
      />
    </section>
  )
}

export function RoutineExerciseEdit({ routineId, itemId, paths }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const nav = pathsFor(routineId, paths)
  const index = routine?.exercises?.findIndex((candidate) => candidate.id === itemId)
  const item = routine?.exercises?.[index]
  const ex = store.exercises.find((e) => e.id === item?.exerciseId)
  const parent = routine ? nav.base : '/routines'

  if (!routine || index < 0 || !item) {
    return <Missing>Not found.</Missing>
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
            if (!window.confirm(`Remove ${ex?.name || 'this exercise'}?`)) return
            store.removeRoutineExercise(routine.id, index)
            go(parent)
          }}
        >
          Remove
        </button>
      </p>
    </section>
  )
}

export function RoutineScreens({ routineId, paths, screen = 'detail', itemId, exerciseId }) {
  if (screen === 'edit') return <RoutineEdit routineId={routineId} paths={paths} />
  if (screen === 'exercise-pick') return <RoutineExercisePick routineId={routineId} paths={paths} />
  if (screen === 'exercise-create') return <ExerciseNew returnBase={paths.base} />
  if (screen === 'exercise-create-manual') return <ExerciseNewManual returnBase={paths.base} />
  if (screen === 'exercise-create-search') return <ExerciseNewSearch returnBase={paths.base} />
  if (screen === 'exercise-new') {
    return <RoutineExerciseNew routineId={routineId} exerciseId={exerciseId} paths={paths} />
  }
  if (screen === 'exercise') {
    return <RoutineExerciseEdit routineId={routineId} itemId={itemId} paths={paths} />
  }
  return <RoutineDetail routineId={routineId} paths={paths} />
}
