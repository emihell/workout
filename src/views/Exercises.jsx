import { useState } from 'react'
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
      <p>The library. Add movements here, then pick them when you build a session in Programs.</p>
      <p>
        <a href="#/exercises/new">Add exercise</a>
      </p>
      <p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
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

export function ExerciseNew() {
  const store = useStore()
  const [name, setName] = useState('')
  const [type, setType] = useState('free')

  return (
    <section>
      <Back to="/exercises" />
      <h1>Add exercise</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const id = store.addExercise({ name, type, equipment: '', weightStep: '', muscles: '', cues: '' })
          go(`/exercises/${id}/edit`)
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
          <button type="button" onClick={() => go('/exercises')}>Cancel</button>
        </p>
      </form>
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
        <Back to="/exercises" />
      </section>
    )
  }

  return (
    <section>
      <Back to={`/exercises/${ex.id}`} />
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
            <input value={weightStep} onChange={(e) => setWeightStep(e.target.value)} placeholder="5 or Alt 4/5 or n/a" />
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
        <Back to="/exercises" />
      </section>
    )
  }

  return (
    <section>
      <Back to="/exercises" />
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
            if (!window.confirm(`Delete ${ex.name}? It will leave active sessions, while completed history keeps its original name and sets.`)) return
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
