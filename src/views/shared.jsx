import { back } from '../route'

export function Back() {
  return (
    <p>
      <button type="button" onClick={() => back()}>
        Back
      </button>
    </p>
  )
}

// req-11 / DEC-013 — a labelled link back to the workout overview (the exercise
// menu), used on the in-exercise screens in place of a generic history "Back".
// One clear exit; "Previous" stays as the set-level undo.
export function ExercisesLink({ routineId }) {
  return (
    <p>
      <a href={`#/workout/${routineId}`}>‹ Exercises</a>
    </p>
  )
}

export function Missing({ children = 'Not found.' }) {
  return (
    <section>
      <Back />
      <p>{children}</p>
    </section>
  )
}
