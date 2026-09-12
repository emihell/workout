// req-13 / DEC-017 — the minimal, colorless, Apple-inspired component library.
//
// First iteration: as little code as possible, grayscale only, every interactive
// target ≥44px. These are bare primitives. Only the TabBar is wired into the app
// (the global shell, req-14); every other component lives here + in the #/components
// showcase until the per-screen styling pass migrates screens onto it.
//
// The one stylesheet (./ui.css) is imported once at the app root (main.jsx).
import { useState } from 'react'
import { NavLink as BaseNavLink } from '../views/shared'
import { activeTab, useHashRoute } from '../route'

const cx = (...parts) => parts.filter(Boolean).join(' ')

// ---- Controls ----

// Button — action / submit. Variant by weight, not color: primary (solid ink) /
// secondary (light fill) / quiet (text only). `block` = full-width (mobile).
export function Button({ variant = 'secondary', block = false, type = 'button', className, children, ...rest }) {
  return (
    <button
      type={type}
      className={cx('ui-btn', `ui-btn--${variant}`, block && 'ui-btn--block', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

// NavLink — the single nav-link primitive (src/views/shared.jsx, DEC-016),
// styled for the library (≥44px hit area, optional ‹/› chevron).
export function NavLink({ className, ...rest }) {
  return <BaseNavLink className={cx('ui-navlink', className)} {...rest} />
}

// SegmentedControl — radio group as equal-width segments; selected set apart by
// fill/weight (grayscale). Covers effort (Easy/Moderate/Hard/Failure) and feel.
// `clearable` prepends a leading "none" segment (`—`, value `''`) that resets the
// control to empty — the idiom three call sites used to hand-roll. Off by default,
// so non-clearable controls are unchanged. The `—` label / `''` value are the
// convention; picking it fires onChange('').
export function SegmentedControl({ options, value, onChange, ariaLabel, clearable }) {
  const segments = clearable ? [{ value: '', label: '—' }, ...options] : options
  return (
    <div className="ui-seg" role="radiogroup" aria-label={ariaLabel}>
      {segments.map((opt) => {
        const optValue = typeof opt === 'object' ? opt.value : opt
        const optLabel = typeof opt === 'object' ? opt.label : opt
        const selected = String(optValue) === String(value)
        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx('ui-seg__item', selected && 'is-selected')}
            onClick={() => onChange?.(optValue)}
          >
            {optLabel}
          </button>
        )
      })}
    </div>
  )
}

// Checkbox — large label + box, ≥44px row.
export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="ui-check">
      <input
        type="checkbox"
        className="ui-check__box"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
    </label>
  )
}

// FileButton — a file input that looks like a Button (raw <input> hidden).
export function FileButton({ label = 'Import', accept, onFiles, variant = 'secondary' }) {
  return (
    <label className={cx('ui-btn', `ui-btn--${variant}`)}>
      {label}
      <input
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          onFiles?.(e.target.files)
          e.target.value = '' // allow re-selecting the same file (re-fires change)
        }}
      />
    </label>
  )
}

// ---- Inputs ----

// Field — labeled text input: caption label above, ≥44px input.
export function Field({ label, className, ...rest }) {
  return (
    <label className="ui-field">
      {label ? <span className="ui-field__label">{label}</span> : null}
      <input className={cx('ui-input', className)} {...rest} />
    </label>
  )
}

// NumberField — like Field but large, gym-legible digits + numeric keypad.
export function NumberField({ label, ...rest }) {
  return <Field label={label} className="ui-input--num" inputMode="decimal" {...rest} />
}

// Textarea — the note field; taller.
export function Textarea({ label, rows = 3, ...rest }) {
  return (
    <label className="ui-field">
      {label ? <span className="ui-field__label">{label}</span> : null}
      <textarea className="ui-input ui-input--area" rows={rows} {...rest} />
    </label>
  )
}

// Select — a native <select> styled to match Field, with a grayscale caret and a
// ≥44px hit area. `options` is a list of strings or { value, label }. A native
// select (not a SegmentedControl) because these lists (focus, type, weeks) have
// more options than fit a row on mobile. Passes value/defaultValue/name through.
export function Select({ label, options, className, ...rest }) {
  return (
    <label className="ui-field">
      {label ? <span className="ui-field__label">{label}</span> : null}
      <select className={cx('ui-input', 'ui-select', className)} {...rest}>
        {options.map((opt) => {
          const value = typeof opt === 'object' ? opt.value : opt
          const text = typeof opt === 'object' ? opt.label : opt
          return (
            <option key={value} value={value}>
              {text}
            </option>
          )
        })}
      </select>
    </label>
  )
}

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
// `children … value action`. `action` is a plain-row affordance (link rows have
// no caller that needs it); multiple controls in one `action` are laid out with
// a consistent gap.
export function List({ children }) {
  return <ul className="ui-list">{children}</ul>
}

export function Row({ children, value, action, to }) {
  if (to) {
    return (
      <li className="ui-row">
        <NavLink to={to} className="ui-row__link">
          <span className="ui-row__label">{children}</span>
          {value != null ? <span className="ui-row__value">{value}</span> : null}
          <span className="ui-row__chev">›</span>
        </NavLink>
      </li>
    )
  }
  return (
    <li className="ui-row">
      <span>{children}</span>
      {value != null ? <span className="ui-row__value">{value}</span> : null}
      {action != null ? <span className="ui-row__action">{action}</span> : null}
    </li>
  )
}

// TabBar — the global shell (req-14 / DEC-024, supersedes the req-13 Menu). A
// fixed bottom bar of three equal tabs — Workouts / Library / Settings — the
// app's primary navigation on mobile. Each tab wears the component-library Button
// LOOK via the `ui-btn ui-btn--{variant}` classes (Emilio's review: no custom
// icons) but is a NavLink/<a> — pure route nav, honouring DEC-016 (buttons are
// for actions, links for navigation). The variant is a STATIC emphasis hierarchy
// — Workouts primary, Library secondary, Settings quiet — that never changes. On
// TOP of that, the CURRENT tab is marked dynamically from activeTab(route.name):
// aria-current="page" + an `.is-active` underline that reads on every variant
// (currentColor, so white on the ink primary, ink on the others). So a tab shows
// both its fixed emphasis AND whether it's the screen you're on. The bar is fixed
// to the viewport bottom and honours the iOS home-indicator safe area; content
// clears it via the bottom padding on <main> (ui.css .ui-main). This is the ONE
// navigation component wired into App.jsx.
//
// Hidden during the in-workout flow (route names starting with `workout`): the
// in-gym screens are focused single-task surfaces and a persistent nav bar that
// could jump you to Library mid-set fights them (DESIGN: in-gym flow flawless).
// activeTab still maps those routes to Workouts for completeness/tests.
const TABS = [
  { id: 'workouts', to: '/', label: 'Workout', variant: 'primary' },
  { id: 'library', to: '/routines', label: 'Library', variant: 'secondary' },
  { id: 'settings', to: '/settings', label: 'Settings', variant: 'quiet' },
]

export function TabBar() {
  const route = useHashRoute()
  if (String(route.name).startsWith('workout')) return null
  const current = activeTab(route.name)
  return (
    <nav className="ui-tabbar" aria-label="Primary">
      {TABS.map(({ id, to, label, variant }) => {
        const selected = current === id
        return (
          <BaseNavLink
            key={id}
            to={to}
            className={cx('ui-btn', `ui-btn--${variant}`, 'ui-tabbar__tab', selected && 'is-active')}
            aria-current={selected ? 'page' : undefined}
          >
            {label}
          </BaseNavLink>
        )
      })}
    </nav>
  )
}

// Banner — a full-width grayscale notice strip (save-failed, error fallback).
export function Banner({ children, role = 'status' }) {
  return (
    <div role={role} className="ui-banner">
      {children}
    </div>
  )
}

// ---- Molecules (compose the atoms) ----

// RestBar — the rest countdown (Emilio 2026-09-10): a big remaining-time number on
// its own full-width line, then a row of exactly three equal-width buttons —
// [Pause/Resume] [+30s] [Next] — with Next the primary button, rightmost.
// Presentational: the real screen wires the handlers; the showcase passes stubs.
export function RestBar({ seconds = 0, paused = false, onPauseResume, onAddTime, onNext }) {
  return (
    <div className="ui-restbar" role="status">
      <div className="ui-restbar__time">{seconds}s</div>
      <div className="ui-restbar__actions">
        <Button onClick={onPauseResume}>{paused ? 'Resume' : 'Pause'}</Button>
        <Button onClick={onAddTime}>+30s</Button>
        <Button variant="primary" onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}

// SetLogForm — the single most important gym surface: a kg NumberField, a big reps
// field, an effort SegmentedControl, a note, and Previous/Skip/Complete Buttons
// (DESIGN §4 order: retreat left, forward right).
// Presentational: it owns only the in-progress field values (local state, seeded
// from the `initial*` props), remounted per-set by the caller with a `key`. All
// the domain logic — history prefill, carry, restore, targets, the effort→RPE
// mapping — lives in the caller (the workout screen), which passes the seeds in
// and reads {weight, reps, effort, note} back out of onComplete.
//
// Props: `weighted` shows the kg field; `showEffort` shows the effort control
// (off for warm-up / cardio sets, which have no RPE); `repsLabel` is "Reps" or
// "Duration"; `effortOptions` overrides the segments. The reps field is a full
// keyboard (not decimal-only) so durations like "30 min" can be typed.
export function SetLogForm({
  weighted = true,
  showEffort = true,
  repsLabel = 'Reps',
  effortOptions = [
    { value: 2, label: 'Easy' },
    { value: 3, label: 'Moderate' },
    { value: 4, label: 'Hard' },
    { value: 5, label: 'Failure' },
  ],
  initialWeight = '',
  initialReps = '',
  initialEffort = 3,
  initialNote = '',
  canGoBack = true,
  onComplete,
  onSkip,
  onPrevious,
}) {
  const [weight, setWeight] = useState(initialWeight)
  const [reps, setReps] = useState(initialReps)
  const [effort, setEffort] = useState(initialEffort)
  const [note, setNote] = useState(initialNote)
  // req-26 — the note is hidden behind an "Add note" affordance to declutter the
  // mid-set screen. Start expanded only when a note already exists (a restored /
  // seeded note), so it is never lost; otherwise show the button. The submitted
  // value is unchanged — `note` stays '' until the field is opened and typed in.
  const [showNote, setShowNote] = useState(Boolean(initialNote))
  return (
    <form
      className="ui-setlog"
      onSubmit={(e) => {
        e.preventDefault()
        onComplete?.({ weight, reps, effort, note })
      }}
    >
      <div className="ui-setlog__nums">
        {weighted ? (
          <NumberField label="kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
        ) : null}
        <Field
          label={repsLabel}
          className="ui-input--num"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          required
        />
      </div>
      {showEffort ? (
        <>
          <SectionHeader>Effort</SectionHeader>
          <SegmentedControl options={effortOptions} value={effort} onChange={setEffort} ariaLabel="Effort" />
        </>
      ) : null}
      {showNote ? (
        // autoFocus only when revealed by tapping (initialNote empty at mount);
        // a pre-existing note starts expanded but does not grab focus / the keyboard.
        <Field
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus={!initialNote}
        />
      ) : (
        <Button variant="quiet" onClick={() => setShowNote(true)}>
          Add note
        </Button>
      )}
      {/* DESIGN §4 order: retreat (Previous) left, forward (Complete) right, Skip
          between (it neither logs nor retreats). */}
      <div className="ui-setlog__actions">
        {canGoBack ? <Button variant="quiet" onClick={onPrevious}>Previous</Button> : null}
        <Button onClick={onSkip}>Skip</Button>
        <Button type="submit" variant="primary">
          Complete
        </Button>
      </div>
    </form>
  )
}
