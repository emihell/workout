import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchExerciseCatalog } from '../exerciseCatalog'
import { EXERCISE_TYPES } from '../ids'
import { go } from '../route'
import { useStore } from '../store-context'
import { Back, Missing } from './shared'

const TYPE_LABELS = {
  machine: 'Machine',
  free: 'Free weights',
  bodyweight: 'Bodyweight',
  cardio: 'Cardio',
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type || 'Other'
}

function matchesQuery(ex, q) {
  if (!q) return true
  return `${ex.name} ${ex.equipment} ${ex.muscles} ${ex.type} ${typeLabel(ex.type)}`.toLowerCase().includes(q)
}

function groupedByType(exercises) {
  const groups = EXERCISE_TYPES.map((type) => ({
    type,
    items: [],
  }))
  const other = { type: 'other', items: [] }
  const index = Object.fromEntries(groups.map((group, i) => [group.type, i]))
  for (const ex of exercises) {
    const type = ex.type || 'free'
    const group = groups[index[type]] || other
    group.items.push(ex)
  }
  const named = [...groups, other].filter((group) => group.items.length)
  for (const group of named) {
    group.items.sort((a, b) => a.name.localeCompare(b.name))
  }
  return named
}

function ExerciseList({ exercises, showType = false }) {
  if (exercises.length === 0) return null
  return (
    <ul>
      {exercises.map((ex) => (
        <li key={ex.id}>
          <a href={`#/exercises/${ex.id}`}>{ex.name}</a> — {ex.equipment}
          {showType ? ` · ${typeLabel(ex.type)}` : ''}
        </li>
      ))}
    </ul>
  )
}

export function Exercises({ type = null }) {
  const store = useStore()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const all = (store.exercises || []).filter((ex) => !ex.archivedAt)
  const groups = groupedByType(all)

  if (type) {
    const group = groups.find((candidate) => candidate.type === type)
    const items = (group?.items || []).filter((ex) => matchesQuery(ex, q))
    return (
      <section>
        <Back />
        <h1>{typeLabel(type)}</h1>
        <p>
          <label>
            Search
            <br />
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </p>
        {items.length === 0 ? <p>{q ? 'No matches.' : 'None.'}</p> : null}
        <ExerciseList exercises={items} />
      </section>
    )
  }

  const hits = q
    ? all.filter((ex) => matchesQuery(ex, q)).sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <section>
      <h1>Exercises</h1>
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
      {q ? (
        <>
          {hits.length === 0 ? <p>No matches.</p> : null}
          <ExerciseList exercises={hits} showType />
        </>
      ) : groups.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.type}>
              <a href={`#/exercises/type/${group.type}`}>{typeLabel(group.type)}</a>
              {` — ${group.items.length}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function createPaths(returnBase) {
  if (returnBase) {
    return {
      hub: `${returnBase}/exercise/create`,
      pick: `${returnBase}/exercise/new`,
      manual: `${returnBase}/exercise/create/manual`,
      search: `${returnBase}/exercise/create/search`,
      afterCreate: (exerciseId) => `${returnBase}/exercise/new/${exerciseId}`,
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

export function ExerciseNew({ returnBase = null }) {
  const paths = createPaths(returnBase)
  return (
    <section>
      <Back />
      <h1>Add exercise</h1>
      <p>
        <a href={`#${paths.manual}`}>Add manually</a>
        {' · '}
        <a href={`#${paths.search}`}>Search</a>
      </p>
    </section>
  )
}

export function ExerciseNewManual({ returnBase = null }) {
  const store = useStore()
  const paths = createPaths(returnBase)
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
                  {typeLabel(t)}
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

export function ExerciseNewSearch({ returnBase = null }) {
  const store = useStore()
  const paths = createPaths(returnBase)
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load.')
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
      <h1>Search</h1>
      {error ? <p>{error}</p> : null}
      {catalog === null && !error ? <p>Loading…</p> : null}
      {catalog ? (
        <>
          <p>
            <label>
              Search
              <br />
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </p>
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
                      <a href={`#${returnBase ? paths.afterCreate(existing.id) : `/exercises/${existing.id}`}`}>
                        {returnBase ? 'Add to routine' : 'Already added'}
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
    return <Missing>Not found.</Missing>
  }

  return (
    <section>
      <Back />
      <h1>Details</h1>
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
                  {typeLabel(t)}
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
            Muscles
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
    return <Missing>Not found.</Missing>
  }

  return (
    <section>
      <Back />
      <h1>{ex.name}</h1>
      <p>
        <a href={`#/exercises/${ex.id}/edit`}>Edit</a>
      </p>
      <p>
        {[ex.equipment, typeLabel(ex.type), ex.weightStep].filter(Boolean).join(' · ')}
      </p>
      {ex.muscles ? <p>{ex.muscles}</p> : null}
      {ex.cues ? (
        <>
          <h2>Form cues</h2>
          <p>{ex.cues}</p>
        </>
      ) : null}
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete ${ex.name}?`)) return
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
