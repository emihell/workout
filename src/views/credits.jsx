import { ExternalLink } from '../ui/index.jsx'

// req-130 / DEC-060 — RepDB's free-tier licence requires a visible credit where its
// data is used (Search) and on an about/credits screen (Settings).
export const REPDB_CREDIT = 'Exercise data by RepDB (repdb.co)'

export function RepdbCredit() {
  return (
    <p className="ui-sub">
      <ExternalLink href="https://repdb.co">{REPDB_CREDIT}</ExternalLink>
    </p>
  )
}
