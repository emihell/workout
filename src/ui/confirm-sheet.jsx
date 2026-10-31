// req-276 — split from ui/index.jsx: the confirm sheet.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { answerConfirm, getPendingConfirm, navigationCancels, subscribeConfirm } from './confirm.js'

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
              // req-220 review round 1 — `destructive: true` wears the confirm's destructive look;
              // req-264 — `primary: true` wears the same filled look (the highlighted choice).
              <button
                key={choice.value}
                type="button"
                className={`ui-btn ${choice.destructive || choice.primary ? 'ui-btn--primary' : 'ui-btn--secondary'} ui-btn--block`}
                onClick={() => answerConfirm(choice.value)}
              >
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
