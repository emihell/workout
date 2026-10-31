// req-276 — split from ui/index.jsx: form fields.
import { useRef } from 'react'
import { cx } from './cx.js'

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
// req-203 §6 — × puts the focus back in the input (it was left on BODY once the button
// unmounted), so the next search is typed straight away. Focused before the clear
// re-renders, while the input is still the one in the DOM.
export function SearchField({ label = 'Search', value, onClear, className, ...rest }) {
  const box = useRef(null)
  return (
    <div className="ui-search" ref={box}>
      <Field label={label} value={value} className={cx('ui-input--clearable', className)} {...rest} />
      {value ? (
        <button
          type="button"
          className="ui-search__clear"
          aria-label="Clear search"
          onClick={(e) => {
            box.current?.querySelector('input')?.focus()
            onClear?.(e)
          }}
        >
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
