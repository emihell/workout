import { useState } from 'react'
import { FOCUS_OPTIONS, ROUTINE_ROLES, formatTargets, parseTargets, roleLabel } from '../ids'
import { go } from '../route'
import { routineById, historyPrescription } from '../storage'
import { useStore } from '../store-context'
import { ExerciseNew, ExerciseNewManual, ExerciseNewSearch } from './Exercises'
import { Back, Missing, NavLink } from './shared'
import { Button, Checkbox, Field, List, Row, Screen, SectionHeader, Select, Textarea, Title } from '../ui/index.jsx'

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
    <Screen>
      <Title>Routines</Title>
      <p>
        <NavLink to="/routines/new">Add routine</NavLink>
      </p>
      {routines.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {routines.map((routine) => (
          <Row key={routine.id} to={routinePath(routine.id)}>
            {routine.name} — {routine.focus}
          </Row>
        ))}
      </List>
    </Screen>
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
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Select label="Focus" options={FOCUS_OPTIONS} value={focus} onChange={(e) => setFocus(e.target.value)} />
      <div className="ui-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function RoutineNew() {
  const store = useStore()

  return (
    <Screen>
      <Back />
      <Title>Add routine</Title>
      <RoutineNewForm
        onSave={({ name, focus }) => {
          const id = store.addRoutine({ name, focus })
          go(routinePath(id))
        }}
        onCancel={() => go('/routines')}
      />
    </Screen>
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
    <Screen>
      <Back />
      <Title>{routine.name}</Title>
      <p className="ui-sub">
        {meta}
        {meta ? ' · ' : ''}
        <NavLink to={nav.edit}>Edit</NavLink>
      </p>
      <SectionHeader>Exercises</SectionHeader>
      <p>
        <NavLink to={nav.pick}>Add exercise</NavLink>
      </p>
      {routine.exercises.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {routine.exercises.map((item, index) => {
          const ex = store.exercises.find((e) => e.id === item.exerciseId)
          const kg = (item.suggestedWeights || []).some((weight) => Number(weight) > 0)
            ? ` · ${(item.suggestedWeights || []).join('/')} kg`
            : ''
          const itemMeta = `${roleLabel(item.role)}${item.warmup ? ' · WU set' : ''} · ${item.sets || 1} ${
            (item.sets || 1) === 1 ? 'set' : 'sets'
          }${kg}`
          return (
            <Row
              key={item.id || `${item.exerciseId}-${index}`}
              action={
                <>
                  <Button onClick={() => store.moveRoutineExercise(routine.id, index, -1)}>Up</Button>
                  <Button onClick={() => store.moveRoutineExercise(routine.id, index, 1)}>Down</Button>
                </>
              }
            >
              <NavLink to={nav.item(item.id)}>{ex?.name || item.exerciseId}</NavLink> — {itemMeta}
            </Row>
          )
        })}
      </List>
      <p>
        <NavLink to={nav.done}>Done</NavLink>
      </p>
      {nav.showDelete ? (
        <Button
          onClick={() => {
            if (!window.confirm(`Delete ${routine.name}?`)) return
            store.removeRoutine(routine.id)
            go(nav.done)
          }}
        >
          Delete
        </Button>
      ) : null}
    </Screen>
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
    <Screen>
      <Back />
      <Title>Name</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateRoutine(routine.id, { name: name.trim() || routine.name, focus })
          go(nav.base)
        }}
      >
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Focus" options={FOCUS_OPTIONS} value={focus} onChange={(e) => setFocus(e.target.value)} />
        <div className="ui-actions">
          <NavLink to={nav.base}>Cancel</NavLink>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Screen>
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
    <Screen>
      <Back />
      <Title>Add exercise</Title>
      <p>
        <NavLink to={nav.create}>Create exercise</NavLink>
      </p>
      {store.exercises.length === 0 ? (
        <p className="ui-sub">None.</p>
      ) : (
        <>
          <Field label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          {matches.length === 0 ? <p className="ui-sub">No matches.</p> : null}
          <List>
            {matches.map((ex) => (
              <Row key={ex.id} to={nav.newItem(ex.id)}>
                {ex.name} — {ex.equipment}
              </Row>
            ))}
          </List>
        </>
      )}
    </Screen>
  )
}

function ExerciseFields({ item, onChange, onCancel, defaults }) {
  const [role, setRole] = useState(item.role || defaults.role || 'main')
  const [warmup, setWarmup] = useState(Boolean(item.warmup))
  // req-30 — warmup reps come only from what the user typed (or a saved value when
  // editing): blank for a new warmup, never a default. See the submit below and DESIGN §1.
  const [warmupReps, setWarmupReps] = useState(() => {
    const value = item.warmup?.reps
    return value == null || value === '' ? '' : String(value)
  })
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
          warmup: warmup ? { reps: warmupReps } : null,
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
      <Select label="Role" options={ROUTINE_ROLES} value={role} onChange={(e) => setRole(e.target.value)} />
      <Checkbox label="WU set" checked={warmup} onChange={setWarmup} />
      {warmup ? (
        <Field
          label="Warmup reps"
          type="number"
          min="1"
          value={warmupReps}
          onChange={(e) => setWarmupReps(e.target.value)}
        />
      ) : null}
      <Field label="Sets" type="number" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
      <Field label="Reps" value={targets} onChange={(e) => setTargets(e.target.value)} />
      <Field label="Kg" value={weights} onChange={(e) => setWeights(e.target.value)} />
      <Field label="Rest (s)" type="number" min="0" value={restSec} onChange={(e) => setRestSec(e.target.value)} />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
      <div className="ui-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
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
    <Screen>
      <Back />
      <p className="ui-sub">{routine.name}</p>
      <Title>{ex.name}</Title>
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
    </Screen>
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
    <Screen>
      <Back />
      <p className="ui-sub">{routine.name}</p>
      <Title>{ex?.name || item.exerciseId}</Title>
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
      <Button
        onClick={() => {
          if (!window.confirm(`Remove ${ex?.name || 'this exercise'}?`)) return
          store.removeRoutineExercise(routine.id, index)
          go(parent)
        }}
      >
        Remove
      </Button>
    </Screen>
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
