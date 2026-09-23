import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchExerciseCatalog } from '../exerciseCatalog'
import { EXERCISE_TYPES } from '../ids'
import { go } from '../route'
import { useStore } from '../store-context'
import { Back, Missing } from './shared'
import { deletionConfirmHead, exerciseDeletionImpact, exerciseInActiveWorkout } from '../storage'
import { Actions, Banner, Button, Checkbox, Field, List, NavLink, NumberField, Row, Screen, SectionHeader, Select, Textarea, Title } from '../ui/index.jsx'
import { DEFAULT_DURATION_SEC } from '../model'
import { describeWeightStep } from '../weight-step.js'
import { useWeightStep, WeightStepField } from './weight-step-field.jsx'

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
        <Back to="/exercises" />
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
        <NavLink to="/exercises/new" chevron="forward">Add exercise</NavLink>
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
      <Back to={paths.pick} />
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
      <Back to={paths.hub} />
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
        <Actions
          retreat={<NavLink to={paths.hub} look="quiet">Cancel</NavLink>}
          forward={<Button type="submit" variant="primary">Save</Button>}
        />
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
      <Back to={paths.hub} />
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
                <NavLink
                  to={returnBase ? paths.afterCreate(existing.id) : `/exercises/${existing.id}`}
                  look="secondary"
                >
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

export function ExerciseEdit({ exerciseId, returnTo = null }) {
  const store = useStore()
  const ex = store.exercises.find((e) => e.id === exerciseId)
  const [name, setName] = useState(ex?.name || '')
  const [type, setType] = useState(ex?.type || 'free')
  const [equipment, setEquipment] = useState(ex?.equipment || '')
  // req-126 — defaults to empty (was an invented '2.5' for a missing field).
  const step = useWeightStep(ex?.weightStep)
  const [muscles, setMuscles] = useState(ex?.muscles || '')
  const [cues, setCues] = useState(ex?.cues || '')
  // req-85 — orthogonal timer flag + default target seconds (any type can be timed).
  const [hasDuration, setHasDuration] = useState(Boolean(ex?.hasDuration))
  const [durationSec, setDurationSec] = useState(
    ex?.durationSec != null ? String(ex.durationSec) : String(DEFAULT_DURATION_SEC),
  )

  if (!ex) {
    return <Missing>Not found.</Missing>
  }

  // req-99 — normal path returns to the exercise's own detail screen; when reached
  // via the routine editor's "Edit exercise settings" link, `returnTo` carries the
  // routine screen to land back on (Save, Cancel and Back all honour it).
  const back = returnTo || `/exercises/${ex.id}`

  return (
    <Screen>
      <Back to={back} />
      <Title>Details</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          // req-126 — a typed increment that doesn't read blocks Save (its note is shown).
          const saved = step.save()
          if (saved.error) return
          store.updateExercise(ex.id, {
            name: name.trim() || ex.name,
            type,
            equipment: equipment.trim() || 'Unknown',
            weightStep: saved.value,
            muscles: muscles.trim(),
            cues: cues.trim(),
            hasDuration,
            durationSec: hasDuration
              ? Math.max(1, Number(durationSec) || DEFAULT_DURATION_SEC)
              : ex.durationSec ?? DEFAULT_DURATION_SEC,
          })
          go(back)
        }}
      >
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select label="Type" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
        <Field label="Equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        <WeightStepField step={step} />
        <Checkbox label="Timed (count down a duration)" checked={hasDuration} onChange={setHasDuration} />
        {hasDuration ? (
          <NumberField
            label="Default duration (s)"
            min="1"
            value={durationSec}
            onChange={(e) => setDurationSec(e.target.value)}
          />
        ) : null}
        <Field label="Muscles" value={muscles} onChange={(e) => setMuscles(e.target.value)} />
        <Textarea label="Form cues" value={cues} onChange={(e) => setCues(e.target.value)} rows={3} />
        <Actions
          retreat={<NavLink to={back} look="quiet">Cancel</NavLink>}
          forward={<Button type="submit" variant="primary">Save</Button>}
        />
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
      <Back to="/exercises" />
      <Title>{ex.name}</Title>
      <p>
        <NavLink to={`/exercises/${ex.id}/edit`} chevron="forward">Edit</NavLink>
      </p>
      <p className="ui-sub">
        {[ex.equipment, typeLabel(ex.type), describeWeightStep(ex.weightStep), ex.hasDuration ? `Timed ${ex.durationSec}s` : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {ex.muscles ? <p className="ui-sub">{ex.muscles}</p> : null}
      {ex.cues ? (
        <>
          <SectionHeader>Form cues</SectionHeader>
          <p className="ui-sub">{ex.cues}</p>
        </>
      ) : null}
      <Button
        onClick={() => {
          // req-43 / DEC-031 — name the blast radius (store still archives-vs-
          // deletes on history; this only describes it). Count only when > 0.
          const impact = exerciseDeletionImpact(store, ex.id)
          const removes =
            impact.routines > 0
              ? ` This removes it from ${impact.routines} routine${impact.routines === 1 ? '' : 's'} (and any planned workouts).`
              : ''
          // req-119 / DEC-058 §5 — the live workout is a reference too (archived, named).
          const head = deletionConfirmHead(ex.name, {
            hasHistory: impact.hasHistory,
            inCurrentWorkout: exerciseInActiveWorkout(store, ex.id),
          })
          if (!window.confirm(head + removes)) return
          store.removeExercise(ex.id)
          go('/exercises')
        }}
      >
        Delete
      </Button>
    </Screen>
  )
}
