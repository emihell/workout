// req-276 — split from ui/index.jsx: controls.
import { NavLink as BaseNavLink } from '../views/shared'
import { cx } from './cx.js'

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
// `clearable` (req-221, DEC-125 §1): no extra segment. Nothing picked → no segment
// selected; tapping the SELECTED segment again fires onChange('') (cleared); tapping
// another picks it. Off by default, so non-clearable controls are unchanged (a tap on
// the selected one re-fires its own value, as before).
export function SegmentedControl({ options, value, onChange, ariaLabel, clearable }) {
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
            onClick={() => onChange?.(clearable && selected ? '' : optValue)}
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
