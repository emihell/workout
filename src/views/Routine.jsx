import { useState } from 'react'
import { routineItemMeta } from '../ids'
import { parseRoutineItem } from '../routine-item-parse'
import { perSetCount, perSetStart, perSetText, perSetValues, savedRole } from '../routine-form.js'
import { go } from '../route'
import { exerciseById, routineById } from '../model.js'
import { historyPrescription } from '../history-queries.js'
import { deletionConfirmHead, routineDeletionImpact, routineInActiveWorkout } from '../state-reducers.js'
import { useStore } from '../store-context'
import { startOrContinue } from '../workout-actions'
import { nameError, routineStartable } from '../exercise-names.js'
import { ExerciseNew, ExerciseNewManual, ExerciseNewSearch } from './Exercises'
import { Back, Missing } from './shared'
import { Actions, Button, Checkbox, Field, List, NavLink, Row, Screen, SectionHeader, Textarea, Title } from '../ui/index.jsx'
import { askConfirm } from '../ui/confirm.js'
import { navForBase } from './routine-nav.js'

function routinePath(routineId, extra = '') {
  return `/routines/${routineId}${extra}`
}

// req-99 — link from the routine per-exercise editor to the exercise's OWN Details
// editor (where the Timed flag lives), carrying `?from=` so Save/Cancel/Back return
// to `returnPath` — the exact routine screen the user came from, in any of the flows
// that reuse ExerciseFields (routine / schedule slot / workout setup / history recalc).
function exerciseSettingsLink(exerciseId, returnPath) {
  return `/exercises/${exerciseId}/edit?from=${encodeURIComponent(returnPath)}`
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
        <NavLink to="/routines/new" chevron="forward">Add routine</NavLink>
      </p>
      {routines.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {routines.map((routine) => (
          // req-56 — each row carries two actions. Edit is navigation to the
          // routine detail/manage screen, so per DEC-016 it's a link (styled as a
          // button, like the tab-bar links / Back); Start is a state change, so a
          // <Button>. DESIGN §4: retreat/secondary (Edit) left, primary (Start)
          // right. Start reuses the req-55 one-in-progress / abandon-on-new path.
          <Row
            key={routine.id}
            action={
              <>
                <NavLink to={routinePath(routine.id)} look="secondary">
                  Edit
                </NavLink>
                {/* req-127 — no Start on an empty routine (it made an empty workout), as in the preview. */}
                {routineStartable(routine) ? (
                  <Button variant="secondary" onClick={() => startOrContinue(store, routine.id)}>
                    Start
                  </Button>
                ) : null}
              </>
            }
          >
            {routine.name}
          </Row>
        ))}
      </List>
    </Screen>
  )
}

// req-121 — Cancel only navigates, so it's a NavLink to `cancelTo` (DEC-040), not a
// Button calling go(); callers pass the path instead of an onCancel handler.
export function RoutineNewForm({ onSave, cancelTo, submitLabel = 'Next' }) {
  const [name, setName] = useState('')
  // req-127 — trimmed; empty is an inline error that blocks Save (after the first try).
  const [tried, setTried] = useState(false)
  const error = tried ? nameError(name) : null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (nameError(name)) return
        onSave({ name: name.trim() })
      }}
    >
      <Field label="Name" value={name} aria-invalid={Boolean(error)} onChange={(e) => setName(e.target.value)} />
      {error ? <FieldError>{error}</FieldError> : null}
      <Actions
        retreat={<NavLink to={cancelTo} look="secondary">Cancel</NavLink>}
        forward={<Button type="submit" variant="primary">{submitLabel}</Button>}
      />
    </form>
  )
}

export function RoutineNew() {
  const store = useStore()

  return (
    <Screen>
      <Back to="/routines" />
      <Title>Add routine</Title>
      <RoutineNewForm
        onSave={({ name }) => {
          const id = store.addRoutine({ name })
          go(routinePath(id))
        }}
        cancelTo="/routines"
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

  const meta = nav.extra || ''

  return (
    <Screen>
      <Back to={nav.done} />
      <Title>{routine.name}</Title>
      <p className="ui-sub">
        {meta}
        {meta ? ' · ' : ''}
        <NavLink to={nav.edit} chevron="forward">Edit</NavLink>
      </p>
      <SectionHeader>Exercises</SectionHeader>
      <p>
        <NavLink to={nav.pick} chevron="forward">Add exercise</NavLink>
      </p>
      {routine.exercises.length === 0 ? <p className="ui-sub">None.</p> : null}
      <List>
        {routine.exercises.map((item, index) => {
          const ex = exerciseById(store.exercises, item.exerciseId)
          return (
            <Row
              key={item.id || `${item.exerciseId}-${index}`}
              action={
                <>
                  {/* req-127 — edge moves did nothing; now disabled. */}
                  <Button disabled={index === 0} onClick={() => store.moveRoutineExercise(routine.id, index, -1)}>
                    Up
                  </Button>
                  <Button
                    disabled={index === routine.exercises.length - 1}
                    onClick={() => store.moveRoutineExercise(routine.id, index, 1)}
                  >
                    Down
                  </Button>
                </>
              }
            >
              {/* req-103 — two lines: name (link to the item editor), then a muted meta line. */}
              <span className="ui-row__stack">
                <NavLink to={nav.item(item.id)}>{ex?.name || item.exerciseId}</NavLink>
                <span className="ui-row__meta">{routineItemMeta(item)}</span>
              </span>
            </Row>
          )
        })}
      </List>
      {nav.showDelete ? (
        <Button
          onClick={async () => {
            // req-43 / DEC-031 — name the blast radius (store still archives-vs-
            // deletes on history; this only describes it). Counts only when > 0.
            const impact = routineDeletionImpact(store, routine.id)
            const parts = []
            if (impact.slots > 0)
              parts.push(`${impact.slots} schedule slot${impact.slots === 1 ? '' : 's'}`)
            const removes = parts.length ? ` This removes ${parts.join(' and ')}.` : ''
            // req-119 / DEC-058 §5 — the live workout is a reference too (archived, named).
            // req-169 (DEC-089) — and a legacy unfinished (draft) workout, worded as such.
            const head = deletionConfirmHead(routine.name, {
              hasHistory: impact.hasHistory,
              inDraft: impact.inDraft,
              inCurrentWorkout: routineInActiveWorkout(store, routine.id),
            })
            if (!(await askConfirm(head + removes, { confirmLabel: 'Delete' }))) return
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
  // req-127 — empty name blocks Save with an inline error (was: kept the old name).
  const [tried, setTried] = useState(false)
  const error = tried ? nameError(name) : null

  if (!routine) {
    return <Missing>Not found.</Missing>
  }

  return (
    <Screen>
      <Back to={nav.base} />
      <Title>Name</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (nameError(name)) return
          // req-179 — name only: a stored `focus` is left as it is (unread, DEC-099 §1).
          store.updateRoutine(routine.id, { name: name.trim() })
          go(nav.base)
        }}
      >
        <Field label="Name" value={name} aria-invalid={Boolean(error)} onChange={(e) => setName(e.target.value)} />
        {error ? <FieldError>{error}</FieldError> : null}
        <Actions
          retreat={<NavLink to={nav.base} look="quiet">Cancel</NavLink>}
          forward={<Button type="submit" variant="primary">Save</Button>}
        />
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
      <Back to={nav.base} />
      <Title>Add exercise</Title>
      <p>
        <NavLink to={nav.create} chevron="forward">Create exercise</NavLink>
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

// req-118 — an inline field error under its input. Grayscale like the rest of the UI
// (DESIGN): weight and a leading marker carry it, not colour.
function FieldError({ children }) {
  return (
    <p className="ui-field-error" role="alert">
      {children}
    </p>
  )
}

// req-179 (DEC-099 §4) — one value for every set, or, behind "Different … per set",
// one field per set ("Set 1" … count). The value goes to routine-item-parse.js as the
// same slash text as before (routine-form.js), so its errors keep their Set N positions.
// Layout (req-179 QA): the group label, then its switch, then the field(s), in a
// fieldset spaced apart from the next group, so a switch never reads as the next label's.
function PerSetField({ label, switchLabel, state, onState, count, error, inputMode }) {
  const values = perSetValues(state.perSet, count)
  return (
    <fieldset className="ui-per-set">
      <legend className="ui-field__label">{label}</legend>
      {count > 1 || state.different ? (
        <Checkbox
          label={switchLabel}
          checked={state.different}
          onChange={(on) =>
            // On: every set starts as the one value. Off: Set 1's value applies to all.
            onState(
              on
                ? { ...state, different: true, perSet: Array.from({ length: count }, () => state.single) }
                : { ...state, different: false, single: values[0] ?? '' },
            )
          }
        />
      ) : null}
      {state.different ? (
        values.map((value, i) => (
          <Field
            key={i}
            label={`Set ${i + 1}`}
            inputMode={inputMode}
            value={value}
            aria-invalid={Boolean(error && error.position === i + 1)}
            onChange={(e) => {
              const next = [...values]
              next[i] = e.target.value
              onState({ ...state, perSet: next })
            }}
          />
        ))
      ) : (
        <Field
          aria-label={label}
          inputMode={inputMode}
          value={state.single}
          aria-invalid={Boolean(error)}
          onChange={(e) => onState({ ...state, single: e.target.value })}
        />
      )}
      {error ? <FieldError>{error.message}</FieldError> : null}
    </fieldset>
  )
}

// req-121 — `cancelTo` (a path) replaces onCancel: Cancel is a NavLink (DEC-040).
function ExerciseFields({ item, onChange, cancelTo, defaults, timed = false, settingsLink = null }) {
  // req-179 (DEC-099 §2) — Role is one switch. Off saves 'main', except a stored
  // finisher/cardio is kept (savedRole) — no silent rewrite of what the form can't show.
  const storedRole = item.role || defaults.role || 'main'
  const [warmupExercise, setWarmupExercise] = useState(storedRole === 'warmup')
  // req-179 (DEC-099 §3) — a warm-up set is no longer offered. One that exists is kept
  // byte-for-byte (DEC-022: never re-invent its reps) unless unticked; it can't be re-added.
  const [keepWarmup, setKeepWarmup] = useState(Boolean(item.warmup))
  const [sets, setSets] = useState(() => {
    const value = item.sets ?? defaults.sets
    return value == null || value === '' ? '' : String(value)
  })
  const [targets, setTargets] = useState(() => perSetStart(item.targets || defaults.targets || []))
  const [weights, setWeights] = useState(() => perSetStart(item.suggestedWeights || defaults.suggestedWeights || []))
  const [restSec, setRestSec] = useState(() => {
    const value = item.restSec ?? defaults.restSec
    return value == null || value === '' ? '' : String(value)
  })
  const [notes, setNotes] = useState(item.notes || '')
  // req-85 — per-set target seconds for a timed exercise, stored parallel to targets.
  // Only shown when the exercise is timed.
  const [durations, setDurations] = useState(() => perSetStart(item.durations || []))
  const longest = Math.max(targets.perSet.length, weights.perSet.length, timed ? durations.perSet.length : 0)
  const count = perSetCount(sets, longest)
  // req-118 — errors appear after the first Save attempt and then track each edit, so a
  // fixed field clears its message at once. Parsing is routine-item-parse.js (pure, tested).
  const [tried, setTried] = useState(false)
  const parsed = parseRoutineItem({
    sets,
    reps: perSetText(targets, count),
    kg: perSetText(weights, count),
    duration: perSetText(durations, count),
    timed,
  })
  const errors = tried ? parsed.errors : {}
  const errorText = (field) => (errors[field] ? <FieldError>{errors[field].message}</FieldError> : null)
  const warmupReps = item.warmup?.reps
  const hasWarmupReps = warmupReps != null && warmupReps !== ''

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (Object.keys(parsed.errors).length) return
        const { value } = parsed
        onChange({
          role: savedRole(storedRole, warmupExercise),
          warmup: keepWarmup && item.warmup ? item.warmup : null,
          sets: value.sets,
          targets: value.targets,
          suggestedWeights: value.suggestedWeights,
          durations: timed ? value.durations : item.durations || [],
          restSec: Math.max(0, Number(restSec) || 0),
          notes,
        })
      }}
    >
      <Checkbox label="Warm-up exercise" checked={warmupExercise} onChange={setWarmupExercise} />
      {item.warmup ? (
        <Checkbox
          label={`Keep warm-up set${hasWarmupReps ? ` (${warmupReps} reps)` : ''}`}
          checked={keepWarmup}
          onChange={setKeepWarmup}
        />
      ) : null}
      <Field label="Sets" type="number" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
      {errorText('sets')}
      <PerSetField
        label="Reps"
        switchLabel="Different reps per set"
        state={targets}
        onState={setTargets}
        count={count}
        error={errors.reps}
      />
      {/* req-118 — decimal keypad: `,` is Kg's decimal point (DEC-058 §1). */}
      <PerSetField
        label="Kg"
        switchLabel="Different kg per set"
        state={weights}
        onState={setWeights}
        count={count}
        error={errors.kg}
        inputMode="decimal"
      />
      {timed ? (
        <PerSetField
          label="Duration (s)"
          switchLabel="Different duration per set"
          state={durations}
          onState={setDurations}
          count={count}
          error={errors.duration}
        />
      ) : (
        // req-99 — Timed lives on the exercise, not the routine row. When the exercise
        // isn't timed there's no Duration field, so signpost where the flag actually is
        // instead of leaving a dead end. No second checkbox here (would fork the truth).
        <p className="ui-sub">Not timed. Edit exercise settings to add a duration.</p>
      )}
      {settingsLink ? (
        <p>
          <NavLink to={settingsLink} chevron="forward">Edit exercise settings</NavLink>
        </p>
      ) : null}
      <Field label="Rest (seconds)" type="number" min="0" value={restSec} onChange={(e) => setRestSec(e.target.value)} />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
      <Actions
        retreat={<NavLink to={cancelTo} look="secondary">Cancel</NavLink>}
        forward={<Button type="submit" variant="primary">Save</Button>}
      />
    </form>
  )
}

export function RoutineExerciseNew({ routineId, exerciseId, paths }) {
  const store = useStore()
  const routine = routineById(store.routines, routineId)
  const nav = pathsFor(routineId, paths)
  const ex = exerciseById(store.exercises, exerciseId)
  const history = historyPrescription(store.workouts, ex?.id)
  const defaults = {
    // req-179 — every new item starts as Main, cardio included (DEC-099 §2).
    role: 'main',
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
      <Back to={nav.pick} />
      <p className="ui-sub">{routine.name}</p>
      <Title>{ex.name}</Title>
      <ExerciseFields
        item={{
          role: defaults.role,
          notes: history?.notes || '',
          // req-179 — a warm-up set is no longer offered, nor copied from history.
          warmup: null,
          restSec: defaults.restSec,
          sets: defaults.sets,
          targets: defaults.targets,
          suggestedWeights: defaults.suggestedWeights,
        }}
        defaults={defaults}
        timed={Boolean(ex?.hasDuration)}
        settingsLink={exerciseSettingsLink(ex.id, nav.newItem(ex.id))}
        cancelTo={nav.pick}
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
  const ex = exerciseById(store.exercises, item?.exerciseId)
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
      <Back to={parent} />
      <p className="ui-sub">{routine.name}</p>
      <Title>{ex?.name || item.exerciseId}</Title>
      <ExerciseFields
        key={`${routine.id}-${index}`}
        item={item}
        defaults={defaults}
        timed={Boolean(ex?.hasDuration)}
        settingsLink={exerciseSettingsLink(item.exerciseId, nav.item(itemId))}
        cancelTo={parent}
        onChange={(patch) => {
          store.updateRoutineExercise(routine.id, index, patch)
          go(parent)
        }}
      />
      <Button
        onClick={async () => {
          if (!(await askConfirm(`Remove ${ex?.name || 'this exercise'}?`, { confirmLabel: 'Remove' }))) return
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
