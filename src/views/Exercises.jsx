import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchExerciseCatalog } from '../exerciseCatalog'
import { EXERCISE_TYPES } from '../ids'
import { go } from '../route'
import { useStore } from '../store-context'
import { Back } from './shared'

export function Exercises() {
  const store = useStore()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const list = store.exercises.filter((ex) => {
    if (ex.archivedAt) return false
    if (!q) return true
    return `${ex.name} ${ex.equipment} ${ex.muscles}`.toLowerCase().includes(q)
  })

  return (
    <section>
      <h1>Exercises</h1>
      <p>The library. Add movements here, then pick them when you build a routine.</p>
      <p>
        <a href="#/exercises/new">Add exercise</a>
      </p>
      <p>
        <label>
          Search
          <br />
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </p>
      {list.length === 0 ? <p>No exercises yet.</p> : null}
      <ul>
        {list.map((ex) => (
          <li key={ex.id}>
            <a href={`#/exercises/${ex.id}`}>{ex.name}</a> — {ex.equipment}
          </li>
        ))}
      </ul>
    </section>
  )
}

function createPaths(returnRoutineId) {
  if (returnRoutineId) {
    return {
      hub: `/routines/${returnRoutineId}/exercise/create`,
      pick: `/routines/${returnRoutineId}/exercise/new`,
      manual: `/routines/${returnRoutineId}/exercise/create/manual`,
      search: `/routines/${returnRoutineId}/exercise/create/search`,
      afterCreate: (exerciseId) => `/routines/${returnRoutineId}/exercise/new/${exerciseId}`,
    }
  }
  return {
    hub: '/exercises/new',
    pick: '/exercises',
    manual: '/exercises/new/manual',
    search: '/exercises/new/search',
    afterCreate: (exerciseId) => `/exercises/${exerciseId}/edit`,
  }
}

export function ExerciseNew({ returnRoutineId = null }) {
  const paths = createPaths(returnRoutineId)
  return (
    <section>
      <Back />
      <h1>Add exercise</h1>
      <p>Add it yourself, or search a public exercise database and copy it into your library.</p>
      <p>
        <a href={`#${paths.manual}`}>Add manually</a>
        {' · '}
        <a href={`#${paths.search}`}>Search database</a>
      </p>
    </section>
  )
}

export function ExerciseNewManual({ returnRoutineId = null }) {
  const store = useStore()
  const paths = createPaths(returnRoutineId)
  const [name, setName] = useState('')
  const [type, setType] = useState('free')

  return (
    <section>
      <Back />
      <h1>Add exercise</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const id = store.addExercise({ name, type, equipment: '', weightStep: '', muscles: '', cues: '' })
          go(paths.afterCreate(id), { replace: true })
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
            Type
            <br />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {EXERCISE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go(paths.hub)}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function ExerciseNewSearch({ returnRoutineId = null }) {
  const store = useStore()
  const paths = createPaths(returnRoutineId)
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let cancelled = false
    loadExerciseCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the exercise database.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hits = catalog ? searchExerciseCatalog(catalog, query) : []
  const libraryNames = new Map(
    (store.exercises || [])
      .filter((exercise) => !exercise.archivedAt)
      .map((exercise) => [exercise.name.trim().toLowerCase(), exercise]),
  )

  return (
    <section>
      <Back />
      <h1>Search database</h1>
      <p>
        Two public catalogs, including bodyweight moves the first one skips. Picking one copies
        name, equipment, muscles, and form cues into this device. You can edit the copy after.
      </p>
      <p>
        Exercise data by <a href="https://repdb.co">RepDB</a>, plus the free-exercise-db catalog.
      </p>
      {error ? <p>{error}</p> : null}
      {catalog === null && !error ? <p>Loading database…</p> : null}
      {catalog ? (
        <>
          <p>
            <label>
              Search
              <br />
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </p>
          {query.trim().length < 2 ? <p>Type at least two letters.</p> : null}
          {query.trim().length >= 2 && hits.length === 0 ? <p>No matches.</p> : null}
          <ul>
            {hits.map((item) => {
              const existing = libraryNames.get(String(item.name || '').trim().toLowerCase())
              return (
                <li key={item.id || item.name}>
                  {item.name} — {item.equipment || 'bodyweight'}
                  {existing ? (
                    <>
                      {' '}
                      <a href={`#${returnRoutineId ? paths.afterCreate(existing.id) : `/exercises/${existing.id}`}`}>
                        {returnRoutineId ? 'Add to routine' : 'Already in library'}
                      </a>
                    </>
                  ) : (
                    <>
                      {' '}
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => {
                          setBusyId(item.id)
                          const id = store.addExercise(catalogItemToExercise(item))
                          go(paths.afterCreate(id), { replace: true })
                        }}
                      >
                        Add
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}

export function ExerciseEdit({ exerciseId }) {
  const store = useStore()
  const ex = store.exercises.find((e) => e.id === exerciseId)
  const [name, setName] = useState(ex?.name || '')
  const [type, setType] = useState(ex?.type || 'free')
  const [equipment, setEquipment] = useState(ex?.equipment || '')
  const [weightStep, setWeightStep] = useState(ex?.weightStep || '2.5')
  const [muscles, setMuscles] = useState(ex?.muscles || '')
  const [cues, setCues] = useState(ex?.cues || '')

  if (!ex) {
    return (
      <section>
        <p>Exercise not found.</p>
        <Back />
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>Exercise details</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateExercise(ex.id, {
            name: name.trim() || ex.name,
            type,
            equipment: equipment.trim() || 'Unknown',
            weightStep: weightStep.trim() || 'n/a',
            muscles: muscles.trim(),
            cues: cues.trim(),
          })
          go(`/exercises/${ex.id}`)
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
            Type
            <br />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {EXERCISE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Equipment
            <br />
            <input value={equipment} onChange={(e) => setEquipment(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Weight step
            <br />
            <input value={weightStep} onChange={(e) => setWeightStep(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Primary muscles
            <br />
            <input value={muscles} onChange={(e) => setMuscles(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Form cues
            <br />
            <textarea value={cues} onChange={(e) => setCues(e.target.value)} rows={3} />
          </label>
        </p>
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go(`/exercises/${ex.id}`)}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function ExerciseDetail({ exerciseId }) {
  const store = useStore()
  const ex = store.exercises.find((e) => e.id === exerciseId)
  if (!ex) {
    return (
      <section>
        <p>Exercise not found.</p>
        <Back />
      </section>
    )
  }

  return (
    <section>
      <Back />
      <h1>{ex.name}</h1>
      <p>
        <a href={`#/exercises/${ex.id}/edit`}>Edit</a>
      </p>
      <p>Equipment: {ex.equipment}</p>
      <p>Type: {ex.type}</p>
      <p>Weight increments: {ex.weightStep}</p>
      <p>Primary muscles: {ex.muscles || '—'}</p>
      <h3>Form cues</h3>
      <p>{ex.cues || '—'}</p>
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete ${ex.name}? It will leave active routines, while completed history keeps its original name and sets.`)) return
            store.removeExercise(ex.id)
            go('/exercises')
          }}
        >
          Delete
        </button>
      </p>
    </section>
  )
}
