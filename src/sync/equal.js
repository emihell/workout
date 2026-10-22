// req-230 — deep equality for state documents, usable in the browser (the merge used Node's
// `util.isDeepStrictEqual`, which the app can't bundle). Same answers as isDeepStrictEqual on
// the values a state holds — JSON values plus `undefined`: primitives by Object.is, arrays
// element by element, plain objects by their own enumerable keys (order ignored; a key whose
// value is `undefined` still counts as a key). src/sync/equal.test.js checks it against
// isDeepStrictEqual on real states and generated values.
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const arrayA = Array.isArray(a)
  if (arrayA !== Array.isArray(b)) return false
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (arrayA && a.length !== b.length) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }
  return true
}
