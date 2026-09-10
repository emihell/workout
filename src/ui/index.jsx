// req-13 / DEC-017 — the minimal, colorless, Apple-inspired component library.
//
// First iteration: as little code as possible, grayscale only, every interactive
// target ≥44px. These are bare primitives. Only the NavBar is wired into the app
// (the global shell); every other component lives here + in the #/components
// showcase until the per-screen styling pass migrates screens onto it.
//
// The one stylesheet (./ui.css) is imported once at the app root (main.jsx).
import { useEffect, useRef, useState } from 'react'
import { NavLink as BaseNavLink } from '../views/shared'

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
export function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div className="ui-seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
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

export function Title({ children }) {
  return <h1 className="ui-title">{children}</h1>
}

export function SectionHeader({ children }) {
  return <h2 className="ui-section">{children}</h2>
}

// List + Row — Apple grouped list: hairline dividers between rows, ≥44px height.
// A row with `to` is a navigable link (trailing › chevron); otherwise a plain
// row with optional right-aligned `value`.
export function List({ children }) {
  return <ul className="ui-list">{children}</ul>
}

export function Row({ children, value, to }) {
  if (to) {
    return (
      <li className="ui-row">
        <NavLink to={to} className="ui-row__link">
          <span>{children}</span>
          <span className="ui-row__chev">›</span>
        </NavLink>
      </li>
    )
  }
  return (
    <li className="ui-row">
      <span>{children}</span>
      {value != null ? <span className="ui-row__value">{value}</span> : null}
    </li>
  )
}

// NavBar — the global shell (Emilio 2026-09-10, supersedes DEC-018). The bar is
// just a Menu trigger; ALL six nav items live in the menu (nothing shown outside
// it). The menu closes when an item is clicked (the <ul> onClick) and when the
// user clicks outside it (a document mousedown outside the <nav>). This is the ONE
// component wired into App.jsx.
const NAV_ITEMS = [
  { to: '/', label: 'Today' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/routines', label: 'Routines' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
]

export function NavBar() {
  const [open, setOpen] = useState(false)
  const navRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <nav ref={navRef}>
      <div className="ui-navbar">
        <Button variant="quiet" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Menu
        </Button>
      </div>
      {open ? (
        <ul className="ui-navbar__menu" onClick={() => setOpen(false)}>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to}>{item.label}</NavLink>
            </li>
          ))}
        </ul>
      ) : null}
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
// field, an effort SegmentedControl, a note, and Complete/Skip/Previous Buttons.
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
      <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="ui-setlog__actions">
        <Button type="submit" variant="primary">
          Complete
        </Button>
        <Button onClick={onSkip}>Skip</Button>
        {canGoBack ? <Button variant="quiet" onClick={onPrevious}>Previous</Button> : null}
      </div>
    </form>
  )
}
