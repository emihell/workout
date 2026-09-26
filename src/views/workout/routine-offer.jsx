// req-178 (DEC-096 §3) — the inline "update routine" offer under a done exercise: what you
// logged vs the routine, and one confirming tap. Ignoring it changes nothing.
import { kgListText, routineUpdateOffer } from '../../routine-update-offer.js'
import { Button } from '../../ui/index.jsx'

export function RoutineUpdateOffer({ store, active, item }) {
  const offer = routineUpdateOffer(active, store.routines, item)
  if (!offer) return null
  return (
    <li className="ui-row">
      <span className="ui-row__stack">
        <span className="ui-row__meta">
          You did {kgListText(offer.to)} kg. Routine: {kgListText(offer.from) || '—'}.
        </span>
        <span>
          <Button onClick={() => store.applyRoutineUpdate(offer)}>Update {offer.routineName}</Button>
        </span>
      </span>
    </li>
  )
}
