import { ExternalLink } from '../ui/index.jsx'

// req-130 / DEC-060 — RepDB's free-tier licence requires a visible credit where its
// data is used and on an about/credits screen (Settings). req-139 — Search no longer
// shows RepDB data, so the credit left Search; until req-131 brings RepDB pictures back
// it covers only exercises already added from RepDB.
export const REPDB_CREDIT = 'Exercise data by RepDB (repdb.co)'

export function RepdbCredit() {
  return (
    <p className="ui-sub">
      <ExternalLink href="https://repdb.co">{REPDB_CREDIT}</ExternalLink>
    </p>
  )
}
