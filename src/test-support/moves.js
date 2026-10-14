// req-211 — `schedule.moves` is additive (no version bump). main's goldens and frozen
// fixtures were recorded before it, so they have no `moves`; the branch's migrateState gives
// every migrated schedule `moves: []`. This adds exactly that, and nothing else, to main's
// expected value: each `schedule` object (one with a `slots` array) gets `moves: []`. A raw
// legacy key's stored value (`workout-mvp-v8` and older, on a disk snapshot) is left as it is.
// req-225 test edit: `schedule.swaps` is additive the same way (migrateState gives every
// migrated schedule `swaps: []`), so the same schedule objects also get `swaps: []` — the
// goldens (req-164 / req-165, L-053) and frozen fixtures predate it too. Nothing else changes.
export function withEmptyMoves(value, key = null) {
  if (Array.isArray(value)) return value.map((element) => withEmptyMoves(element))
  if (!value || typeof value !== 'object') return value
  if (key && /^workout-mvp-v[0-8]$/.test(key)) return value
  const out = {}
  for (const [k, v] of Object.entries(value)) out[k] = withEmptyMoves(v, k)
  if (key === 'schedule' && Array.isArray(out.slots) && !('moves' in out)) out.moves = []
  if (key === 'schedule' && Array.isArray(out.slots) && !('swaps' in out)) out.swaps = []
  return out
}
