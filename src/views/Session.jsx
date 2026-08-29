import { useState } from 'react'
import { FOCUS_OPTIONS } from '../ids'
import { go } from '../route'
import { programById } from '../storage'
import { useStore } from '../store-context'
import { Back } from './shared'

function sessionPath(programId, sessionId, extra = '') {
  return `/programs/${programId}/session/${sessionId}${extra}`
}

export function SessionNew({ programId }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const [name, setName] = useState('')
  const [focus, setFocus] = useState('Machines')

  if (!program) {
    return (
      <section>
        <p>Program not found.</p>
        <Back to="/programs" />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/programs/${program.id}`} />
      <h1>Add session</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const id = store.addSession(program.id, { name, focus })
          go(sessionPath(program.id, id))
        }}
      >
        <p>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Easy run" />
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
          <button type="button" onClick={() => go(`/programs/${program.id}`)}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function SessionDetail({ programId, sessionId }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const sess = program?.sessions?.find((s) => s.id === sessionId)

  if (!program || !sess) {
    return (
      <section>
        <p>Session not found.</p>
        <Back to="/programs" />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/programs/${program.id}`} />
      <h1>{sess.name}</h1>
      <p>
        {sess.focus}
        {' · '}
        <a href={`#${sessionPath(program.id, sess.id, '/edit')}`}>Edit name and focus</a>
      </p>
      <h2>Exercises</h2>
      <p>
        <a href={`#${sessionPath(program.id, sess.id, '/exercise/new')}`}>Add exercise</a>
      </p>
      {sess.exercises.length === 0 ? <p>None yet.</p> : null}
      <ol>
        {sess.exercises.map((item, index) => {
          const ex = store.exercises.find((e) => e.id === item.exerciseId)
          return (
            <li key={item.id || `${item.exerciseId}-${index}`}>
              <a href={`#${sessionPath(program.id, sess.id, `/exercise/${item.id}`)}`}>{ex?.name || item.exerciseId}</a>
              {' — '}
              {item.role || 'main'}
              {item.restSec ? ` · ${item.restSec}s rest` : ''}
              {' '}
              <button type="button" onClick={() => store.moveSessionExercise(program.id, sess.id, index, -1)}>
                Up
              </button>{' '}
              <button type="button" onClick={() => store.moveSessionExercise(program.id, sess.id, index, 1)}>
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
            if (!window.confirm(`Delete ${sess.name}? It will leave the schedule, while completed history is preserved.`)) return
            store.removeSession(program.id, sess.id)
            go(`/programs/${program.id}`)
          }}
        >
          Delete session
        </button>
      </p>
    </section>
  )
}

export function SessionEdit({ programId, sessionId }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const sess = program?.sessions?.find((s) => s.id === sessionId)
  const [name, setName] = useState(sess?.name || '')
  const [focus, setFocus] = useState(sess?.focus || 'Machines')

  if (!program || !sess) {
    return (
      <section>
        <p>Session not found.</p>
        <Back to="/programs" />
      </section>
    )
  }

  return (
    <section>
      <Back to={sessionPath(program.id, sess.id)} />
      <h1>Name and focus</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateSession(program.id, sess.id, { name: name.trim() || sess.name, focus })
          go(sessionPath(program.id, sess.id))
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
          <button type="button" onClick={() => go(sessionPath(program.id, sess.id))}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function SessionExercisePick({ programId, sessionId }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const sess = program?.sessions?.find((s) => s.id === sessionId)
  const [query, setQuery] = useState('')

  if (!program || !sess) {
    return (
      <section>
        <p>Session not found.</p>
        <Back to="/programs" />
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
      <Back to={sessionPath(program.id, sess.id)} />
      <h1>Add exercise</h1>
      <p>Pick from the library, then set targets.</p>
      <p>
        <a href="#/exercises/new">Create exercise</a>
      </p>
      {store.exercises.length === 0 ? (
        <p>Library empty. Create an exercise first.</p>
      ) : (
        <>
          <p>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
          </p>
          {matches.length === 0 ? <p>No matches.</p> : null}
          <ul>
            {matches.map((ex) => (
              <li key={ex.id}>
                <a href={`#${sessionPath(program.id, sess.id, `/exercise/new/${ex.id}`)}`}>
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
  const [restSec, setRestSec] = useState(String(item.restSec ?? defaults.restSec))
  const [notes, setNotes] = useState(item.notes || '')
  const [warmup, setWarmup] = useState(Boolean(item.warmup))
  const [role, setRole] = useState(item.role || defaults.role || 'main')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onChange({
          role,
          restSec: Number(restSec) || 0,
          notes,
          warmup: warmup ? item.warmup || { reps: 12 } : null,
        })
      }}
    >
      <p>
        <label>
          Role
          <br />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="warmup">Warm-up</option>
            <option value="main">Main</option>
            <option value="finisher">Finisher</option>
            <option value="cardio">Cardio</option>
          </select>
        </label>
      </p>
      <p>
        <label>
          Rest (sec)
          <br />
          <input type="number" min="0" value={restSec} onChange={(e) => setRestSec(e.target.value)} />
        </label>
      </p>
      <p>
        <label>
          <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} /> Warm-up set
        </label>
      </p>
      <p>
        <label>
          Notes
          <br />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </p>
      <p>
        <button type="submit">Save</button>{' '}
        <button type="button" onClick={onCancel}>Cancel</button>
      </p>
    </form>
  )
}

export function SessionExerciseNew({ programId, sessionId, exerciseId }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const sess = program?.sessions?.find((s) => s.id === sessionId)
  const ex = store.exercises.find((e) => e.id === exerciseId)
  const defaults = {
    restSec: 90,
    role: ex?.type === 'cardio' ? 'warmup' : 'main',
  }

  if (!program || !sess || !ex) {
    return (
      <section>
        <p>Not found.</p>
        <Back to="/programs" />
      </section>
    )
  }

  return (
    <section>
      <Back to={sessionPath(program.id, sess.id, '/exercise/new')} />
      <p>{program.name} · {sess.name} · session structure</p>
      <h1>{ex.name}</h1>
      <p>Choose this exercise&apos;s role and guidance. Weights and reps are generated for each dated workout.</p>
      <ExerciseFields
        item={{ restSec: defaults.restSec, notes: '', warmup: ex.type === 'bodyweight' ? null : { reps: 12 }, role: defaults.role }}
        defaults={defaults}
        onCancel={() => go(sessionPath(program.id, sess.id, '/exercise/new'))}
        onChange={(patch) => {
          store.addSessionExercise(program.id, sess.id, { exerciseId: ex.id, ...patch })
          go(sessionPath(program.id, sess.id))
        }}
      />
    </section>
  )
}

export function SessionExerciseEdit({ programId, sessionId, itemId, backTo }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const sess = program?.sessions?.find((s) => s.id === sessionId)
  const index = sess?.exercises?.findIndex((candidate) => candidate.id === itemId)
  const item = sess?.exercises?.[index]
  const ex = store.exercises.find((e) => e.id === item?.exerciseId)
  const parent = backTo || (program && sess ? sessionPath(program.id, sess.id) : '/programs')

  if (!program || !sess || index < 0 || !item) {
    return (
      <section>
        <p>Exercise not found.</p>
        <Back to={parent} />
      </section>
    )
  }

  const defaults = {
    restSec: item.restSec || 0,
    role: item.role || 'main',
  }

  return (
    <section>
      <Back to={parent} />
      <p>{program.name} · {sess.name} · session structure</p>
      <h1>{ex?.name || item.exerciseId}</h1>
      <p>Edit this exercise&apos;s role and guidance in the reusable session. Dated plans own weights and reps.</p>
      <ExerciseFields
        key={`${sess.id}-${index}`}
        item={item}
        defaults={defaults}
        onCancel={() => go(parent)}
        onChange={(patch) => {
          store.updateSessionExercise(program.id, sess.id, index, patch)
          go(parent)
        }}
      />
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Remove ${ex?.name || 'this exercise'} from the session?`)) return
            store.removeSessionExercise(program.id, sess.id, index)
            go(parent)
          }}
        >
          Remove from session
        </button>
      </p>
    </section>
  )
}
