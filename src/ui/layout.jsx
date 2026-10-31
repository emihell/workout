// req-276 — split from ui/index.jsx: screen layout.
import { cx } from './cx.js'
import { NavLink } from './controls.jsx'

// ---- Structure ----

// Screen — the page container: mobile-first, side padding, centered max-width.
export function Screen({ className, children }) {
  return <section className={cx('ui-screen', className)}>{children}</section>
}

// Title + optional bound caption. `subtitle` renders the same `.ui-sub` markup
// screens used to hand-write under the title; empty/null renders just the <h1>,
// byte-identical to a bare Title. Standalone `.ui-sub` (empty-state captions,
// multi-line meta not bound to a title) stays a raw <p className="ui-sub">.
export function Title({ children, subtitle }) {
  return (
    <>
      <h1 className="ui-title">{children}</h1>
      {subtitle != null && subtitle !== '' ? <p className="ui-sub">{subtitle}</p> : null}
    </>
  )
}

export function SectionHeader({ children }) {
  return <h2 className="ui-section">{children}</h2>
}

// List + Row — Apple grouped list: hairline dividers between rows, ≥44px height.
// A row with `to` is a navigable link (trailing › chevron); either kind may
// carry a right-aligned informational `value` (on a link it sits before the
// chevron). A plain row may also carry a trailing `action` node (a control —
// e.g. a <Button>) in its own slot; when both are present they render in order
// `children … value action`. On a link row (req-188) `action` sits after the link, outside
// it (its own tap target); multiple controls in one `action` are laid out with
// a consistent gap.
export function List({ children }) {
  return <ul className="ui-list">{children}</ul>
}

// `className` is an optional modifier appended to the row's own class (e.g.
// req-79's `ui-row--done` to mute a completed exercise). Default '' leaves every
// existing caller's `ui-row` untouched.
export function Row({ children, value, action, to, className = '' }) {
  const rowClass = `ui-row${className ? ` ${className}` : ''}`
  if (to) {
    return (
      <li className={rowClass}>
        <NavLink to={to} className="ui-row__link">
          <span className="ui-row__label">{children}</span>
          {value != null ? <span className="ui-row__value">{value}</span> : null}
          <span className="ui-row__chev">›</span>
        </NavLink>
        {/* req-188 — a link row may carry a trailing control (the workout list's "⋯"): its
            own tap target beside the link, never inside it. */}
        {action != null ? <span className="ui-row__action">{action}</span> : null}
      </li>
    )
  }
  return (
    <li className={rowClass}>
      <span>{children}</span>
      {value != null ? <span className="ui-row__value">{value}</span> : null}
      {action != null ? <span className="ui-row__action">{action}</span> : null}
    </li>
  )
}

// req-198 (DEC-112) — the global bottom menu (req-52 / DEC-036) is gone (its file was
// deleted in req-202): Home is the hub, and a deep screen's Back row carries a "Today" link
// (views/shared.jsx Back).

// Banner — a full-width grayscale notice strip (save-failed, error fallback).
export function Banner({ children, role = 'status' }) {
  return (
    <div role={role} className="ui-banner">
      {children}
    </div>
  )
}
