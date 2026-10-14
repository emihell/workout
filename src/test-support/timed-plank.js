// req-221 (DEC-125 §6) — the seed's Plank (src/db.json `ex-plank`) is now timed: `hasDuration:
// true, durationSec: 60`. main's goldens and the req-165 old docs (built from db.json) were
// recorded before it, so main's expected value has the Plank untimed (`hasDuration: false`,
// default `durationSec: 30`) wherever it is copied — the exercise record and the workout
// snapshot items made from it. This changes exactly that, and nothing else: an object that is
// the Plank (`id` or `exerciseId` 'ex-plank') carrying `hasDuration: false` gets `true` / 60.
const PLANK = 'ex-plank'
export function withTimedPlank(value) {
  if (Array.isArray(value)) return value.map(withTimedPlank)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [k, v] of Object.entries(value)) out[k] = withTimedPlank(v)
  if ((out.id === PLANK || out.exerciseId === PLANK) && out.hasDuration === false) {
    out.hasDuration = true
    out.durationSec = 60
  }
  return out
}
