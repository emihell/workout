// req-109 (review loop-back) — which snapshot item a history row belongs to. `key` is a
// set group's routineItemId (or, on the per-exercise route, possibly an exerciseId).
// Match by item id FIRST; fall back to the exerciseId only when no item has that id.
// The old single `find(id || exerciseId)` took the first hit, so with a mid-workout
// replacement of exercise C sitting before the routine's own C item, the routine
// item's row resolved to the replacement (its role / WU tag). Pure and JSX-free so
// `node --test` can import it; no imports on purpose.
export function snapshotItemFor(items, key, exerciseId = key) {
  const list = items || []
  const idOf = (item) => item?.routineItemId || item?.id || ''
  return list.find((item) => idOf(item) === key) || list.find((item) => item.exerciseId === exerciseId) || null
}
