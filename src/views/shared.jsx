import { showsTodayLink, toHash, useHashRoute } from '../route'
import { lookClass } from './nav-look.js'

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
//
// req-122 — `look` picks the library treatment so no caller hand-writes classes:
// 'link' → `.ui-navlink` (the text link); 'primary' | 'secondary' | 'quiet' → the
// DEC-040 button look (`ui-btn ui-btn--<look>`, plus `ui-btn--block` with `block`).
// No look (or 'plain') adds no class — the bare base the bottom menu and the in-text
// exercise-title link build on. Views import the library NavLink (ui/index.jsx),
// which defaults `look` to 'link'; this base is its building block and stays here so
// shared.jsx keeps no ui/ import (ui/index.jsx imports from here — one-way). The
// look → class mapping is ./nav-look.js (plain JS, unit-tested).
export function NavLink({ to, children, className, chevron, look, block = false, ...rest }) {
  const classes = [lookClass(look, block), className].filter(Boolean).join(' ')
  return (
    <a href={toHash(to)} className={classes || undefined} {...rest}>
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
//
// req-198 (DEC-112) — with no bottom bar, a deep screen's Back row also carries "Today"
// (right-aligned, link look) so Home is one tap away. Shown only where Back doesn't
// already go home and never in the in-workout flow (showsTodayLink, route.js).
export function Back({ to = '/' }) {
  const route = useHashRoute()
  const today = showsTodayLink(to, route.name)
  return (
    <p className={today ? 'ui-back-row' : undefined}>
      <NavLink to={to} look="link" chevron="back">Back</NavLink>
      {today ? (
        <NavLink to="/" look="link">
          Today
        </NavLink>
      ) : null}
    </p>
  )
}

// req-11 / DEC-013 — a labelled link back to the workout overview (the exercise
// menu), used on the in-exercise screens in place of a generic history "Back".
// One clear exit; "Previous" stays as the set-level undo. Now built on NavLink
// (req-12) so there is a single nav-link primitive. req-122: the ‹ is
// `chevron="back"` (it was typed into the label), the same as Back.
export function ExercisesLink({ routineId }) {
  return (
    <p>
      <NavLink to={`/workout/${routineId}`} look="link" chevron="back">Exercises</NavLink>
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
