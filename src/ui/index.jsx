// req-13 / DEC-017 — the minimal, colorless, Apple-inspired component library.
//
// First iteration: as little code as possible, grayscale only, every interactive
// target ≥44px. These are bare primitives. The global shell's bottom menu lives in
// its own file (ui/BottomMenu.jsx, req-52); every other component lives here + in
// the #/components showcase until the per-screen styling pass migrates screens onto it.
//
// The one stylesheet (./ui.css) is imported once at the app root (main.jsx).
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { NavLink as BaseNavLink } from '../views/shared'
import { defaultBeep, unlockAudio } from '../rest-cue.js'
import { answerConfirm, getPendingConfirm, navigationCancels, subscribeConfirm } from './confirm.js'
import { kgError, readKg } from '../kg-input.js'
import { kgHints } from '../kg-hints.js'
import { readSeconds, secondsToSave } from '../seconds-input.js'

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
// fill/weight (grayscale). Covers effort on set edit (Easy/Medium/Hard/Failure) and feel.
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
// req-189 — `selectOnFocus`: focusing the box selects its content, so the first keystroke
// replaces the value ("12" into "10" reads 12, not 1012). The mouseup right after a click-focus
// would collapse that selection to a caret in some browsers, so that one mouseup is ignored.
export function Field({ label, className, selectOnFocus = false, onFocus, onMouseUp, onBlur, ...rest }) {
  const fresh = useRef(false)
  const handlers = selectOnFocus
    ? {
        onFocus: (e) => {
          onFocus?.(e)
          e.target.select()
          fresh.current = true
        },
        onMouseUp: (e) => {
          onMouseUp?.(e)
          if (fresh.current) e.preventDefault()
          fresh.current = false
        },
        onBlur: (e) => {
          onBlur?.(e)
          fresh.current = false
        },
      }
    : { onFocus, onMouseUp, onBlur }
  return (
    <label className="ui-field">
      {label ? <span className="ui-field__label">{label}</span> : null}
      <input className={cx('ui-input', className)} {...rest} {...handlers} />
    </label>
  )
}

// req-191 §7 — a search Field with a clear (×) button while it holds text. The button sits
// outside the <label> (a button inside a label would also focus the input), over the input's
// right end; the input keeps room for it. `onClear` empties the query.
export function SearchField({ label = 'Search', value, onClear, className, ...rest }) {
  return (
    <div className="ui-search">
      <Field label={label} value={value} className={cx('ui-input--clearable', className)} {...rest} />
      {value ? (
        <button type="button" className="ui-search__clear" aria-label="Clear search" onClick={onClear}>
          ×
        </button>
      ) : null}
    </div>
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
// req-187 — optional bold title, a custom cancel label, and `stayOn` (a navigation to that
// path does not cancel). The routine-kg sheet uses all three.
export function ConfirmSheet() {
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm, getPendingConfirm)
  const cancelRef = useRef(null)
  useEffect(() => {
    if (!pending) return undefined
    cancelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') answerConfirm(false)
    }
    // req-187 — a sheet opened with `stayOn` survives the navigation to that screen.
    const onHash = () => {
      if (navigationCancels(pending, window.location.hash)) answerConfirm(false)
    }
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
        aria-labelledby={pending.title ? 'ui-sheet-title' : 'ui-sheet-message'}
        aria-describedby={pending.title && pending.message ? 'ui-sheet-message' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {pending.title ? (
          <p id="ui-sheet-title" className="ui-sheet__title">
            {pending.title}
          </p>
        ) : null}
        {pending.message ? (
          <p id="ui-sheet-message" className="ui-sheet__message">
            {pending.message}
          </p>
        ) : null}
        {/* req-188 — askChoice: one button per choice, stacked, above Cancel. */}
        {pending.choices ? (
          <div className="ui-sheet__choices">
            {pending.choices.map((choice) => (
              <button key={choice.value} type="button" className="ui-btn ui-btn--secondary ui-btn--block" onClick={() => answerConfirm(choice.value)}>
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ui-sheet__actions">
          <button ref={cancelRef} type="button" className="ui-btn ui-btn--secondary" onClick={() => answerConfirm(false)}>
            {pending.cancelLabel || 'Cancel'}
          </button>
          {pending.choices ? null : (
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => answerConfirm(true)}>
              {pending.confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Molecules (compose the atoms) ----

// WorkoutPill (req-186, DEC-103 §3; was RestPill, req-78) — one floating pill for the
// whole workout. Resting: the rest clock + "set N/M"; rest over (or none armed): "GO" +
// "set N/M", set apart by .ui-restpill--go (a pulse; static under reduced motion). The
// whole pill is one tap-target that opens the current exercise — it no longer skips the
// rest (that moved to "Skip rest" on the exercise screen). Presentational: the real
// screen wires onOpen; the showcase passes a stub.
// req-192 (DEC-108 §3) — `skip`: resting, on the current exercise's own log screen, a tap
// skips the rest; the pill then reads "1:12 · skip" in place of the set count.
export function WorkoutPill({ clock = null, setText = '', go = false, skip = false, onOpen }) {
  const lead = go ? 'GO' : clock
  const label = skip
    ? `Rest ${clock} — skip the rest`
    : `${go ? 'Go' : `Rest ${clock}`}, ${setText} — open the exercise`
  return (
    <button
      type="button"
      className={cx('ui-restpill', go && 'ui-restpill--go')}
      onClick={onOpen}
      aria-label={label}
    >
      <span className="ui-restpill__time">{lead}</span>
      <span className="ui-restpill__sep" aria-hidden="true">
        ·
      </span>
      <span className="ui-restpill__set">{skip ? 'skip' : setText}</span>
    </button>
  )
}

// SetLogForm — the single most important gym surface: a kg NumberField, a big reps
// field, and a bar pinned to the absolute bottom of the screen (req-80): a quiet
// Previous · Skip set row over four effort buttons that LOG the set (req-192,
// DEC-108 §1: Easy · Medium · Hard · Failure → onComplete with that effort), or one
// "Done" where effort isn't shown.
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
// "Duration"; `effortOptions` overrides the effort buttons; `onChange` (req-125) hears
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
  // req-155 — the typed seconds read like the saved value (`30,5` → 31); unreadable shows 0.
  const typed = readSeconds(seconds).value ?? 0
  const remaining = running ? Math.max(0, Math.ceil((deadline - now) / 1000)) : typed
  const start = () => {
    unlockAudio()
    firedRef.current = false
    const secs = Math.max(1, typed)
    setNow(Date.now())
    setDeadline(Date.now() + secs * 1000)
  }
  return (
    <div className="ui-setlog__timer">
      <NumberField
        label="Duration (s)"
        min="1"
        selectOnFocus
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
    { value: 3, label: 'Medium' },
    { value: 4, label: 'Hard' },
    { value: 5, label: 'Failure' },
  ],
  initialWeight = '',
  initialReps = '',
  initialDuration = 0,
  // req-192 — read only while `viewing` (the logged set's effort, shown selected). The current
  // set has no preselected effort: tapping an effort button IS the answer (DEC-108 §1).
  initialEffort = '',
  routineKg,
  lastKg = '',
  // req-189 — "kg per dumbbell" on a dumbbell exercise (kg-label.js); the caller decides.
  kgLabel = 'kg',
  canGoBack = true,
  onComplete,
  onSkip,
  onPrevious,
  onChange,
  // req-186 (DEC-103 §4) — `viewing`: the form shows a set already logged (Previous). The
  // bar becomes Previous (if `canGoBack`) · Next (secondary → onNext); once a field is
  // changed the forward button is Save (primary, submits → onComplete with the values).
  viewing = false,
  onNext,
}) {
  const [weight, setWeight] = useState(initialWeight)
  const [reps, setReps] = useState(initialReps)
  const [duration, setDuration] = useState(String(initialDuration || ''))
  const [effort, setEffort] = useState(initialEffort)
  // req-154 — set by Complete when the kg can't be read (`abc`, `2,5,5`); cleared by the
  // next kg edit. `22,5` is a number (DEC-058 §1) and never lands here.
  const [weightError, setWeightError] = useState(null)
  // req-155 — the same for a timed set's Duration (`30,5` is 31 s; `abc` is refused).
  const [durationError, setDurationError] = useState(null)
  // req-189 — Reps blank on Complete: an inline "Enter reps" (no browser bubble — the box is no
  // longer `required`); cleared by the next reps edit. Nothing is prefilled (DESIGN §1).
  const [repsError, setRepsError] = useState(null)
  // req-125 — `onChange` (optional) hears every user edit with the form's full current
  // values, so the caller can keep a draft of the un-logged set. It fires from the edit
  // itself (not an effect), so mounting or remounting writes nothing. `durationSec` is the
  // typed seconds as entered, present only on a timed form.
  // req-186 — any edit while `viewing` a logged set turns Next into Save.
  const [edited, setEdited] = useState(false)
  const captionId = useId()
  function edit(field, value) {
    const next = { weight, reps, effort, duration, [field]: value }
    setEdited(true)
    if (field === 'weight') {
      setWeight(value)
      setWeightError(null)
    } else if (field === 'reps') {
      setReps(value)
      setRepsError(null)
    }
    else if (field === 'effort') setEffort(value)
    else {
      setDuration(value)
      setDurationError(null)
    }
    onChange?.({
      weight: next.weight,
      reps: next.reps,
      effort: next.effort,
      durationSec: timed ? next.duration : undefined,
    })
  }
  const hints = kgHints({ weighted, kg: weight, routineKg, lastKg })
  // req-192 — the one logging path: validation (kg error, "Enter reps", duration) first, then
  // onComplete. `chosen` is the effort button tapped (current set), the selected effort (Save on
  // a viewed set), or null where effort isn't shown ("Done").
  function submit(chosen) {
    // req-189 — what `required` blocked before, the same cases (a non-timed set, blank box).
    const missingReps = !timed && String(reps ?? '').trim() === '' ? `Enter ${repsLabel.toLowerCase()}` : null
    const error = weighted ? kgError(weight) : null
    // req-155 — a blank Duration logs 0 s, as before; unreadable text logs nothing.
    const seconds = timed ? secondsToSave(duration, 0) : null
    if (error || seconds?.error || missingReps) {
      setWeightError(error)
      setRepsError(missingReps)
      setDurationError(seconds?.error ?? null)
      return
    }
    onComplete?.({
      weight,
      reps: timed ? '' : reps,
      // req-156 (audit F-TRUST-2) — a hidden Effort (warm-up / cardio) is not an answer:
      // null. req-192 — otherwise the effort button tapped (or, viewing, the one selected).
      effort: showEffort ? chosen : null,
      durationSec: timed ? seconds.value : undefined,
    })
  }
  return (
    <form
      className="ui-setlog"
      onSubmit={(e) => {
        e.preventDefault()
        // req-186 — viewing a logged set with nothing changed: the forward action is Next.
        if (viewing && !edited) {
          onNext?.()
          return
        }
        // req-192 (DEC-108 §1) — the current set with effort shown is logged only by tapping an
        // effort button: Enter in a field has no effort to log with, so it logs nothing.
        if (!viewing && showEffort) return
        submit(showEffort ? effort : null)
      }}
    >
      <div className="ui-setlog__nums">
        {weighted ? (
          <NumberField label={kgLabel} selectOnFocus value={weight} onChange={(e) => edit('weight', e.target.value)} />
        ) : null}
        {timed ? (
          <DurationTimer seconds={duration} onSecondsChange={(value) => edit('duration', value)} />
        ) : (
          <Field
            label={repsLabel}
            className="ui-input--num"
            selectOnFocus
            value={reps}
            onChange={(e) => edit('reps', e.target.value)}
          />
        )}
      </div>
      {repsError ? (
        <p className="ui-field-error" role="alert">
          {repsError}
        </p>
      ) : null}
      {/* req-173 (DEC-093) — a weighted set with an empty kg box says so, quietly. Not a
          block or a confirm: Complete still logs it in one tap, as 0 (set-values.js
          liveSetWeight), exactly as before. Never a default weight (DESIGN core rule). */}
      {/* req-183 (DEC-102) — beside it, two more quiet notes (kg-hints.js): the last-time kg
          when the routine has none here (named, never put in the box), and a big-change
          note on a > 50% jump. Neither blocks Complete. */}
      {weighted && readKg(weight).empty ? (
        <p className="ui-field-note">
          {hints.lastTime != null ? `No weight entered · last time ${hints.lastTime} kg` : 'No weight entered'}
        </p>
      ) : hints.lastTime != null ? (
        <p className="ui-field-note">Last time: {hints.lastTime} kg</p>
      ) : null}
      {hints.bigJumpFrom != null ? (
        <p className="ui-field-note">That&apos;s a big change from {hints.bigJumpFrom} kg</p>
      ) : null}
      {weightError ? (
        <p className="ui-field-error" role="alert">
          {weightError}
        </p>
      ) : null}
      {durationError ? (
        <p className="ui-field-error" role="alert">
          {durationError}
        </p>
      ) : null}
      {/* req-80 — pinned to the absolute bottom (thumb reach) via .ui-setlog__actions.
          req-192 (DEC-108 §1) — two tiers. Top, a quiet row: Previous (retreat, left) and Skip
          set (lateral) — or, viewing a logged set, Previous · Next / Save as req-186. Bottom: the
          set is LOGGED by tapping its effort, Easy · Medium · Hard · Failure (real buttons, a
          caption so they read as actions, nothing preselected); a set without effort (warm-up,
          cardio) gets one "Done". Viewing, the effort buttons select (the logged one shown
          selected) and Save commits. Markup order = visual/focus order (DESIGN §4). */}
      <div className="ui-setlog__actions">
        <div className="ui-setlog__nav">
          {canGoBack ? <Button variant="quiet" onClick={onPrevious}>Previous</Button> : null}
          {viewing ? (
            edited ? (
              <Button type="submit" variant="primary">
                Save
              </Button>
            ) : (
              <Button variant="secondary" onClick={onNext}>
                Next
              </Button>
            )
          ) : (
            /* req-188 — the screen's only Skip: this set (Skip exercise is on the list). */
            <Button variant="quiet" onClick={onSkip}>Skip set</Button>
          )}
        </div>
        {showEffort ? (
          <>
            <p className="ui-setlog__caption" id={captionId}>
              {viewing ? 'Effort' : 'Log set \u2014 how did it feel?'}
            </p>
            <div className="ui-effort" role="group" aria-labelledby={captionId}>
              {effortOptions.map((opt) => {
                const selected = viewing && String(opt.value) === String(effort)
                return (
                  <Button
                    key={opt.value}
                    variant={selected ? 'primary' : 'secondary'}
                    className={cx('ui-effort__btn', selected && 'is-selected')}
                    aria-pressed={viewing ? selected : undefined}
                    onClick={() => (viewing ? edit('effort', opt.value) : submit(opt.value))}
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </div>
          </>
        ) : viewing ? null : (
          <Button type="submit" variant="primary" block className="ui-setlog__done">
            Done
          </Button>
        )}
      </div>
    </form>
  )
}
