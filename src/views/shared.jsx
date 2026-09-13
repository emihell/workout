import { toHash } from '../route'

// req-12 / DEC-016 — the one nav-link primitive. Pure route navigation ("go to
// another screen", no state change) is an <a href>, not a <button>; <button> is
// reserved for actions and submits. `to` is a route path (e.g. '/schedule' or
// `/history/${id}`); toHash turns it into the hash the router reads.
//
// req-13 added optional `className` (so the ui library can style it) and
// `chevron` ('back' → leading ‹, 'forward' → trailing ›). Both default off, so
// every existing call (`<NavLink to>label</NavLink>`) is unchanged.
// req-14 forwards any remaining props (`...rest`) onto the <a> — the TabBar needs
// `aria-current="page"` on the active tab. Additive: existing callers pass none.
export function NavLink({ to, children, className, chevron, ...rest }) {
  return (
    <a href={toHash(to)} className={className || undefined} {...rest}>
      {chevron === 'back' ? '‹ ' : null}
      {children}
      {chevron === 'forward' ? ' ›' : null}
    </a>
  )
}

// req-49 — Back returns to the screen's logical PARENT (the `to` prop), never the
// last-visited screen. Each call site passes its parent per the route hierarchy;
// `to` defaults to Today ('/') for the one caller that can't know a parent
// (`Missing`).
//
// req-62 — Back IS navigation, so per DEC-016 it's the NavLink primitive (an
// <a href>), not a button — the same `‹`-chevron link treatment as `ExercisesLink`
// and the counterpart of the forward `›` nav links. One component, so every Back
// site reads as navigation consistently.
export function Back({ to = '/' }) {
  return (
    <p>
      <NavLink to={to} className="ui-navlink" chevron="back">Back</NavLink>
    </p>
  )
}

// req-11 / DEC-013 — a labelled link back to the workout overview (the exercise
// menu), used on the in-exercise screens in place of a generic history "Back".
// One clear exit; "Previous" stays as the set-level undo. Now built on NavLink
// (req-12) so there is a single nav-link primitive.
export function ExercisesLink({ routineId }) {
  return (
    <p>
      <NavLink to={`/workout/${routineId}`} className="ui-navlink">‹ Exercises</NavLink>
    </p>
  )
}

export function Missing({ children = 'Not found.' }) {
  return (
    <section className="ui-screen">
      <Back to="/" />
      <p className="ui-sub">{children}</p>
    </section>
  )
}
