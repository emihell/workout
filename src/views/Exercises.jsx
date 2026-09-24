import { useEffect, useState } from 'react'
import { catalogItemToExercise, loadExerciseCatalog, searchCommonFirst, shownName } from '../exerciseCatalog'
import { EXERCISE_TYPES } from '../ids'
import { go } from '../route'
import { useStore } from '../store-context'
import { Back, Missing } from './shared'
import { deletionConfirmHead, exerciseDeletionImpact, exerciseInActiveWorkout } from '../storage'
import { Actions, Banner, Button, Checkbox, Field, List, NavLink, NumberField, Row, Screen, SectionHeader, Select, Textarea, Title } from '../ui/index.jsx'
import { DEFAULT_DURATION_SEC } from '../model'
import { describeWeightStep } from '../weight-step.js'
import { useWeightStep, WeightStepField } from './weight-step-field.jsx'
import { exerciseNameMatch, libraryItemMatch, nameError, pickedExercisePath } from '../exercise-names.js'
import { askConfirm } from '../ui/confirm.js'

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

// req-127 — an inline field error under its input (the Routine.jsx / req-118 markup).
function NameError({ children }) {
  return children ? (
    <p className="ui-field-error" role="alert">
      {children}
    </p>
  ) : null
}

export function ExerciseNewManual({ returnBase = null }) {
  const store = useStore()
  const paths = createPaths(returnBase)
  const [name, setName] = useState('')
  const [type, setType] = useState('free')
  // req-127 — the name error shows after the first Save attempt, then tracks each edit.
  const [tried, setTried] = useState(false)
  // req-127 / DEC-059 §3–4 — the name match found on Save ({ kind, exercise }), shown in
  // place of Save until the name changes. Live → Use it / Create anyway; archived →
  // Restore / Create anyway.
  const [match, setMatch] = useState(null)
  const error = tried ? nameError(name) : null
  const create = () => {
    const id = store.addExercise({ name, type, equipment: '', weightStep: '', muscles: '', cues: '' })
    go(paths.afterCreate(id), { replace: true })
  }

  return (
    <Screen>
      <Back to={paths.hub} />
      <Title>Add exercise</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (nameError(name)) return
          const found = exerciseNameMatch(store.exercises, name)
          if (found) setMatch(found)
          else create()
        }}
      >
        <Field
          label="Name"
          value={name}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setName(e.target.value)
            setMatch(null)
          }}
        />
        <NameError>{error}</NameError>
        <Select label="Type" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
        {match ? (
          <NameMatch match={match} paths={paths} returnBase={returnBase} store={store} onCreate={create} />
        ) : (
          <Actions
            retreat={<NavLink to={paths.hub} look="quiet">Cancel</NavLink>}
            forward={<Button type="submit" variant="primary">Save</Button>}
          />
        )}
      </form>
    </Screen>
  )
}

// req-127 / DEC-059 §3–4 — the duplicate warning (live match) or the Restore offer
// (archived match, same id). Labels and sides (unconfirmed).
function NameMatch({ match, paths, returnBase, store, onCreate }) {
  const { exercise } = match
  const createAnyway = (
    <Button variant="secondary" onClick={onCreate}>
      Create anyway
    </Button>
  )
  // Live match: Use it only navigates (DEC-040: a link, which req-122 keeps out of
  // `forward`), so it sits left and the commit, Create anyway, right.
  if (match.kind === 'live') {
    return (
      <>
        <p className="ui-sub" role="status">An exercise called {exercise.name} already exists.</p>
        <Actions
          retreat={
            <NavLink to={pickedExercisePath(paths, returnBase, exercise.id)} look="secondary">
              Use it
            </NavLink>
          }
          forward={createAnyway}
        />
      </>
    )
  }
  return (
    <>
      <p className="ui-sub" role="status">
        An exercise called {exercise.name} was deleted. Restore brings it back with its history.
      </p>
      <Actions
        retreat={createAnyway}
        forward={
          <Button
            variant="primary"
            onClick={() => {
              store.restoreExercise(exercise.id)
              go(pickedExercisePath(paths, returnBase, exercise.id), { replace: true })
            }}
          >
            Restore
          </Button>
        }
      />
    </>
  )
}

export function ExerciseNewSearch({ returnBase = null }) {
  const store = useStore()
  const paths = createPaths(returnBase)
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  // req-139 — "Show N more from the full library"; reset on every query change.
  const [showRest, setShowRest] = useState(false)

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

  // req-139 / DEC-064 §3 — common hits first, the rest of the library on request; with
  // no common hit the rest shows directly (never a dead end).
  // req-143 — hidden entries are skipped, except ones already in store.exercises.
  const found = catalog ? searchCommonFirst(catalog, query, 25, { exercises: store.exercises }) : { common: [], rest: [], restCount: 0 }
  const restDirect = found.common.length === 0
  const hits = restDirect || showRest ? [...found.common, ...found.rest] : found.common

  return (
    <Screen>
      <Back to={paths.hub} />
      <Title>Search</Title>
      {error ? <Banner role="alert">{error}</Banner> : null}
      {catalog === null && !error ? <p className="ui-sub">Loading…</p> : null}
      {catalog ? (
        <>
          <Field
            label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowRest(false)
            }}
          />
          {query.trim().length >= 2 && hits.length === 0 ? <p className="ui-sub">No matches.</p> : null}
          <List>
            {hits.map((item) => {
              // req-127 — live wins, else the newest archived one is offered for Restore
              // (same id, DEC-059 §3). req-139 — matched by libraryId, then display name,
              // then free-db name.
              const match = libraryItemMatch(store.exercises, item)
              const action = match?.kind === 'live' ? (
                <NavLink to={pickedExercisePath(paths, returnBase, match.exercise.id)} look="secondary">
                  {returnBase ? 'Add to routine' : 'Already added'}
                </NavLink>
              ) : match?.kind === 'archived' ? (
                <Button
                  onClick={() => {
                    store.restoreExercise(match.exercise.id)
                    go(pickedExercisePath(paths, returnBase, match.exercise.id), { replace: true })
                  }}
                >
                  Restore
                </Button>
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
                  {shownName(item)} — {item.equipment || 'bodyweight'}
                </Row>
              )
            })}
          </List>
          {!restDirect && !showRest && found.restCount > 0 ? (
            <Button variant="quiet" block onClick={() => setShowRest(true)}>
              Show {found.restCount} more from the full library
            </Button>
          ) : null}
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
  // req-127 — the name error shows after the first Save attempt, then tracks each edit.
  const [tried, setTried] = useState(false)
  const editNameError = tried ? nameError(name) : null
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
          // req-127 — an empty name is an inline error that blocks Save (was: kept the old name).
          setTried(true)
          const saved = step.save()
          if (saved.error || nameError(name)) return
          store.updateExercise(ex.id, {
            name: name.trim(),
            type,
            equipment: equipment.trim() || 'Unknown',
            // req-126 — untouched: the key is left out, so the stored value (or its absence) stays.
            ...(saved.unchanged ? {} : { weightStep: saved.value }),
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
        <Field label="Name" value={name} aria-invalid={Boolean(editNameError)} onChange={(e) => setName(e.target.value)} />
        <NameError>{editNameError}</NameError>
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
        onClick={async () => {
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
          if (!(await askConfirm(head + removes, { confirmLabel: 'Delete' }))) return
          store.removeExercise(ex.id)
          go('/exercises')
        }}
      >
        Delete
      </Button>
    </Screen>
  )
}
