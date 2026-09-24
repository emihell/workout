// req-13 / DEC-017 — the minimal, colorless, Apple-inspired component library.
//
// First iteration: as little code as possible, grayscale only, every interactive
// target ≥44px. These are bare primitives. The global shell's bottom menu lives in
// its own file (ui/BottomMenu.jsx, req-52); every other component lives here + in
// the #/components showcase until the per-screen styling pass migrates screens onto it.
//
// The one stylesheet (./ui.css) is imported once at the app root (main.jsx).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { NavLink as BaseNavLink } from '../views/shared'
import { lookClass } from '../views/nav-look.js'
import { defaultBeep, unlockAudio } from '../rest-cue.js'
import { answerConfirm, getPendingConfirm, subscribeConfirm } from './confirm.js'

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
// styled for the library (≥44px hit area, optional ‹/› chevron). Views import THIS
// one (req-122). `look`: 'link' (default, `.ui-navlink`) | 'primary' | 'secondary' |
// 'quiet' (a link wearing the Button look — it navigates, it doesn't write, DEC-040)
// | 'plain' (no library class: an in-text link). `block` = full width (button looks).
export function NavLink({ look = 'link', ...rest }) {
  return <BaseNavLink look={look} {...rest} />
}

// Actions (req-122) — a screen's row of actions (`.ui-actions`). DESIGN §4 order is
// owned here, not by each call site: `retreat` first (left), `lateral` between,
// `forward` last (right). Markup order = visual and focus order — never row-reverse.
// Each slot takes a node (a fragment for several); an empty slot renders nothing.
// `className` appends a modifier (e.g. `ui-exercise-actions`).
export function Actions({ retreat, lateral, forward, className }) {
  return (
    <div className={cx('ui-actions', className)}>
      {retreat}
      {lateral}
      {forward}
    </div>
  )
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

// The global bottom menu lives in its own file now (req-52 / DEC-036):
// ui/BottomMenu.jsx, wired into App.jsx. It replaced the old three-text-tab
// `TabBar` that used to sit here. `activeTab` (route.js) still drives which control
// is selected.

// Banner — a full-width grayscale notice strip (save-failed, error fallback).
export function Banner({ children, role = 'status' }) {
  return (
    <div role={role} className="ui-banner">
      {children}
    </div>
  )
}

// ConfirmSheet (req-24 / DEC-079) — the one in-app confirm, mounted once in App. It
// renders whatever askConfirm() (./confirm.js) has open: a bottom sheet over a dimmed
// backdrop with the message, [Cancel] left and the destructive button right (DESIGN §4
// order; ink-filled so it reads distinct, grayscale per DEC-017). Cancel is focused, so a
// stray Enter never destroys. Backdrop tap, Escape and any navigation all cancel.
export function ConfirmSheet() {
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm, getPendingConfirm)
  const cancelRef = useRef(null)
  useEffect(() => {
    if (!pending) return undefined
    cancelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') answerConfirm(false)
    }
    const onHash = () => answerConfirm(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('hashchange', onHash)
    }
  }, [pending])
  if (!pending) return null
  return (
    <div className="ui-sheet-backdrop" onClick={() => answerConfirm(false)}>
      <div
        className="ui-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ui-sheet-message"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="ui-sheet-message" className="ui-sheet__message">
          {pending.message}
        </p>
        <div className="ui-sheet__actions">
          <button ref={cancelRef} type="button" className="ui-btn ui-btn--secondary" onClick={() => answerConfirm(false)}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => answerConfirm(true)}>
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Molecules (compose the atoms) ----

// RestPill (req-78) — the rest countdown as a small floating pill, replacing the
// full-width RestBar. Since the next set's form is always live during rest (D2), rest
// never blocks input, so the pill is purely informational + dismissable: it shows the
// remaining seconds and the whole pill is a tap-target that skips the rest. No
// pause/+30s/next controls — those belonged to the blocking rest surface that's gone.
// Presentational: the real screen wires onSkip; the showcase passes a stub.
export function RestPill({ seconds = 0, onSkip }) {
  return (
    <button
      type="button"
      className="ui-restpill"
      onClick={onSkip}
      aria-label={`Rest ${seconds} seconds — tap to skip`}
    >
      <span className="ui-restpill__time">{seconds}s</span>
      <span className="ui-restpill__skip">rest · skip</span>
    </button>
  )
}

// SetLogForm — the single most important gym surface: a kg NumberField, a big reps
// field, an effort SegmentedControl, and Previous/Skip/Complete Buttons pinned to
// the absolute bottom of the screen (req-80; DESIGN §4 order: retreat left, forward
// right, the lateral Skip between).
// Presentational: it owns only the in-progress field values (local state, seeded
// from the `initial*` props), remounted per-set by the caller with a `key`. All
// the domain logic — history prefill, carry, restore, targets, the effort→RPE
// mapping — lives in the caller (the workout screen), which passes the seeds in
// and reads {weight, reps, effort} back out of onComplete.
//
// The note affordance is NOT here (req-80): "Add note" is a small control beside
// the exercise title (item.jsx), and the note value is owned by the caller and
// passed to completeSet directly — so it sits by the title, not in this field group.
//
// Props: `weighted` shows the kg field; `showEffort` shows the effort control
// (off for warm-up / cardio sets, which have no RPE); `repsLabel` is "Reps" or
// "Duration"; `effortOptions` overrides the segments; `onChange` (req-125) hears
// edits. The reps field is a full keyboard (not decimal-only) so durations like
// "30 min" can be typed.
// req-85 — the in-set count-down for a timed exercise. A SECOND, concurrent timer
// with its OWN local state (a deadline + a 250ms tick) — deliberately NOT the
// persisted restEndsAt, so starting it never touches the rest pill/cue and the two
// countdowns run independently. Start counts down from the (editable) target seconds
// and beeps once at zero (defaultBeep, fail-silent); the logged value is the target,
// not a stopwatch actual (v1). Local state resets per set because SetLogForm remounts
// by `key`.
function DurationTimer({ seconds, onSecondsChange }) {
  const [deadline, setDeadline] = useState(null)
  const [now, setNow] = useState(() => 0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (deadline == null) return undefined
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline && !firedRef.current) {
        firedRef.current = true
        defaultBeep()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])

  const running = deadline != null
  const remaining = running ? Math.max(0, Math.ceil((deadline - now) / 1000)) : Number(seconds) || 0
  const start = () => {
    unlockAudio()
    firedRef.current = false
    const secs = Math.max(1, Number(seconds) || 0)
    setNow(Date.now())
    setDeadline(Date.now() + secs * 1000)
  }
  return (
    <div className="ui-setlog__timer">
      <NumberField
        label="Duration (s)"
        min="1"
        value={seconds}
        onChange={(e) => onSecondsChange(e.target.value)}
      />
      <div className="ui-timer__count" aria-live="polite">
        {remaining}s
      </div>
      <Button variant="secondary" onClick={start}>
        {running ? 'Restart' : 'Start'}
      </Button>
    </div>
  )
}

export function SetLogForm({
  weighted = true,
  timed = false,
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
  initialDuration = 0,
  initialEffort = 3,
  canGoBack = true,
  onComplete,
  onSkip,
  onPrevious,
  onChange,
}) {
  const [weight, setWeight] = useState(initialWeight)
  const [reps, setReps] = useState(initialReps)
  const [duration, setDuration] = useState(String(initialDuration || ''))
  const [effort, setEffort] = useState(initialEffort)
  // req-125 — `onChange` (optional) hears every user edit with the form's full current
  // values, so the caller can keep a draft of the un-logged set. It fires from the edit
  // itself (not an effect), so mounting or remounting writes nothing. `durationSec` is the
  // typed seconds as entered, present only on a timed form.
  function edit(field, value) {
    const next = { weight, reps, effort, duration, [field]: value }
    if (field === 'weight') setWeight(value)
    else if (field === 'reps') setReps(value)
    else if (field === 'effort') setEffort(value)
    else setDuration(value)
    onChange?.({
      weight: next.weight,
      reps: next.reps,
      effort: next.effort,
      durationSec: timed ? next.duration : undefined,
    })
  }
  return (
    <form
      className="ui-setlog"
      onSubmit={(e) => {
        e.preventDefault()
        onComplete?.({
          weight,
          reps: timed ? '' : reps,
          effort,
          durationSec: timed ? Math.max(0, Number(duration) || 0) : undefined,
        })
      }}
    >
      <div className="ui-setlog__nums">
        {weighted ? (
          <NumberField label="kg" value={weight} onChange={(e) => edit('weight', e.target.value)} />
        ) : null}
        {timed ? (
          <DurationTimer seconds={duration} onSecondsChange={(value) => edit('duration', value)} />
        ) : (
          <Field
            label={repsLabel}
            className="ui-input--num"
            value={reps}
            onChange={(e) => edit('reps', e.target.value)}
            required
          />
        )}
      </div>
      {showEffort ? (
        <>
          <SectionHeader>Effort</SectionHeader>
          <SegmentedControl options={effortOptions} value={effort} onChange={(value) => edit('effort', value)} ariaLabel="Effort" />
        </>
      ) : null}
      {/* req-80 — pinned to the absolute bottom (thumb reach) via .ui-setlog__actions.
          DESIGN §4 order: retreat (Previous) left, forward (Complete) right, Skip
          between (it neither logs nor retreats). Markup order = visual/focus order. */}
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
