import { useState } from 'react'
import { GOAL_PROFILES, normalizeGoal } from '../progress'
import { go } from '../route'
import { programById } from '../storage'
import { useStore } from '../store-context'
import { Back } from './shared'

export function Programs() {
  const store = useStore()
  const programs = store.programs.filter((program) => !program.archivedAt)

  return (
    <section>
      <h1>Programs</h1>
      <p>A program is a set of sessions. The schedule decides which day they run.</p>
      <p>
        <a href="#/programs/new">Add program</a>
      </p>
      {programs.length === 0 ? <p>None yet.</p> : null}
      <ul>
        {programs.map((p) => (
          <li key={p.id}>
            <a href={`#/programs/${p.id}`}>{p.name}</a>{' '}
            ({GOAL_PROFILES[normalizeGoal(p.goal)].label}, {p.sessions.filter((session) => !session.archivedAt).length} sessions)
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ProgramNew() {
  const store = useStore()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('gain')

  return (
    <section>
      <Back to="/programs" />
      <h1>Add program</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const id = store.createProgram({ name, goal })
          go(`/programs/${id}`)
        }}
      >
        <p>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>
        <GoalPicker value={goal} onChange={setGoal} />
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go('/programs')}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function ProgramDetail({ programId }) {
  const store = useStore()
  const program = programById(store.programs, programId)

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
      <Back to="/programs" />
      <h1>{program.name}</h1>
      <p>
        {GOAL_PROFILES[normalizeGoal(program.goal)].label}
        {' · '}
        <a href={`#/programs/${program.id}/edit`}>Edit name and goal</a>
      </p>
      <h2>Sessions</h2>
      <p>
        <a href={`#/programs/${program.id}/session/new`}>Add session</a>
      </p>
      {program.sessions.filter((session) => !session.archivedAt).length === 0 ? <p>None yet. Add a session, then put it on a day in Schedule.</p> : null}
      <ul>
        {program.sessions.filter((session) => !session.archivedAt).map((sess) => (
          <li key={sess.id}>
            <a href={`#/programs/${program.id}/session/${sess.id}`}>{sess.name}</a>{' '}
            ({sess.focus}, {sess.exercises.length} exercises)
          </li>
        ))}
      </ul>
      <p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete ${program.name}? It will be removed from the schedule, while completed history is preserved.`)) return
            store.removeProgram(program.id)
            go('/programs')
          }}
        >
          Delete program
        </button>
      </p>
    </section>
  )
}

export function ProgramEdit({ programId }) {
  const store = useStore()
  const program = programById(store.programs, programId)
  const [name, setName] = useState(program?.name || '')
  const [goal, setGoal] = useState(normalizeGoal(program?.goal))

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
      <h1>Name and goal</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          store.updateProgram(program.id, { name: name.trim() || program.name, goal })
          go(`/programs/${program.id}`)
        }}
      >
        <p>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </p>
        <GoalPicker value={goal} onChange={setGoal} />
        <p>
          <button type="submit">Save</button>{' '}
          <button type="button" onClick={() => go(`/programs/${program.id}`)}>Cancel</button>
        </p>
      </form>
    </section>
  )
}

export function GoalPicker({ value, onChange }) {
  return (
    <fieldset>
      <legend>Goal</legend>
      {Object.values(GOAL_PROFILES).map((g) => (
        <p key={g.id}>
          <label>
            <input type="radio" name="goal" checked={value === g.id} onChange={() => onChange(g.id)} /> {g.label}
            {' — '}
            {g.blurb}
          </label>
        </p>
      ))}
    </fieldset>
  )
}
