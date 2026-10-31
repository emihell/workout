// req-276 — split from ui/index.jsx: an exercise's head, rest notes and set list.
import { cx } from './cx.js'
import { Title } from './layout.jsx'

// ExerciseHead (req-212, H5) — an exercise screen's head: the Title (a node: the name, or a
// link to the exercise) with an optional small control beside it (`aside`, e.g. "Add note"),
// and an optional caption line under it (`subtitle`). Was ad-hoc markup in item.jsx.
export function ExerciseHead({ title, aside = null, subtitle = '' }) {
  return (
    <>
      <div className="ui-exercise-head">
        <Title>{title}</Title>
        {aside ? <div className="ui-exercise-head__aside">{aside}</div> : null}
      </div>
      {subtitle ? <p className="ui-sub">{subtitle}</p> : null}
    </>
  )
}

// RestNotes (req-217, DEC-119 §6) — a quiet block under the set list while the exercise's rest
// runs: the routine's note for it (`note`), then a few form cues (`cues`, strings). Read-only.
// Renders nothing when both are empty.
export function RestNotes({ note = '', cues = [] }) {
  const list = (cues || []).filter(Boolean)
  if (!note && !list.length) return null
  return (
    <section className="ui-restnotes" aria-label="While you rest">
      {note ? <p className="ui-restnotes__note">{note}</p> : null}
      {list.length ? (
        <ul className="ui-restnotes__cues">
          {list.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

// SetList (req-212, H5; was item.jsx's ad-hoc `ui-setpreview` list, req-106 / req-186) — one
// small line per set of an exercise. `rows`: [{ key, status: 'done' | 'current' | 'upcoming',
// text, highlighted }]. A done row is a button when `onOpen` is given (onOpen(row) — the
// caller opens that logged set); current / upcoming rows are plain text. The row on screen
// (`highlighted`) is set apart by fill and weight and marked aria-current.
export function SetList({ rows, onOpen, label = 'Sets' }) {
  return (
    <ul className="ui-setpreview" aria-label={label}>
      {(rows || []).map((row) => (
        <li
          key={row.key}
          className={cx('ui-setpreview__row', `is-${row.status}`, row.highlighted && 'is-here')}
          aria-current={row.highlighted ? 'step' : undefined}
        >
          {row.status === 'done' && onOpen ? (
            <button type="button" className="ui-setpreview__tap" onClick={() => onOpen(row)}>
              <span className="ui-setpreview__mark" aria-hidden="true">✓</span>
              <span className="ui-visually-hidden">Done: </span>
              {row.text}
            </button>
          ) : (
            <>
              <span className="ui-setpreview__mark" aria-hidden="true">
                {row.status === 'done' ? '✓' : ''}
              </span>
              {row.text}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
