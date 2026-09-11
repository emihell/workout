import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchExerciseCatalog } from '../exerciseCatalog'
import { EXERCISE_TYPES } from '../ids'
import { go } from '../route'
import { useStore } from '../store-context'
import { Back, Missing, NavLink } from './shared'
import { Banner, Button, Field, List, Row, Screen, SectionHeader, Select, Textarea, Title } from '../ui/index.jsx'

const TYPE_LABELS = {
  machine: 'Machine',
  free: 'Free weights',
  bodyweight: 'Bodyweight',
  cardio: 'Cardio',
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type || 'Other'
}

const TYPE_OPTIONS = EXERCISE_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))

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
    <List>
      {exercises.map((ex) => (
        <Row key={ex.id} to={`/exercises/${ex.id}`}>
          {ex.name} — {ex.equipment}
          {showType ? ` · ${typeLabel(ex.type)}` : ''}
        </Row>
      ))}
    </List>
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
      <Screen>
        <Back />
        <Title>{typeLabel(type)}</Title>
        <Field label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        {items.length === 0 ? <p className="ui-sub">{q ? 'No matches.' : 'None.'}</p> : null}
        <ExerciseList exercises={items} />
      </Screen>
    )
  }

  const hits = q
    ? all.filter((ex) => matchesQuery(ex, q)).sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <Screen>
      <Title>Exercises</Title>
      <p>
        <NavLink to="/exercises/new">Add exercise</NavLink>
      </p>
      <Field label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      {q ? (
        <>
          {hits.length === 0 ? <p className="ui-sub">No matches.</p> : null}
          <ExerciseList exercises={hits} showType />
        </>
      ) : groups.length === 0 ? (
        <p className="ui-sub">None.</p>
      ) : (
        <List>
          {groups.map((group) => (
            <Row key={group.type} to={`/exercises/type/${group.type}`} value={String(group.items.length)}>
              {typeLabel(group.type)}
            </Row>
          ))}
        </List>
      )}
    </Screen>
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
    <Screen>
      <Back />
      <Title>Add exercise</Title>
      <List>
        <Row to={paths.manual}>Add manually</Row>
        <Row to={paths.search}>Search</Row>
      </List>
    </Screen>
  )
}

export function ExerciseNewManual({ returnBase = null }) {
  const store = useStore()
  const paths = createPaths(returnBase)
  const [name, setName] = useState('')
  const [type, setType] = useState('free')

  return (
    <Screen>
      <Back />
      <Title>Add exercise</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const id = store.addExercise({ name, type, equipment: '', weightStep: '', muscles: '', cues: '' })
          go(paths.afterCreate(id), { replace: true })
        }}
      >
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Type" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
        <div className="ui-actions">
          <NavLink to={paths.hub}>Cancel</NavLink>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Screen>
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
    <Screen>
      <Back />
      <Title>Search</Title>
      {error ? <Banner role="alert">{error}</Banner> : null}
      {catalog === null && !error ? <p className="ui-sub">Loading…</p> : null}
      {catalog ? (
        <>
          <Field label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query.trim().length >= 2 && hits.length === 0 ? <p className="ui-sub">No matches.</p> : null}
          <List>
            {hits.map((item) => {
              const existing = libraryNames.get(String(item.name || '').trim().toLowerCase())
              const action = existing ? (
                <NavLink to={returnBase ? paths.afterCreate(existing.id) : `/exercises/${existing.id}`}>
                  {returnBase ? 'Add to routine' : 'Already added'}
                </NavLink>
              ) : (
                <Button
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id)
                    const id = store.addExercise(catalogItemToExercise(item))
                    go(paths.afterCreate(id), { replace: true })
                  }}
                >
                  Add
                </Button>
              )
              return (
                <Row key={item.id || item.name} action={action}>
                  {item.name} — {item.equipment || 'bodyweight'}
                </Row>
              )
            })}
          </List>
        </>
      ) : null}
    </Screen>
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
    <Screen>
      <Back />
      <Title>Details</Title>
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
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Type" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
        <Field label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        <Field label="Weight step" value={weightStep} onChange={(e) => setWeightStep(e.target.value)} />
        <Field label="Muscles" value={muscles} onChange={(e) => setMuscles(e.target.value)} />
        <Textarea label="Form cues" value={cues} onChange={(e) => setCues(e.target.value)} rows={3} />
        <div className="ui-actions">
          <NavLink to={`/exercises/${ex.id}`}>Cancel</NavLink>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Screen>
  )
}

export function ExerciseDetail({ exerciseId }) {
  const store = useStore()
  const ex = store.exercises.find((e) => e.id === exerciseId)
  if (!ex) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back />
      <Title>{ex.name}</Title>
      <p>
        <NavLink to={`/exercises/${ex.id}/edit`}>Edit</NavLink>
      </p>
      <p className="ui-sub">{[ex.equipment, typeLabel(ex.type), ex.weightStep].filter(Boolean).join(' · ')}</p>
      {ex.muscles ? <p className="ui-sub">{ex.muscles}</p> : null}
      {ex.cues ? (
        <>
          <SectionHeader>Form cues</SectionHeader>
          <p className="ui-sub">{ex.cues}</p>
        </>
      ) : null}
      <Button
        onClick={() => {
          if (!window.confirm(`Delete ${ex.name}?`)) return
          store.removeExercise(ex.id)
          go('/exercises')
        }}
      >
        Delete
      </Button>
    </Screen>
  )
}
