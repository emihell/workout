// req-178 (DEC-096 §3) — the inline "update routine" offer under a done exercise: what you
// logged vs the routine, and one confirming tap. Ignoring it changes nothing.
// req-182 — it names the exercise, says it plainly ("You lifted 32.5 kg · routine says 30 kg"),
// and after the tap shows "Saved to Day A." in place of the button (view state only: the
// offer itself is null once the routine matches, so the row remembers what it saved).
import { useState } from 'react'
import { offerText, routineUpdateOffer } from '../../routine-update-offer.js'
import { Button } from '../../ui/index.jsx'
import { exerciseName } from './workout-helpers.js'

export function RoutineUpdateOffer({ store, active, item }) {
  const [saved, setSaved] = useState(null) // { routineName, text } once tapped
  const offer = routineUpdateOffer(active, store.routines, item)
  if (!offer && !saved) return null
  return (
    <li className="ui-row">
      <span className="ui-row__stack">
        <span>{exerciseName(item)}</span>
        <span className="ui-row__meta">{saved ? saved.text : offerText(offer)}</span>
        {saved ? (
          <span role="status">Saved to {saved.routineName}.</span>
        ) : (
          <span>
            <Button
              onClick={() => {
                setSaved({ routineName: offer.routineName, text: offerText(offer) })
                store.applyRoutineUpdate(offer)
              }}
            >
              Save to {offer.routineName}
            </Button>
          </span>
        )}
      </span>
    </li>
  )
}
